import { db } from "@/lib/firebase";
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    addDoc,
    serverTimestamp,
    orderBy
} from "firebase/firestore";
import type { UserAsset } from "@/types/inventory";

const COLLECTION_NAME = "user_assets";

export const userAssetService = {
    /**
     * Obtiene la colección personal de un usuario
     */
    async getUserAssets(userId: string): Promise<UserAsset[]> {
        const q = query(
            collection(db, COLLECTION_NAME),
            where("ownerId", "==", userId),
            where("status", "==", "active"),
            orderBy("acquiredAt", "desc")
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserAsset));
    },

    /**
     * Activa/Desactiva un ítem para intercambio público
     */
    async toggleTradeable(assetId: string, isTradeable: boolean, valuation?: number) {
        const docRef = doc(db, COLLECTION_NAME, assetId);
        const updateData: any = { isTradeable };
        if (valuation !== undefined) updateData.valuation = valuation;

        await updateDoc(docRef, updateData);
    },

    /**
     * Añade un ítem a la batea personal del usuario
     */
    async addAsset(userId: string, assetData: {
        metadata: any;
        media: any;
        originalInventoryId?: string;
        valuation?: number;
    }) {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ownerId: userId,
            originalInventoryId: assetData.originalInventoryId || '',
            metadata: assetData.metadata,
            media: assetData.media,
            valuation: assetData.valuation || 0,
            stock: 1,
            isTradeable: false,
            status: 'active',
            acquiredAt: serverTimestamp()
        });
        return docRef.id;
    },

    /**
     * Obtiene todos los activos marcados como intercambiables de la comunidad
     */
    async getMarketplaceAssets(): Promise<UserAsset[]> {
        const q = query(
            collection(db, COLLECTION_NAME),
            where("isTradeable", "==", true),
            where("status", "==", "active")
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserAsset));
    },

    /**
     * Actualiza el stock de un activo del usuario
     */
    async updateStock(assetId: string, newStock: number) {
        const docRef = doc(db, COLLECTION_NAME, assetId);
        await updateDoc(docRef, { stock: Math.max(0, newStock) });
    },

    /**
     * Obtiene un activo individual por su ID de documento
     */
    async getAssetById(assetId: string): Promise<UserAsset | null> {
        const docRef = doc(db, COLLECTION_NAME, assetId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as UserAsset;
    }
};
