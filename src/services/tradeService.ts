import { db, auth } from "@/lib/firebase";
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
    setDoc,
    orderBy,
    arrayUnion,
    runTransaction,
    onSnapshot,
    deleteDoc,
    deleteField,
    collectionGroup,
    writeBatch
} from "firebase/firestore";

import { pushLeadGenerated } from "@/utils/analytics";

import type { Trade, InventoryItem, UserAsset } from "@/types/inventory";

import { ADMIN_UID } from "@/constants/admin";
import { scrubData } from "@/utils/firestore";

const COLLECTION_NAME = "trades";

/**
 * ADAPTADOR: Transmuta un objeto Trade (batea) en un Order (Legacy V1)
 * para que la UI consuma datos soberanos sin notar el cambio de motor.
 */
const bateaToLegacy = async (trade: any) => {
    if (!trade) return null;

    // Hidratación de ítems desde el La Batea (Colección inventory)
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
                is_batea_item: true
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
        "accepted": "accepted",
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
        is_batea_data: true,
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
            intent: trade.type === 'direct_sale' ? "VENDER" : "COMPRAR"
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
    bateaToLegacy,
    async createTrade(trade: Omit<Trade, 'id' | 'timestamp' | 'status' | 'currentTurn' | 'negotiationHistory'> & { tradeOrigin?: 'INVENTORY' | 'DISCOGS' }) {
        // --- ASSET LOCKING: Only lock items for direct sales ---
        // Exchange trades don't lock items — stock is checked atomically at resolution time.
        // This allows the same store item to be in multiple pending exchange proposals.
        const allItems = [...(trade.manifest?.requestedItems || []), ...(trade.manifest?.offeredItems || [])];

        // --- ASSET LOCKING ---
        // Eliminated broad check that caused permission errors for non-admin users.
        // resolveTrade() performs atomic stock validation during resolution.

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
        // FIX: Respect status override (V24.2)
        const initialStatus = (trade as any).status || "pending";

        const { tradeOrigin, ...tradeWithoutOrigin } = trade;
        
        // V46 Hard-Link: receiverId is mandatory for P2P. No more Admin fallback.
        // V53 Saneamiento: receiverId puede ser opcional SOLO si es una publicación pública (Listing).
        let receiverId = trade.participants.receiverId;
        const isListing = trade.isPublicOrder === true && !receiverId;

        if (!receiverId && !isListing) {
            console.error("[V46] createTrade failed: receiverId is mandatory for identity linkage.");
            throw new Error("SISTEMA_IDENTIDAD_PARTICIPANTE_REQUERIDO");
        }

        const currentUserId = auth.currentUser?.uid;
        const finalSenderId = currentUserId || trade.participants.senderId;

        // V48.0 Zero Trust: Re-validate receiverId against source of truth if it's P2P
        // V53: Si es un Listing (receiverId null), no sobreescribimos con el owner del item, 
        // ya que el seller es el sender y el receiver queda libre.
        const p2pItem = trade.manifest?.items?.find((i: any) => i.source === 'user_asset');
        const userAssetId = p2pItem?.userAssetId || p2pItem?.id;

        if (userAssetId) {
            // V53.1 FINAL GUARD: Prohibir Admin como receptor de assets P2P
            if (receiverId === ADMIN_UID) {
                console.warn("[V53.1-GUARD] Intento de asignar ADMIN_UID como receptor de un User Asset. Corrigiendo a NULL para listing.");
                receiverId = null;
            }

            if (receiverId) {
                console.log(`[V48-ZERO-TRUST] Re-validando dueño para asset: ${userAssetId}`);
                const assetSnap = await getDoc(doc(db, "user_assets", userAssetId));
                if (assetSnap.exists()) {
                    const realOwnerId = assetSnap.data().ownerId || assetSnap.data().uid;
                    if (realOwnerId && realOwnerId !== receiverId) {
                        console.warn(`[V48-ZERO-TRUST] ¡ATAQUE O FALLO DE IDENTIDAD DETECTADO! UI envió: ${receiverId}, Firestore exige: ${realOwnerId}. Sobreescribiendo.`);
                        receiverId = realOwnerId;
                    }
                }
            }
        }

        const tradeData = {
            ...tradeWithoutOrigin,
            participants: {
                ...trade.participants,
                senderId: finalSenderId, // V47.1: Forzado al usuario actual
                receiverId
            },
            type: tradeType,
            isPublicOrder: trade.isPublicOrder || false,
            status: initialStatus as any,
            currentTurn: receiverId, // V47.1: El vendedor debe aceptar
            negotiationHistory: [],
            createdAt: serverTimestamp(),
            timestamp: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, COLLECTION_NAME), scrubData(tradeData));
        console.log(`[P2P-FINAL] Orden creada con ID: ${docRef.id}. Vendedor asignado: ${receiverId} | Comprador: ${finalSenderId}`);

        // Tracking DataLayer
        if (tradeData.type === 'admin_negotiation') {
            pushLeadGenerated('c2b_offer', tradeData.manifest?.cashAdjustment || 0, tradeData.manifest?.items?.length || 1, docRef.id);
        }

        // --- AUTO-RESOLUTION: Only for store direct sales (OBG Shop) ---
        // P2P Direct sales should stay pending/accepted so the seller can resolve (due to security permissions)
        const isStoreDirectSale = isDirectSale && (receiverId === ADMIN_UID || receiverId === 'oldiebutgoldie');

        if (isStoreDirectSale) {
            console.log(`[batea] Store direct sale detected. Auto-resolving trade: ${docRef.id}`);
            try {
                await this.resolveTrade(docRef.id, trade.manifest as any);
            } catch (error) {
                console.error("[batea] Error during auto-resolution of store direct sale:", error);
                throw error;
            }
        } else if (isDirectSale) {
            console.log(`[batea] P2P Direct sale created: ${docRef.id}. Waiting for acceptance/resolution.`);
        } else {
            console.log(`[batea] Exchange/negotiation created: ${docRef.id} (origin: ${tradeOrigin || 'legacy'})`);
        }

        return docRef.id;
    },

    async counterTrade(tradeId: string, newManifest: Trade['manifest'], myUid: string, isAdminForce: boolean = false) {
        const docRef = doc(db, COLLECTION_NAME, tradeId);
        const tradeSnap = await getDoc(docRef);
        if (!tradeSnap.exists()) throw new Error("Trade not found");

        const trade = tradeSnap.data() as Trade;
        const isAdmin = isAdminForce || (myUid === ADMIN_UID);
        
        // Turn validation (standardized)
        const isMyTurn = trade.currentTurn === myUid || (isAdmin && (trade.currentTurn === 'admin' || trade.currentTurn === ADMIN_UID));
        if (!isMyTurn) throw new Error("Not your turn");

        // Determine next turn
        const nextTurn = trade.participants.senderId === myUid
            ? trade.participants.receiverId
            : trade.participants.senderId;

        await updateDoc(docRef, scrubData({
            manifest: newManifest,
            negotiationHistory: arrayUnion(trade.manifest),
            status: "counter_offer",
            currentTurn: nextTurn
        }));

        // Create notification for the recipient
        const { addDoc, collection, serverTimestamp } = await import("firebase/firestore");
        const cashLabel = newManifest.cashAdjustment
            ? ` (${newManifest.currency === 'USD' ? 'US$' : '$'} ${Math.abs(newManifest.cashAdjustment).toLocaleString()})`
            : '';
        await addDoc(collection(db, "notifications"), {
            uid: nextTurn,
            user_id: nextTurn,
            title: "Contraoferta Recibida",
            message: `Se ha modificado la propuesta de intercambio #${tradeId.slice(-8).toUpperCase()}${cashLabel}. Revisá los nuevos términos.`,
            read: false,
            timestamp: serverTimestamp(),
            order_id: tradeId,
            link: `/mensajes?chat=${tradeId}`
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
        const legacyTrades = await Promise.all(uniqueTrades.map(t => bateaToLegacy(t)));

        return legacyTrades.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
    },


    async getTradeById(id: string) {
        const snapshot = await getDocs(query(collection(db, COLLECTION_NAME), where("__name__", "==", id)));
        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        const trade = { id: doc.id, ...doc.data() } as Trade;
        return await bateaToLegacy(trade);
    },

    async getTrades() {
        const q = query(collection(db, COLLECTION_NAME), orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);
        const rawTrades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trade));
        return await Promise.all(rawTrades.map(t => bateaToLegacy(t)));
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
     * Escucha en tiempo real los activos bloqueados por negociaciones activas o reservas.
     * Protocolo V63.0: Soporte para estados de reserva (pending_payment).
     */
    onSnapshotBlockedAssets(callback: (data: { negotiating: string[], reserved: string[] }) => void) {
        const q = query(
            collection(db, COLLECTION_NAME),
            where("status", "in", ["pending", "counter_offer", "accepted", "pending_payment"])
        );

        return onSnapshot(q, (snapshot) => {
            const negotiating = new Set<string>();
            const reserved = new Set<string>();

            snapshot.docs.forEach(doc => {
                const data = doc.data() as Trade;
                const status = data.status;
                const items = [
                    ...(data.manifest?.requestedItems || []),
                    ...(data.manifest?.offeredItems || [])
                ].map(id => String(id));

                if (status === "pending_payment" || status === "accepted") {
                    items.forEach(id => reserved.add(id));
                } else {
                    items.forEach(id => negotiating.add(id));
                }
            });

            callback({
                negotiating: Array.from(negotiating),
                reserved: Array.from(reserved)
            });
        }, (error) => {
            console.error("Error in onSnapshotBlockedAssets:", error);
            callback({ negotiating: [], reserved: [] });
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

            const tradeData = tradeSnap.data() as any;

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
            const offeredReads: { ref: any; snap: any; itemId: string; isAdmin: boolean; isExternal?: boolean }[] = [];
            for (const itemId of manifest.offeredItems) {
                if (senderId === ADMIN_UID) {
                    const itemRef = doc(db, "inventory", String(itemId));
                    const itemSnap = await transaction.get(itemRef);
                    offeredReads.push({ ref: itemRef, snap: itemSnap, itemId, isAdmin: true });
                } else {
                    // Try user_assets first
                    const assetRef = doc(db, "user_assets", String(itemId));
                    const assetSnap = await transaction.get(assetRef);
                    
                    if (assetSnap.exists()) {
                        offeredReads.push({ ref: assetRef, snap: assetSnap, itemId, isAdmin: false });
                    } else {
                        // Fallback to archived inventory (C2B Offer of external item)
                        const itemRef = doc(db, "inventory", String(itemId));
                        const itemSnap = await transaction.get(itemRef);
                        offeredReads.push({ ref: itemRef, snap: itemSnap, itemId, isAdmin: false, isExternal: true });
                    }
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
                        const isArchived = invData.logistics?.status === 'archived';
                        
                        // If it's a real inventory item, check and decrement stock
                        if (!isArchived) {
                            const currentStock = invData.logistics.stock || 0;
                            if (currentStock <= 0) throw new Error(`Stock insuficiente en La Batea: ${invData.metadata.title}`);

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
                        } else {
                            // If it's archived (External Request), we just let the trade resolve to 'in_process'
                            // without touching stock or creating assets yet.
                            console.log(`[batea] External request item ${itemId} detected. Skipping stock decrement.`);
                        }
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
            for (const { ref, snap, itemId, isAdmin, isExternal } of offeredReads) {
                if (isAdmin) {
                    if (snap.exists()) {
                        const invData = snap.data() as InventoryItem;
                        const currentStock = invData.logistics.stock || 0;
                        if (currentStock <= 0) throw new Error(`Stock insuficiente en La Batea: ${invData.metadata.title}`);

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
                } else if (isExternal) {
                    // C2B Flow: User offers an archived item from inventory
                    if (!snap.exists()) throw new Error(`Ítem externo no encontrado en inventario: ${itemId}`);
                    const invData = snap.data() as InventoryItem;
                    
                    // We don't always decrement stock for archived items if they are just placeholders,
                    // but for consistency we'll treat them as single-unit items if they are being 'transferred'.
                    // Actually, if it's archived, it's safer to just create the asset for the receiver.
                    
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

            // ═══════════════════════════════════════════════════════
            // PHASE 3: STATUS DETERMINATION
            // ═══════════════════════════════════════════════════════
            
            let finalStatus: Trade['status'] = "completed";
            
            // If it's a direct sale, mark as completed_unpaid (V23.5)
            if (tradeData.type === 'direct_sale') {
                finalStatus = "completed_unpaid";
            }
            
            // If it's an admin negotiation for Discogs items, mark as in_process
            if (tradeData.type === 'admin_negotiation' && tradeData.manifest.requestedItems.length > 0) {
                // Check if any item is a Discogs/Archived item (stock 0)
                const isExternalRequest = requestedReads.some(r => r.isAdmin && r.snap.exists() && r.snap.data()?.logistics?.status === 'archived');
                if (isExternalRequest) {
                    finalStatus = "in_process";
                }
            }

            transaction.update(tradeRef, { status: finalStatus, resolvedAt: serverTimestamp() });
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

    async submitBid(tradeId: string, userId: string, amount: number, username: string) {
        const tradeRef = doc(db, COLLECTION_NAME, tradeId);
        
        return await runTransaction(db, async (transaction) => {
            const tradeSnap = await transaction.get(tradeRef);
            if (!tradeSnap.exists()) throw new Error("Subasta no encontrada");
            
            const tradeData = tradeSnap.data() as Trade;
            
            // 1. Validation: Time
            const now = Date.now();
            const endDate = tradeData.auction_end_date?.toMillis ? tradeData.auction_end_date.toMillis() : new Date(tradeData.auction_end_date).getTime();
            if (now > endDate) {
                throw new Error("La subasta ha cerrado");
            }
            
            // 2. Validation: Amount
            const currentMin = tradeData.current_highest_bid || tradeData.starting_price || 0;
            // First bid must be >= starting_price, subsequent must be > current_highest_bid
            const isFirstBid = !tradeData.current_highest_bid;
            if (isFirstBid) {
                if (amount < currentMin) throw new Error(`La oferta inicial debe ser al menos de $${currentMin.toLocaleString()}`);
            } else {
                if (amount <= currentMin) throw new Error(`Debes superar la oferta actual de $${currentMin.toLocaleString()}`);
            }
            
            // 3. Update Trade record
            transaction.update(tradeRef, {
                current_highest_bid: amount,
                highest_bidder_uid: userId,
                highest_bidder_name: username,
                bid_count: (tradeData.bid_count || 0) + 1,
                last_bid_at: serverTimestamp(),
                status: "pending_resolution" // Track finished state
            });
            
            // 4. Record as Proposal (Subcollection) for history
            const proposalRef = doc(collection(db, COLLECTION_NAME, tradeId, "proposals"));
            transaction.set(proposalRef, {
                senderId: userId,
                senderName: username,
                type: 'bid',
                manifest: {
                    cashAdjustment: amount,
                    currency: 'ARS'
                },
                status: "pending",
                timestamp: serverTimestamp()
            });

            // 5. Notification for Seller (V43.0 Standard)
            const notifRef = doc(collection(db, "notifications"));
            transaction.set(notifRef, {
                uid: tradeData.participants.senderId, // Dueño del disco (V43 standardized)
                user_id: tradeData.participants.senderId, // Dual-Write V43.1
                title: "Nueva oferta 💸",
                message: `${username} ofertó $${amount.toLocaleString()} por tu disco.`,
                read: false,
                timestamp: serverTimestamp(),
                order_id: tradeId,
                type: "bid",
                link: `/orden/${tradeId}`
            });
            
            return { tradeId, amount };
        });
    },

    async acceptWinningBid(tradeId: string, userId: string) {
        const tradeRef = doc(db, COLLECTION_NAME, tradeId);
        const messagesRef = collection(db, COLLECTION_NAME, tradeId, "messages");
        
        return await runTransaction(db, async (transaction) => {
            const tradeSnap = await transaction.get(tradeRef);
            if (!tradeSnap.exists()) throw new Error("Subasta no encontrada");
            
            const tradeData = tradeSnap.data() as Trade;
            
            if (tradeData.participants.senderId !== userId) {
                throw new Error("Solo el vendedor puede aceptar la oferta ganadora");
            }
            
            if (!tradeData.highest_bidder_uid) {
                throw new Error("No hay ofertas para aceptar");
            }

            if (tradeData.status === "accepted") {
                throw new Error("La subasta ya ha sido aceptada");
            }

            // 1. Update status
            transaction.update(tradeRef, {
                status: "accepted",
                isPaid: false,
                payment_status: 'pending',
                acceptedAt: serverTimestamp(),
                currentTurn: tradeData.highest_bidder_uid // Coordination pass to winner
            });

            // 2. Generate automated message
            const newMessageRef = doc(messagesRef);
            transaction.set(newMessageRef, {
                sender_uid: "system",
                text: `¡Subasta Finalizada! ${tradeData.participants?.senderName || 'El vendedor'} ha aceptado la oferta de @${tradeData.highest_bidder_name || 'Ganador'}. Coordinen aquí el envío.`,
                timestamp: serverTimestamp(),
                read_status: false
            });

            // 3. Add notification for winner
            const notificationRef = doc(collection(db, "notifications"));
            transaction.set(notificationRef, {
                uid: tradeData.highest_bidder_uid, // V43 STANDARD: Primary identity field
                user_id: tradeData.highest_bidder_uid, // Dual-Write V43.1
                title: "¡Ganaste la Subasta!",
                message: `El vendedor aceptó tu oferta por "${tradeData.manifest.items?.[0]?.title || 'el disco'}". El chat de coordinación está abierto.`,
                read: false,
                timestamp: serverTimestamp(),
                order_id: tradeId,
                type: "order",
                link: `/mensajes?chat=${tradeId}`
            });
        });
    },

    async sendMessage(tradeId: string, senderId: string, text: string) {
        const messagesRef = collection(db, COLLECTION_NAME, tradeId, "messages");
        await addDoc(messagesRef, {
            sender_uid: senderId,
            text,
            timestamp: serverTimestamp(),
            read_status: false
        });
    },

    async startInquiry(tradeId: string, buyerUid: string, buyerName: string, forcedSellerId?: string) {
        if (!buyerName) throw new Error("USERNAME_REQUIRED");
        const buyerUsername = buyerName.startsWith('@') ? buyerName : `@${buyerName}`;
        
        console.log(`[V46-HARDLINK] Iniciando búsqueda -> TradeId: ${tradeId} | forcedSellerId: ${forcedSellerId}`);
        
        let sellerId: string = "";
        let title = "Disco Desconocido";
        let cover = "";
        let sourceCollection = "none";

        const tradeRef = doc(db, COLLECTION_NAME, tradeId);
        let tradeSnap = await getDoc(tradeRef);
        
        // 1. DETERMINAR EL ID REAL DEL DISCO (discoId)
        // Cascada V45: Si el tradeId no es el disco, buscamos dentro del manifiesto
        let discoId = tradeId;
        if (tradeSnap.exists()) {
            const tradeData = tradeSnap.data() as any;
            discoId = tradeData.manifest?.requestedItems?.[0] || tradeData.manifest?.offeredItems?.[0] || 
                     tradeData.userAssetId || tradeData.id || tradeId;
        }

        console.log(`[V49-ATOMIC] Resolviendo Propiedad -> DiscoId: ${discoId}`);

        const [assetSnap, inventorySnap] = await Promise.all([
            getDoc(doc(db, "user_assets", discoId)),
            getDoc(doc(db, "inventory", discoId))
        ]);

        // ATOMIC RESOLUTION (V49.0): No fallbacks, no guessing.
        if (assetSnap.exists()) {
            const assetData = assetSnap.data() as any;
            sellerId = assetData.ownerId || assetData.uid;
            title = assetData.metadata?.title || title;
            cover = assetData.media?.thumbnail || "";
            sourceCollection = "user_assets";
        } 
        else if (inventorySnap.exists()) {
            const itemData = inventorySnap.data() as any;
            // V53.1: Permitir que ítems en la colección inventory tengan dueño P2P
            sellerId = itemData.sellerId || itemData.ownerId || ADMIN_UID;
            title = itemData.metadata?.title || title;
            cover = itemData.media?.thumbnail || "";
            sourceCollection = "inventory";
        }
        else {
            // Si no está en user_assets ni en inventory, es un activo huérfano. ABORTAR.
            console.error(`[V49-FATAL] No se pudo verificar la propiedad del activo ${discoId}. Abortando.`);
            throw new Error("ERROR_PROPIEDAD_NO_VERIFICADA");
        }

        // BLOQUEO DE AUTO-COMPRA (V49.0)
        if (buyerUid === sellerId) {
            console.warn(`[V49-BLOCK] Intento de auto-compra detectado para el usuario ${buyerUid}`);
            throw new Error("ERROR_AUTO_COMPRA_RESTRINGIDA");
        }

        // BLOQUEO DE ADMIN EN P2P (V49.0)
        if (sourceCollection === 'user_assets' && sellerId === ADMIN_UID) {
            console.error("[V49-FATAL] Inconsistencia: User Asset asignado al Admin.");
            throw new Error("ERROR_SISTEMA_IDENTIDAD_INVERTIDA");
        }

        console.log(`[V49-SUCCESS] Identidad validada: Vendedor=${sellerId} | Source=${sourceCollection}`);

        // HEALING: Ensure Trade record exists and is synced with master source
        if (!tradeSnap.exists() || (tradeSnap.data() as any).participants?.receiverId !== sellerId) {
            console.log(`[V43.0] Healing/Creating root trade...`);
            await setDoc(tradeRef, scrubData({
                participants: {
                    senderId: buyerUid, // Comprador
                    receiverId: sellerId // Vendedor
                },
                type: 'direct_sale',
                status: 'pending',
                currentTurn: sellerId, // V47.1: El vendedor debe aceptar
                isPublicOrder: true, 
                is_admin_offer: (sellerId === ADMIN_UID),
                manifest: {
                    requestedItems: [tradeId],
                    offeredItems: [],
                    items: [{
                        id: tradeId,
                        title: title,
                        cover_image: cover
                    }]
                },
                createdAt: (tradeSnap.exists() ? (tradeSnap.data() as any).createdAt : serverTimestamp()),
                timestamp: serverTimestamp()
            }), { merge: true });
        }

        // --- Fetch Seller Username (Identity Sync) ---
        let sellerUsername = "Vendedor";
        const sellerDoc = await getDoc(doc(db, "users", sellerId));
        if (sellerDoc.exists()) {
            const sData = sellerDoc.data();
            sellerUsername = sData.username ? (sData.username.startsWith('@') ? sData.username : `@${sData.username}`) : sData.display_name || "Vendedor";
        }

        const newChatId = `${tradeId}_${buyerUid}`;
        const p2pChatRef = doc(db, "p2p_chats", newChatId);
        const snap = await getDoc(p2pChatRef);
        
        if (!snap.exists()) {
            console.log(`[InboxV2] Creando chat nativo para Trade: ${tradeId}. Vendedor: ${sellerId} (${sellerUsername}) | Comprador: ${buyerUid}`);
            const batch = writeBatch(db);
            
            const chatData = {
                id: newChatId,
                tradeId: tradeId,
                buyerId: buyerUid,
                sellerId: sellerId,
                participants: [buyerUid, sellerId],
                buyerUsername: buyerUsername,
                sellerUsername: sellerUsername,
                title: title,
                cover: cover,
                lastMessage: "Consulta iniciada",
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp(),
                status: "pending"
            };

            // 1. Create Native P2PChat (V2)
            batch.set(p2pChatRef, chatData);

            // 2. Initialization Message (V2)
            const p2pMessageRef = doc(collection(db, "p2p_chats", newChatId, "messages"));
            const orderLink = `https://www.oldiebutgoldie.com.ar/orden/${tradeId}`;
            
            const systemMessage = {
                sender_uid: "system",
                text: `¡Hola! ${buyerUsername} te escribió por "${title}". Link al pedido: ${orderLink}`,
                timestamp: serverTimestamp(),
                read_status: false
            };

            batch.set(p2pMessageRef, systemMessage);

            // 3. Notification for Seller (Unified V43 Field)
            if (sellerId && sellerId !== buyerUid) {
                const notifRef = doc(collection(db, "notifications"));
                batch.set(notifRef, {
                    uid: sellerId,        // V43 Primary (FIRST)
                    user_id: sellerId,    // Legacy Dual-Write
                    title: "Nueva consulta 📬",
                    message: `${buyerUsername} te escribió por "${title}".`,
                    read: false,
                    timestamp: serverTimestamp(),
                    order_id: tradeId,
                    type: "chat",
                    link: `/mensajes?chat=${newChatId}` 
                });
            }

            await batch.commit();
        }
        return tradeId;
    },

    async sendPrivateMessage(tradeId: string, chatId: string, senderId: string, text: string) {
        if (!chatId) {
            console.error("[InboxV2] sendPrivateMessage failed: INVALID_CHAT_ID", { tradeId, chatId });
            throw new Error("SISTEMA_IDENTIDAD_CHAT_REQUERIDO");
        }

        const p2pChatRef = doc(db, "p2p_chats", chatId);
        const p2pMessagesRef = collection(db, "p2p_chats", chatId, "messages");
        
        const messageData = {
            sender_uid: senderId,
            text,
            timestamp: serverTimestamp(),
            read_status: false
        };

        // Fetch chat data to identify recipients
        const chatSnap = await getDoc(p2pChatRef);
        const chatData = chatSnap.data() as any;

        if (!chatData) {
            console.error("[InboxV2] sendPrivateMessage failed: CHAT_DATA_NOT_FOUND");
            return;
        }

        // Write Native V2 Only
        await Promise.all([
            setDoc(p2pChatRef, {
                lastMessage: text,
                updatedAt: serverTimestamp()
            }, { merge: true }),
            addDoc(p2pMessagesRef, messageData)
        ]);

        // Hyper-robust recipient resolution (Protocol V43.3)
        if (senderId !== "system") {
            let recipientId = null;
            const participants = chatData.participants || [];
            
            // Try all historical naming conventions
            const bId = chatData.buyerId || chatData.buyer_uid || chatData.buyerId;
            const sId = chatData.sellerId || chatData.seller_uid || chatData.seller_uid;

            if (senderId === bId) {
                recipientId = sId;
            } else if (senderId === sId) {
                recipientId = bId;
            } else if (participants.length >= 2) {
                recipientId = participants.find((p: string) => p !== senderId);
            } else {
                recipientId = chatId.split('_').pop();
            }

            console.log(`[NotifV2] Robust Resolve: sender=${senderId} | buyer=${bId} | seller=${sId} | finalRecipient=${recipientId}`);

            const isBuyerSender = senderId === chatData.buyerId;
            const senderName = isBuyerSender ? (chatData.buyerUsername || chatData.buyerName) : (chatData.sellerUsername || "Vendedor");

            if (recipientId && recipientId !== senderId) {
                console.log(`[NotifV2] Despachando notificación para ${recipientId} de parte de ${senderName}`);
                await addDoc(collection(db, "notifications"), {
                    uid: recipientId,
                    user_id: recipientId,
                    type: 'chat',
                    title: `Nuevo mensaje de ${senderName}`,
                    message: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                    link: `/mensajes?chat=${chatId}`,
                    read: false,
                    timestamp: serverTimestamp(),
                    order_id: tradeId
                });
            } else {
                console.warn("[NotifV2] No se despachó notificación: recipientId inválido o igual al emisor", { recipientId, senderId });
            }
        }
    },



    async adjudicateTrade(tradeId: string, buyerId: string, buyerName: string) {
        const tradeRef = doc(db, COLLECTION_NAME, tradeId);
        
        await runTransaction(db, async (transaction) => {
            const tradeSnap = await transaction.get(tradeRef);
            if (!tradeSnap.exists()) throw new Error("TRADE_NOT_FOUND");
            
            const tradeData = tradeSnap.data() as any;
            if (tradeData.status !== "pending") throw new Error("TRADE_NOT_AVAILABLE");

            const chatId = `${tradeId}_${buyerId}`;

            // 1. Atomic status update (Protocol V58.2: P2P Adjudication)
            transaction.update(tradeRef, {
                status: "pending_payment",
                payment_status: 'pending',
                buyer_uid: buyerId,
                buyer_name: buyerName,
                "participants.receiverId": buyerId, // Now the buyer is the official participant
                acceptedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // 2. Update P2P Chat Status (Native V2)
            const p2pChatRef = doc(db, "p2p_chats", chatId);
            transaction.update(p2pChatRef, {
                status: "pending_payment",
                lastMessage: "¡Oferta aceptada! Procediendo al pago.",
                updatedAt: serverTimestamp()
            });

            // 3. Notification for Buyer (V43.1 Dual-Write)
            const notifRef = doc(collection(db, "notifications"));
            transaction.set(notifRef, {
                uid: buyerId,
                user_id: buyerId,
                title: "¡Oferta aceptada! 🎉",
                message: `El vendedor aceptó tu oferta por "${tradeData.details?.album || 'el disco'}". Por favor, coordina el pago.`,
                read: false,
                timestamp: serverTimestamp(),
                order_id: tradeId,
                type: "order",
                link: `/mensajes?chat=${chatId}`
            });

            // 4. Automated System Message
            const p2pMessageRef = doc(collection(db, "p2p_chats", chatId, "messages"));
            transaction.set(p2pMessageRef, {
                sender_uid: "system",
                text: "🎉 El vendedor ha aceptado tu solicitud. La orden está reservada y en estado 'Pendiente de Pago'. Por favor, coordinen el método de pago por este medio.",
                timestamp: serverTimestamp(),
                read_status: false
            });
        });
    },

    async confirmPaymentAndTransfer(tradeId: string, chatId: string) {
        const tradeRef = doc(db, COLLECTION_NAME, tradeId);
        
        await runTransaction(db, async (transaction) => {
            const tradeSnap = await transaction.get(tradeRef);
            if (!tradeSnap.exists()) throw new Error("TRADE_NOT_FOUND");
            const tradeData = tradeSnap.data() as any;

            if (tradeData.status !== 'pending_payment') {
                throw new Error("TRADE_NOT_IN_PAYMENT_STATE");
            }

            const buyerId = tradeData.participants?.receiverId || tradeData.buyer_uid;
            
            // 1. Transfer Assets (User Asset Ownership)
            const p2pItems = (tradeData.manifest?.items || []).filter((i: any) => i.source === 'user_asset');
            for (const item of p2pItems) {
                const assetId = item.userAssetId || item.id;
                const assetRef = doc(db, "user_assets", assetId);
                transaction.update(assetRef, {
                    ownerId: buyerId,
                    isTradeable: false, // Freeze during transfer
                    status: 'active',
                    transferredAt: serverTimestamp()
                });

                // Mark original inventory item as sold if it exists
                if (item.originalInventoryId) {
                    const invRef = doc(db, "inventory", item.originalInventoryId);
                    transaction.update(invRef, {
                        "logistics.status": "sold",
                        "logistics.stock": 0
                    });
                }
            }

            // 2. Finalize Trade Status (Protocol V60.2: Uber-style review tracking)
            transaction.update(tradeRef, {
                status: 'completed',
                payment_status: 'paid',
                pending_reviews: [tradeData.participants?.senderId || tradeData.user_id, buyerId].filter(Boolean),
                completedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // 3. Close Chat
            const p2pChatRef = doc(db, "p2p_chats", chatId);
            transaction.update(p2pChatRef, {
                status: 'completed',
                lastMessage: "✅ Venta finalizada. ¡Disfruta el disco!",
                updatedAt: serverTimestamp()
            });

            // 4. Final System Message
            const p2pMessageRef = doc(collection(db, "p2p_chats", chatId, "messages"));
            transaction.set(p2pMessageRef, {
                sender_uid: "system",
                text: "✅ El vendedor ha confirmado la recepción del pago. ¡Transacción completada! La propiedad del disco ha sido transferida a tu colección. ¡A disfrutar la música!",
                timestamp: serverTimestamp(),
                read_status: false
            });
        });
    },



    onSnapshotMessages(tradeId: string, callback: (messages: any[]) => void) {
        const q = query(
            collection(db, "trades", tradeId, "messages"),
            orderBy("timestamp", "asc")
        );
        return onSnapshot(q, (snap) => {
            const msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(msgs);
        });
    },

    async submitTradeReview(tradeId: string, review: { reviewer_uid: string, reviewee_uid: string, rating: number, comment?: string }) {
        return runTransaction(db, async (transaction) => {
            const tradeRef = doc(db, "trades", tradeId);
            const userRef = doc(db, "users", review.reviewee_uid);
            const reviewRef = doc(collection(db, "reviews"));

            const tradeSnap = await transaction.get(tradeRef);
            const userSnap = await transaction.get(userRef);

            if (!tradeSnap.exists()) throw new Error("TRADE_NOT_FOUND");
            if (!userSnap.exists()) throw new Error("USER_NOT_FOUND");

            const userData = userSnap.data();
            const currentStats = userData.stats || { rating_average: 0, rating_count: 0 };
            
            const newCount = (currentStats.rating_count || 0) + 1;
            const newAverage = ((currentStats.rating_average || 0) * (currentStats.rating_count || 0) + review.rating) / newCount;

            // 1. Update Trade pending reviews (Protocol V60.2)
            const tradeData = tradeSnap.data() as any;
            const currentPending = tradeData.pending_reviews || [];
            const updatedPending = currentPending.filter((uid: string) => uid !== review.reviewer_uid);

            transaction.update(tradeRef, { 
                status: 'completed',
                pending_reviews: updatedPending
            });

            // 2. Create Review
            transaction.set(reviewRef, {
                ...review,
                trade_id: tradeId,
                created_at: serverTimestamp()
            });

            // 3. Update User stats
            transaction.update(userRef, {
                "stats.rating_average": newAverage,
                "stats.rating_count": newCount,
                updatedAt: serverTimestamp()
            });

            // 4. Notification for Reviewee - V43.1 Dual-Write
            const notifRef = doc(collection(db, "notifications"));
            transaction.set(notifRef, {
                uid: review.reviewee_uid,
                user_id: review.reviewee_uid,
                title: "¡Nueva Reseña! ⭐",
                message: `Has recibido una calificación de ${review.rating} estrellas por la operación #${tradeId.slice(-6).toUpperCase()}.`,
                read: false,
                timestamp: serverTimestamp(),
                order_id: tradeId,
                type: "order",
                link: `/perfil?order=${tradeId}`
            });
        });
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

            const tradeData = tradeSnap.data() as any;
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

            // 4. Notification for Winner - V43.1 Dual-Write
            const winnerId = proposalSnap.data()?.senderId;
            if (winnerId) {
                const notifRef = doc(collection(db, "notifications"));
                transaction.set(notifRef, {
                    uid: winnerId,
                    user_id: winnerId,
                    title: "¡Oferta Ganadora! 🎉",
                    message: `Tu propuesta para el intercambio #${tradeId.slice(-6).toUpperCase()} fue aceptada.`,
                    read: false,
                    timestamp: serverTimestamp(),
                    order_id: tradeId,
                    type: "order",
                    link: `/perfil?order=${tradeId}`
                });
            }

            // INVARIANT: Transfer items (Phase IV Optimization)
            // Here we would ideally loop through proposal manifest items 
            // and update userAssets status to 'sold' or transfer owner,
            // or decrement inventory stock if applicable.
        });
    },

    async executeDirectPurchase(tradeId: string, buyerUid: string, buyerName: string) {
        const tradeRef = doc(db, COLLECTION_NAME, tradeId);
        
        const buyerUsername = buyerName.startsWith('@') ? buyerName : `@${buyerName}`;
        const tradeSnap = await getDoc(tradeRef);
        if (!tradeSnap.exists()) throw new Error("TRADE_NOT_FOUND");
        
        const tradeData = tradeSnap.data() as any;
        
        let discoId = tradeId;
        if (tradeData.manifest?.requestedItems?.[0]) {
            discoId = tradeData.manifest.requestedItems[0];
        }

        let sellerId = tradeData.participants?.receiverId;
        const assetSnap = await getDoc(doc(db, "user_assets", discoId));
        
        if (assetSnap.exists()) {
            const assetData = assetSnap.data() as any;
            sellerId = assetData.ownerId || assetData.uid;
            console.log(`[V45-FIX] Buscando disco con ID: ${discoId} | Propietario real: ${sellerId} (Purchase Flow)`);
        } else if (tradeData.is_admin_offer) {
            sellerId = ADMIN_UID;
        }

        if (!sellerId) {
            console.error(`[V46-HARDLINK] executeDirectPurchase failed: No owner found for item ${discoId}`);
            throw new Error("SISTEMA_IDENTIDAD_PARTICIPANTE_REQUERIDO");
        }

        let sellerUsername = "Vendedor";
        const sellerDoc = await getDoc(doc(db, "users", sellerId));
        if (sellerDoc.exists()) {
            const sData = sellerDoc.data();
            sellerUsername = sData.username ? (sData.username.startsWith('@') ? sData.username : `@${sData.username}`) : sData.display_name || "Vendedor";
        }

        await runTransaction(db, async (transaction) => {
            const currentTradeSnap = await transaction.get(tradeRef);
            if (!currentTradeSnap.exists()) throw new Error("TRADE_NOT_FOUND");
            
            const currentTradeData = currentTradeSnap.data() as any;
            if (currentTradeData.status !== "pending") throw new Error("TRADE_NOT_AVAILABLE");

            // 1. Update Parent Trade
            transaction.update(tradeRef, {
                status: "accepted",
                isPaid: false,
                payment_status: 'pending',
                highest_bidder_uid: buyerUid,
                highest_bidder_name: buyerUsername,
                acceptedAt: serverTimestamp(),
                currentTurn: currentTradeData.participants?.senderId
            });

            // 2. Native V2 Chat Logic
            const chatId = `${tradeId}_${buyerUid}`;
            const p2pChatRef = doc(db, "p2p_chats", chatId);
            
            const chatData = {
                id: chatId,
                buyerId: buyerUid,
                buyerUsername: buyerUsername,
                buyerName: buyerUsername,
                sellerId: sellerId,
                sellerUsername: sellerUsername,
                tradeId: tradeId,
                title: currentTradeData.manifest?.items?.[0]?.title || currentTradeData.details?.album || "Disco",
                cover: currentTradeData.manifest?.items?.[0]?.cover_image || currentTradeData.media?.thumbnail || "",
                status: "accepted",
                lastMessage: "¡Venta Directa confirmada!",
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp(),
                participants: [buyerUid, sellerId]
            };

            // 3. Set Native P2PChat
            transaction.set(p2pChatRef, chatData, { merge: true });

            // 4. Automated V2 Message
            const p2pMessageRef = doc(collection(db, "p2p_chats", chatId, "messages"));
            const systemMessage = {
                sender_uid: "system",
                text: `¡Hola! ${buyerUsername} ha comprado este disco mediante Venta Directa. Coordinen aquí el envío.`,
                timestamp: serverTimestamp(),
                read_status: false
            };

            transaction.set(p2pMessageRef, systemMessage);

            // 5. Notification for Seller (Buy Now Success) - V43.1 Dual-Write
            const notifRef = doc(collection(db, "notifications"));
            transaction.set(notifRef, {
                uid: sellerId,
                user_id: sellerId,
                title: "¡Venta Directa! 💰",
                message: `${buyerUsername} compró "${currentTradeData.manifest?.items?.[0]?.title || 'tu disco'}". Coordinen el envío.`,
                read: false,
                timestamp: serverTimestamp(),
                order_id: tradeId,
                type: "chat",
                link: `/mensajes?chat=${chatId}`
            });
        });
    },

    async cancelAdjudication(tradeId: string, chatId: string) {
        const tradeRef = doc(db, COLLECTION_NAME, tradeId);
        const p2pChatRef = doc(db, "p2p_chats", chatId);
        const systemMessageRef = doc(collection(db, "p2p_chats", chatId, "messages"));

        await runTransaction(db, async (transaction) => {
            const tradeSnap = await transaction.get(tradeRef);
            if (!tradeSnap.exists()) throw new Error("TRADE_NOT_FOUND");

            // 1. Revert Trade Status
            transaction.update(tradeRef, {
                status: "pending",
                buyer_uid: deleteField(),
                buyer_name: deleteField(),
                "participants.receiverId": deleteField(),
                acceptedAt: deleteField(),
                payment_status: deleteField(),
                updatedAt: serverTimestamp()
            });

            // 2. Update Chat Status
            transaction.update(p2pChatRef, {
                status: "cancelled",
                lastMessage: "⚠️ Reserva cancelada por el vendedor.",
                updatedAt: serverTimestamp()
            });

            // 3. System Message
            transaction.set(systemMessageRef, {
                sender_uid: "system",
                text: "⚠️ El vendedor ha cancelado la reserva de este disco. La operación ha sido anulada y el ítem vuelve a estar disponible para otros interesados.",
                timestamp: serverTimestamp(),
                read_status: false
            });
        });
    },

    /**
     * Listen for P2P chats where user is a participant (Inbox V2)
     */
    onSnapshotP2PChats(userId: string, callback: (chats: any[]) => void) {
        console.log(`[InboxV2] Listening for chats for user: ${userId}`);
        const q = query(
            collection(db, "p2p_chats"),
            where("participants", "array-contains", userId),
            orderBy("updatedAt", "desc")
        );

        return onSnapshot(q, (snapshot) => {
            const chats = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(chats);
        }, (error) => {
            console.error("[InboxV2] Snapshot error:", error);
        });
    },

    /**
     * Listen for messages in a specific P2P chat (Inbox V2)
     */
    onSnapshotP2PMessages(chatId: string, callback: (messages: any[]) => void) {
        console.log(`[InboxV2] New listener for chat messages: ${chatId}`);
        const q = query(
            collection(db, "p2p_chats", chatId, "messages"),
            orderBy("timestamp", "asc")
        );

        return onSnapshot(q, (snapshot) => {
            const messages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(messages);
        }, (error) => {
            console.error("[InboxV2] Messages snapshot error:", error);
        });
    },

    /**
     * Listen for all P2P chats associated with a specific trade (V2)
     * Used by sellers to see inquiries from multiple buyers for one publication.
     */
    onSnapshotTradeChats(tradeId: string, callback: (chats: any[]) => void) {
        console.log(`[InboxV2] Listening for all chats of trade: ${tradeId}`);
        const q = query(
            collection(db, "p2p_chats"),
            where("tradeId", "==", tradeId),
            orderBy("updatedAt", "desc")
        );

        return onSnapshot(q, (snapshot) => {
            const chats = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(chats);
        }, (error) => {
            console.error("[InboxV2] TradeChats snapshot error:", error);
        });
    },
    
    /**
     * Listener para detectar qué activos están bloqueados (en negociación o reservados)
     * V63.0: Devuelve un objeto con dos arrays de IDs.
     */
    onSnapshotBlockedAssets(callback: (data: { negotiating: string[], reserved: string[] }) => void) {
        console.log("[tradeService] Escuchando bloqueos de activos...");
        const q = query(
            collection(db, "trades"),
            where("status", "in", ["pending", "pending_payment", "accepted"])
        );

        return onSnapshot(q, (snapshot) => {
            const negotiating: string[] = [];
            const reserved: string[] = [];

            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data() as any;
                const items = data.manifest?.requestedItems || [];
                
                if (data.status === "pending_payment" || data.status === "accepted") {
                    reserved.push(...items.map(String));
                } else if (data.status === "pending") {
                    negotiating.push(...items.map(String));
                }
            });

            callback({
                negotiating: Array.from(new Set(negotiating)),
                reserved: Array.from(new Set(reserved))
            });
        }, (error) => {
            console.error("[tradeService] Error en snapshot de bloqueos:", error);
        });
    }
};
