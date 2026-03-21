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
        return snapshot.docs.map(doc => {
            const data = doc.data() as any;
            if (!data.logistics && (data.valuation !== undefined || data.stock !== undefined)) {
                return {
                    id: doc.id,
                    ...data,
                    logistics: {
                        price: data.valuation || 0,
                        stock: data.stock || 1,
                        condition: data.metadata?.condition || 'M/NM',
                        status: data.status || 'active',
                        isTradeable: data.isTradeable || false
                    }
                } as UserAsset;
            }
            return { id: doc.id, ...data } as UserAsset;
        });
    },

    /**
     * Activa/Desactiva un ítem para intercambio público
     */
    async toggleTradeable(assetId: string, isTradeable: boolean, price?: number) {
        const docRef = doc(db, COLLECTION_NAME, assetId);
        const updateData: any = { 
            "logistics.isTradeable": isTradeable 
        };
        if (price !== undefined) updateData["logistics.price"] = price;

        await updateDoc(docRef, updateData);
    },

    /**
     * Añade un ítem a la batea personal del usuario
     */
    async addAsset(userId: string, assetData: Partial<UserAsset>) {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ownerId: userId,
            uid: userId, 
            originalInventoryId: assetData.originalInventoryId || '',
            metadata: assetData.metadata,
            media: assetData.media,
            logistics: {
                price: assetData.logistics?.price || 0,
                stock: assetData.logistics?.stock || 1,
                condition: assetData.logistics?.condition || 'M/NM',
                status: 'active',
                isTradeable: assetData.logistics?.isTradeable || false
            },
            reference: assetData.reference || null,
            tracklist: assetData.tracklist || [],
            labels: assetData.labels || [],
            items: assetData.items || [],
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
            where("logistics.isTradeable", "==", true),
            where("logistics.status", "==", "active")
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data() as any;
            if (!data.logistics) {
                // Fallback for non-migrated items (should be rare for marketplace)
                return {
                    id: doc.id,
                    ...data,
                    logistics: {
                        price: data.valuation || 0,
                        stock: data.stock || 1,
                        condition: data.metadata?.condition || 'M/NM',
                        status: data.status || 'active',
                        isTradeable: data.isTradeable || false
                    }
                } as UserAsset;
            }
            return { id: doc.id, ...data } as UserAsset;
        });
    },

    /**
     * Actualiza el stock de un activo del usuario
     */
    async updateStock(assetId: string, newStock: number) {
        const docRef = doc(db, COLLECTION_NAME, assetId);
        await updateDoc(docRef, { "logistics.stock": Math.max(0, newStock) });
    },

    /**
     * Obtiene un activo individual por su ID de documento
     */
    async getAssetById(assetId: string): Promise<UserAsset | null> {
        const docRef = doc(db, COLLECTION_NAME, assetId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;
        const data = snap.data() as any;
        if (!data.logistics) {
            return {
                id: snap.id,
                ...data,
                logistics: {
                    price: data.valuation || 0,
                    stock: data.stock || 1,
                    condition: data.metadata?.condition || 'M/NM',
                    status: data.status || 'active',
                    isTradeable: data.isTradeable || false
                }
            } as UserAsset;
        }
        return { id: snap.id, ...data } as UserAsset;
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
    },

    /**
     * Obtiene la lista de usuarios que tienen al menos un item activo en su batea
     */
    async getUsersWithAssets(): Promise<any[]> {
        const q = query(
            collection(db, "users"),
            where("stats.collectionItemCount", ">", 0)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
    }
};
