import { db } from "@/lib/firebase";
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    addDoc,
    serverTimestamp,
    orderBy
} from "firebase/firestore";
import type { UserAsset } from "@/types/inventory";
import { pushAssetCreated } from "@/utils/analytics";

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

        // Tracking DataLayer
        pushAssetCreated(userId, docRef.id, assetData.metadata?.title || 'Sin Título');

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
    },

    /**
     * Promueve un asset de usuario (admin collection) hacia el inventario general
     */
    async promoteToInventory(assetId: string, options: { price: number, condition: string, tags?: string[], format?: string }) {
        const assetRef = doc(db, COLLECTION_NAME, assetId);
        const snap = await getDoc(assetRef);
        if (!snap.exists()) throw new Error("Asset no encontrado");

        const assetData = snap.data() as UserAsset;

        // Crear documento en inventario
        const inventoryRef = doc(collection(db, "inventory"));
        await setDoc(inventoryRef, {
            id: inventoryRef.id,
            metadata: {
                ...assetData.metadata,
                format_description: options.format || assetData.metadata.format_description || "Vinilo",
                type: "album",
                tags: options.tags || ["Colección OBG"]
            },
            media: {
                thumbnail: assetData.media?.thumbnail || "",
                full_res_image_url: assetData.media?.full_res_image_url || "https://raw.githubusercontent.com/lucianorodriguezproduce/buscadordiscogs2/refs/heads/main/public/obg.png"
            },
            logistics: {
                price: options.price,
                stock: 1,
                status: "active",
                condition: options.condition,
                discount: 0
            },
            reference: assetData.reference || {
                originalDiscogsId: 0,
                originalDiscogsUrl: ""
            },
            tracklist: assetData.tracklist || [],
            labels: assetData.labels || [],
            items: assetData.items || [],
            source: {
                type: "obg_collection",
                originalAssetId: assetId
            },
            timestamp: serverTimestamp(),
            createdAt: serverTimestamp()
        });

        // Marcar el asset original como promovido para no borrarlo pero ocultarlo
        await updateDoc(assetRef, {
            status: "promoted",
            promotedInventoryId: inventoryRef.id,
            promotedAt: serverTimestamp()
        });

        return inventoryRef.id;
    }
};
