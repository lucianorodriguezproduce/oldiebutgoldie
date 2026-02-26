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


import type { Trade } from "@/types/inventory";

const COLLECTION_NAME = "trades";
const ADMIN_UID = "oldiebutgoldie"; // Internal reference for B2C

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

        const trades = [
            ...snapSender.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trade)),
            ...snapReceiver.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trade))
        ];

        // Sort by timestamp localy if needed or just return
        return trades.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
    },


    async getTradeById(id: string) {
        const snapshot = await getDocs(query(collection(db, COLLECTION_NAME), where("__name__", "==", id)));
        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as Trade;
    },

    async getTrades() {
        const q = query(collection(db, COLLECTION_NAME), orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trade));
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

