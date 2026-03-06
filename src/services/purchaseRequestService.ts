import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from "firebase/firestore";

const COLLECTION_NAME = "purchase_requests";

export interface PurchaseRequest {
    id?: string;
    uid: string;
    userEmail: string;
    userName?: string;
    item: {
        id: string | number;
        title: string;
        artist: string;
        cover_image: string;
        type: string;
        uri?: string;
    };
    status: 'pending' | 'processing' | 'completed' | 'cancelled';
    timestamp: any;
    lastUpdated?: any;
    notes?: string;
    transactionId?: string; // Relation field
}

export const purchaseRequestService = {
    async createRequest(uid: string, userEmail: string, userName: string, item: any, transactionId?: string) {
        const requestData: Omit<PurchaseRequest, 'id'> = {
            uid,
            userEmail,
            userName,
            item: {
                id: item.id,
                title: item.normalizedAlbum || item.title,
                artist: item.normalizedArtist || "Varios",
                cover_image: item.cover_image || item.thumb || "",
                type: item.type || 'release',
                uri: item.uri || ""
            },
            status: 'pending',
            timestamp: serverTimestamp(),
            transactionId
        };

        const docRef = await addDoc(collection(db, COLLECTION_NAME), requestData);
        return docRef.id;
    },

    async getUserRequests(uid: string) {
        const q = query(
            collection(db, COLLECTION_NAME),
            where("uid", "==", uid),
            orderBy("timestamp", "desc")
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseRequest));
    },

    async getAllRequests() {
        const q = query(collection(db, COLLECTION_NAME), orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseRequest));
    }
};
