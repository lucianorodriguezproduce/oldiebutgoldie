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
    arrayUnion
} from "firebase/firestore";


import type { Trade, InventoryItem } from "@/types/inventory";

const COLLECTION_NAME = "trades";
const ADMIN_UID = "oldiebutgoldie"; // Internal reference for B2C

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
                artist: data.metadata.artist,
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
        "accepted": "negotiating",
        "completed": "completed",
        "cancelled": "cancelled"
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
        thumbnailUrl: firstItem.cover_image
    };
};

export const tradeService = {
    async createTrade(trade: Omit<Trade, 'id' | 'timestamp' | 'status' | 'currentTurn' | 'negotiationHistory'>) {
        const tradeData = {
            ...trade,
            participants: {
                ...trade.participants,
                receiverId: trade.participants.receiverId || ADMIN_UID
            },
            status: "pending" as const,
            currentTurn: trade.participants.receiverId || ADMIN_UID, // First turn goes to receiver (usually admin)
            negotiationHistory: [],
            timestamp: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, COLLECTION_NAME), tradeData);
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
    },


    async getUserTrades(userId: string) {
        // Fetch trades where user is sender
        const qSender = query(collection(db, COLLECTION_NAME), where("participants.senderId", "==", userId));
        const qReceiver = query(collection(db, COLLECTION_NAME), where("participants.receiverId", "==", userId));

        const [snapSender, snapReceiver] = await Promise.all([
            getDocs(qSender),
            getDocs(qReceiver)
        ]);

        const rawTrades = [
            ...snapSender.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trade)),
            ...snapReceiver.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trade))
        ];

        // Transmutación Silenciosa
        const legacyTrades = await Promise.all(rawTrades.map(t => bunkerToLegacy(t)));

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

    async resolveTrade(tradeId: string, manifest: Trade['manifest']) {
        // 1. Reserve items from Admin stock (those requested by the user)
        for (const itemId of manifest.requestedItems) {
            const response = await fetch('/api/inventory/reserve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, quantity: 1 })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(`Error en reserva de ítem ${itemId}: ${err.error}`);
            }
        }

        // 2. Update status to accepted
        await this.updateTradeStatus(tradeId, 'accepted');
    }

};

