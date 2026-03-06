import { db } from "@/lib/firebase";
import {
    collection,
    addDoc,
    serverTimestamp,
    query,
    where,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    orderBy,
    arrayUnion,
    runTransaction,
    onSnapshot,
    deleteDoc
} from "firebase/firestore";

import { pushLeadGenerated } from "@/utils/analytics";

import type { Trade, InventoryItem, UserAsset } from "@/types/inventory";

import { ADMIN_UID } from "@/constants/admin";

const COLLECTION_NAME = "trades";

/**
 * ADAPTADOR: Transmuta un objeto Trade (Bunker) en un Order (Legacy V1)
 * para que la UI consuma datos soberanos sin notar el cambio de motor.
 */
const bunkerToLegacy = async (trade: any) => {
    if (!trade) return null;

    // Hidratación de ítems desde el Búnker (Colección inventory)
    const items = await Promise.all((trade.manifest?.requestedItems || []).map(async (itemId: string) => {
        const itemDoc = await getDoc(doc(db, "inventory", itemId));
        if (itemDoc.exists()) {
            const data = itemDoc.data() as InventoryItem;
            return {
                id: data.id,
                artist: (data.metadata.artist || '').replace(/^UNKNOWN ARTIST\s*[-—–]*\s*/i, '').trim() || data.metadata.artist,
                album: data.metadata.title,
                title: data.metadata.title,
                cover_image: data.media.full_res_image_url || data.media.thumbnail,
                format: data.metadata.format_description,
                condition: data.logistics.condition,
                price: data.logistics.price,
                is_bunker_item: true
            };
        }
        return null;
    }));

    const cleanItems = items.filter(Boolean);
    const firstItem = cleanItems[0] || {};

    // Mapeo de estados visuales
    const statusMap: Record<string, string> = {
        "pending": "pending",
        "counter_offer": "counteroffered",
        "accepted": "completed",
        "completed": "completed",
        "cancelled": "cancelled",
        "resolved": "completed",
        "rejected": "cancelled"
    };

    return {
        ...trade,
        id: trade.id,
        status: statusMap[trade.status] || trade.status,
        createdAt: trade.timestamp,
        user_id: trade.participants?.senderId,
        is_bunker_data: true,
        // Campos de compatibilidad V1
        items: cleanItems,
        totalPrice: trade.manifest?.cashAdjustment || 0,
        currency: "ARS", // Default para trades locales
        details: {
            artist: firstItem.artist || "Varios",
            album: firstItem.album || (cleanItems.length > 1 ? `Lote de ${cleanItems.length}` : "Sin Título"),
            cover_image: firstItem.cover_image,
            price: trade.manifest?.cashAdjustment || 0,
            currency: "ARS",
            intent: "COMPRAR" // Por defecto en Trades por ahora
        },
        // Inyectar metadatos para OrderCard
        artist: firstItem.artist,
        album: firstItem.album,
        thumbnailUrl: firstItem.cover_image,
        isBatch: cleanItems.length > 1,
        itemsCount: cleanItems.length
    };
};

export const tradeService = {
    async createTrade(trade: Omit<Trade, 'id' | 'timestamp' | 'status' | 'currentTurn' | 'negotiationHistory'> & { tradeOrigin?: 'INVENTORY' | 'DISCOGS' }) {
        // --- ASSET LOCKING: Only lock items for direct sales ---
        // Exchange trades don't lock items — stock is checked atomically at resolution time.
        // This allows the same store item to be in multiple pending exchange proposals.
        const allItems = [...(trade.manifest?.requestedItems || []), ...(trade.manifest?.offeredItems || [])];

        const activeTradesQuery = query(
            collection(db, COLLECTION_NAME),
            where("status", "in", ["pending", "counter_offer", "accepted"])
        );

        const activeSnap = await getDocs(activeTradesQuery);
        const doubleBooking = activeSnap.docs.some(doc => {
            const data = doc.data() as Trade;
            // Only block if an existing DIRECT SALE already locks these items
            if (data.type !== 'direct_sale') return false;
            const existingItems = [...(data.manifest?.requestedItems || []), ...(data.manifest?.offeredItems || [])];
            return allItems.some(id => existingItems.includes(id));
        });

        if (doubleBooking) {
            throw new Error("ASSET_LOCKED: Uno o más ítems ya están en una venta directa activa.");
        }

        // --- TYPE DETERMINATION ---
        // Direct sale ONLY if origin is INVENTORY and intent is buy (no offeredItems)
        // Discogs items ALWAYS create exchanges (negotiations), never auto-resolve
        const hasNoOfferedItems = (trade.manifest?.offeredItems?.length || 0) === 0;
        const isDirectSale = trade.tradeOrigin === 'DISCOGS'
            ? false  // Discogs = siempre intercambio
            : trade.tradeOrigin === 'INVENTORY'
                ? hasNoOfferedItems  // Inventory + COMPRAR = venta directa
                : hasNoOfferedItems; // Fallback: comportamiento legacy

        const tradeType = trade.type || (isDirectSale ? "direct_sale" : "exchange");
        // FIX: Always start as "pending" — resolveTrade() will atomically transition to "completed"
        const initialStatus = "pending";

        const { tradeOrigin, ...tradeWithoutOrigin } = trade;
        const tradeData = {
            ...tradeWithoutOrigin,
            participants: {
                ...trade.participants,
                receiverId: trade.participants.receiverId || ADMIN_UID
            },
            type: tradeType,
            isPublicOrder: trade.isPublicOrder || false,
            status: initialStatus as any,
            currentTurn: trade.participants.receiverId || ADMIN_UID,
            negotiationHistory: [],
            createdAt: serverTimestamp(),
            timestamp: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, COLLECTION_NAME), tradeData);

        // Tracking DataLayer
        if (tradeData.type === 'admin_negotiation') {
            pushLeadGenerated('c2b_offer', tradeData.manifest?.cashAdjustment || 0, tradeData.manifest?.items?.length || 1, docRef.id);
        }

        // --- AUTO-RESOLUTION: For direct sales, decrement stock immediately ---
        if (isDirectSale) {
            console.log(`[Bunker] Direct sale detected. Auto-resolving trade: ${docRef.id}`);
            try {
                await this.resolveTrade(docRef.id, trade.manifest as any);
            } catch (error) {
                console.error("[Bunker] Error during auto-resolution of direct sale:", error);
                throw error;
            }
        } else {
            console.log(`[Bunker] Exchange/negotiation created: ${docRef.id} (origin: ${tradeOrigin || 'legacy'})`);
        }

        return docRef.id;
    },

    async counterTrade(tradeId: string, newManifest: Trade['manifest'], myUid: string) {
        const docRef = doc(db, COLLECTION_NAME, tradeId);
        const tradeSnap = await getDoc(docRef);
        if (!tradeSnap.exists()) throw new Error("Trade not found");

        const trade = tradeSnap.data() as Trade;
        if (trade.currentTurn !== myUid) throw new Error("Not your turn");

        // Determine next turn
        const nextTurn = trade.participants.senderId === myUid
            ? trade.participants.receiverId
            : trade.participants.senderId;

        await updateDoc(docRef, {
            manifest: newManifest,
            negotiationHistory: arrayUnion(trade.manifest),
            status: "counter_offer",
            currentTurn: nextTurn
        });

        // Create notification for the recipient
        const { addDoc, collection, serverTimestamp } = await import("firebase/firestore");
        const cashLabel = newManifest.cashAdjustment
            ? ` (${newManifest.currency === 'USD' ? 'US$' : '$'} ${Math.abs(newManifest.cashAdjustment).toLocaleString()})`
            : '';
        await addDoc(collection(db, "notifications"), {
            user_id: nextTurn,
            title: "Contraoferta Recibida",
            message: `Se ha modificado la propuesta de intercambio #${tradeId.slice(-8).toUpperCase()}${cashLabel}. Revisá los nuevos términos.`,
            read: false,
            timestamp: serverTimestamp(),
            order_id: tradeId
        });
    },


    async getUserTrades(userId: string) {
        // Fetch trades where user is sender
        const qSender = query(collection(db, COLLECTION_NAME), where("participants.senderId", "==", userId));
        const qReceiver = query(collection(db, COLLECTION_NAME), where("participants.receiverId", "==", userId));

        const [snapSender, snapReceiver] = await Promise.all([
            getDocs(qSender),
            getDocs(qReceiver)
        ]);

        const rawTradesMap = new Map<string, Trade>();
        snapSender.docs.forEach(doc => rawTradesMap.set(doc.id, { id: doc.id, ...doc.data() } as Trade));
        snapReceiver.docs.forEach(doc => rawTradesMap.set(doc.id, { id: doc.id, ...doc.data() } as Trade));

        const uniqueTrades = Array.from(rawTradesMap.values());

        // Transmutación Silenciosa
        const legacyTrades = await Promise.all(uniqueTrades.map(t => bunkerToLegacy(t)));

        return legacyTrades.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
    },


    async getTradeById(id: string) {
        const snapshot = await getDocs(query(collection(db, COLLECTION_NAME), where("__name__", "==", id)));
        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        const trade = { id: doc.id, ...doc.data() } as Trade;
        return await bunkerToLegacy(trade);
    },

    async getTrades() {
        const q = query(collection(db, COLLECTION_NAME), orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);
        const rawTrades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trade));
        return await Promise.all(rawTrades.map(t => bunkerToLegacy(t)));
    },

    async updateTradeStatus(tradeId: string, status: Trade['status']) {
        const docRef = doc(db, COLLECTION_NAME, tradeId);
        await updateDoc(docRef, { status });
    },

    async deleteTrade(tradeId: string) {
        const docRef = doc(db, COLLECTION_NAME, tradeId);
        await deleteDoc(docRef);
    },

    /**
     * Escucha en tiempo real los activos bloqueados por negociaciones activas.
     */
    onSnapshotBlockedAssets(callback: (assetIds: string[]) => void) {
        const q = query(
            collection(db, COLLECTION_NAME),
            where("status", "in", ["pending", "counter_offer", "accepted"])
        );

        return onSnapshot(q, (snapshot) => {
            const blockedIds = new Set<string>();
            snapshot.docs.forEach(doc => {
                const data = doc.data() as Trade;
                if (data.manifest?.requestedItems) {
                    data.manifest.requestedItems.forEach(id => blockedIds.add(String(id)));
                }
                if (data.manifest?.offeredItems) {
                    data.manifest.offeredItems.forEach(id => blockedIds.add(String(id)));
                }
            });
            callback(Array.from(blockedIds));
        }, (error) => {
            console.error("Error in onSnapshotBlockedAssets:", error);
            callback([]); // Retornar vacío en caso de error para no romper la UI
        });
    },

    async resolveTrade(tradeId: string, manifest: Trade['manifest']) {
        const tradeRef = doc(db, COLLECTION_NAME, tradeId);

        await runTransaction(db, async (transaction) => {
            // ═══════════════════════════════════════════════════════
            // PHASE 1: ALL READS (Firestore requires reads before writes)
            // ═══════════════════════════════════════════════════════

            const tradeSnap = await transaction.get(tradeRef);
            if (!tradeSnap.exists()) throw new Error("Trade no encontrado");

            const tradeData = tradeSnap.data() as Trade;

            if (tradeData.status === "completed") {
                throw new Error("TRADE_ALREADY_PROCESSED");
            }
            const senderId = tradeData.participants.senderId;
            const receiverId = tradeData.participants.receiverId;

            // --- Read all requested items ---
            const requestedReads: { ref: any; snap: any; itemId: string; isAdmin: boolean }[] = [];
            for (const itemId of manifest.requestedItems) {
                if (receiverId === ADMIN_UID) {
                    const itemRef = doc(db, "inventory", String(itemId));
                    const itemSnap = await transaction.get(itemRef);
                    requestedReads.push({ ref: itemRef, snap: itemSnap, itemId, isAdmin: true });
                } else {
                    const assetRef = doc(db, "user_assets", String(itemId));
                    const assetSnap = await transaction.get(assetRef);
                    requestedReads.push({ ref: assetRef, snap: assetSnap, itemId, isAdmin: false });
                }
            }

            // --- Read all offered items ---
            const offeredReads: { ref: any; snap: any; itemId: string; isAdmin: boolean }[] = [];
            for (const itemId of manifest.offeredItems) {
                if (senderId === ADMIN_UID) {
                    const itemRef = doc(db, "inventory", String(itemId));
                    const itemSnap = await transaction.get(itemRef);
                    offeredReads.push({ ref: itemRef, snap: itemSnap, itemId, isAdmin: true });
                } else {
                    const assetRef = doc(db, "user_assets", String(itemId));
                    const assetSnap = await transaction.get(assetRef);
                    offeredReads.push({ ref: assetRef, snap: assetSnap, itemId, isAdmin: false });
                }
            }

            // ═══════════════════════════════════════════════════════
            // PHASE 2: ALL WRITES (using cached read data)
            // ═══════════════════════════════════════════════════════

            // --- Process requested items (Receiver -> Sender) ---
            for (const { ref, snap, itemId, isAdmin } of requestedReads) {
                if (isAdmin) {
                    if (snap.exists()) {
                        const invData = snap.data() as InventoryItem;
                        const currentStock = invData.logistics.stock || 0;
                        if (currentStock <= 0) throw new Error(`Stock insuficiente en Búnker: ${invData.metadata.title}`);

                        transaction.update(ref, {
                            "logistics.stock": currentStock - 1,
                            "logistics.status": (currentStock - 1) === 0 ? "sold_out" : "active"
                        });

                        const newAssetRef = doc(collection(db, "user_assets"));
                        transaction.set(newAssetRef, {
                            ownerId: senderId,
                            originalInventoryId: itemId,
                            valuation: invData.logistics.price || 0,
                            isTradeable: false,
                            metadata: invData.metadata,
                            media: invData.media,
                            reference: invData.reference || null,
                            tracklist: invData.tracklist || [],
                            labels: invData.labels || [],
                            items: invData.items || [],
                            acquiredAt: serverTimestamp(),
                            stock: 1,
                            status: "active"
                        });
                    }
                } else {
                    if (!snap.exists()) throw new Error(`Activo no encontrado: ${itemId}`);
                    const assetData = snap.data() as UserAsset;

                    if (assetData.ownerId !== receiverId) throw new Error("El vendedor ya no es dueño de este activo");
                    if (assetData.status !== "active") {
                        throw new Error(`El ítem "${assetData.metadata?.title || itemId}" ya no está disponible para intercambio`);
                    }

                    transaction.update(ref, {
                        ownerId: senderId,
                        isTradeable: false,
                        acquiredAt: serverTimestamp()
                    });
                }
            }

            // --- Process offered items (Sender -> Receiver) ---
            for (const { ref, snap, itemId, isAdmin } of offeredReads) {
                if (isAdmin) {
                    if (snap.exists()) {
                        const invData = snap.data() as InventoryItem;
                        const currentStock = invData.logistics.stock || 0;
                        if (currentStock <= 0) throw new Error(`Stock insuficiente en Búnker: ${invData.metadata.title}`);

                        transaction.update(ref, {
                            "logistics.stock": currentStock - 1,
                            "logistics.status": (currentStock - 1) === 0 ? "sold_out" : "active"
                        });

                        const newAssetRef = doc(collection(db, "user_assets"));
                        transaction.set(newAssetRef, {
                            ownerId: receiverId,
                            originalInventoryId: itemId,
                            valuation: invData.logistics.price || 0,
                            isTradeable: false,
                            metadata: invData.metadata,
                            media: invData.media,
                            items: invData.items || [],
                            acquiredAt: serverTimestamp(),
                            stock: 1,
                            status: "active"
                        });
                    }
                } else {
                    if (!snap.exists()) throw new Error(`Activo ofrecido no encontrado: ${itemId}`);
                    const assetData = snap.data() as UserAsset;

                    if (assetData.ownerId !== senderId) throw new Error("Ya no eres dueño del activo que intentas ofrecer");
                    const assetStock = assetData.stock ?? 1;
                    if (assetData.status !== "active" || assetStock <= 0) {
                        throw new Error(`Tu ítem "${assetData.metadata?.title || itemId}" ya no está disponible`);
                    }

                    if (assetStock <= 1) {
                        // Last unit → transfer ownership
                        transaction.update(ref, {
                            ownerId: receiverId,
                            isTradeable: false,
                            stock: 1,
                            acquiredAt: serverTimestamp()
                        });
                    } else {
                        // Multiple stock → decrement and create new asset for receiver
                        transaction.update(ref, { stock: assetStock - 1 });
                        const newAssetRef = doc(collection(db, "user_assets"));
                        transaction.set(newAssetRef, {
                            ownerId: receiverId,
                            originalInventoryId: assetData.originalInventoryId || '',
                            valuation: assetData.valuation || 0,
                            isTradeable: false,
                            metadata: assetData.metadata,
                            media: assetData.media,
                            reference: assetData.reference || null,
                            tracklist: assetData.tracklist || [],
                            labels: assetData.labels || [],
                            items: assetData.items || [],
                            acquiredAt: serverTimestamp(),
                            stock: 1,
                            status: "active"
                        });
                    }
                }
            }

            transaction.update(tradeRef, { status: "completed", resolvedAt: serverTimestamp() });
        });
    },

    async createProposal(tradeId: string, proposal: any) {
        const proposalsRef = collection(db, COLLECTION_NAME, tradeId, "proposals");
        const docRef = await addDoc(proposalsRef, {
            ...proposal,
            status: "pending",
            timestamp: serverTimestamp()
        });
        return docRef.id;
    },

    async getProposals(tradeId: string) {
        const proposalsRef = collection(db, COLLECTION_NAME, tradeId, "proposals");
        const q = query(proposalsRef, orderBy("timestamp", "desc"));
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async resolvePublicProposal(tradeId: string, proposalId: string) {
        const tradeRef = doc(db, COLLECTION_NAME, tradeId);
        const proposalRef = doc(db, COLLECTION_NAME, tradeId, "proposals", proposalId);

        // We fetch other proposals BEFORE the transaction because transactions 
        // don't support collection-level queries in Firestore.
        const otherProposalsQuery = query(collection(db, COLLECTION_NAME, tradeId, "proposals"));
        const othersSnap = await getDocs(otherProposalsQuery);

        await runTransaction(db, async (transaction) => {
            const tradeSnap = await transaction.get(tradeRef);
            const proposalSnap = await transaction.get(proposalRef);

            if (!tradeSnap.exists()) throw new Error("Orden madre no encontrada");
            if (!proposalSnap.exists()) throw new Error("Propuesta no encontrada");

            const tradeData = tradeSnap.data() as Trade;
            if (tradeData.status === "resolved") throw new Error("ORDER_ALREADY_RESOLVED");

            // 1. Mark winning proposal
            transaction.update(proposalRef, {
                status: "accepted",
                resolvedAt: serverTimestamp()
            });

            // 2. Mark other proposals as rejected
            othersSnap.docs.forEach(pDoc => {
                if (pDoc.id !== proposalId) {
                    transaction.update(pDoc.ref, { status: "rejected" });
                }
            });

            // 3. Mark parent trade as resolved
            transaction.update(tradeRef, {
                status: "resolved",
                winnerProposalId: proposalId,
                resolvedAt: serverTimestamp()
            });

            // INVARIANT: Transfer items (Phase IV Optimization)
            // Here we would ideally loop through proposal manifest items 
            // and update userAssets status to 'sold' or transfer owner,
            // or decrement inventory stock if applicable.
        });
    }

};
