import { db } from "@/lib/firebase";
import {
    collection,
    query,
    where,
    getDocs,
    doc,
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
    }
};
