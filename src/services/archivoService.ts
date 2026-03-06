import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, limit, startAfter, orderBy } from "firebase/firestore";
import type { InventoryItem, UserAsset } from "@/types/inventory";

export interface UnifiedItem {
    id: string;
    title: string;
    artist: string;
    year: number | string;
    image: string;
    source: 'inventory' | 'user_assets';
    price?: number;
    valuation?: number;
    genres?: string[];
    styles?: string[];
    format?: string;
    condition?: string;
}

export const archivoService = {
    async getItemById(id: string): Promise<UnifiedItem | null> {
        // Try inventory first
        const invRef = doc(db, "inventory", id);
        const invSnap = await getDoc(invRef);
        if (invSnap.exists()) {
            const data = invSnap.data() as InventoryItem;
            return {
                id: invSnap.id,
                title: data.metadata.title,
                artist: data.metadata.artist,
                year: data.metadata.year,
                image: data.media.full_res_image_url || data.media.thumbnail,
                source: 'inventory',
                price: data.logistics.price,
                genres: data.metadata.genres,
                styles: data.metadata.styles,
                format: data.metadata.format_description,
                condition: data.logistics.condition
            };
        }

        // Try user_assets
        const assetRef = doc(db, "user_assets", id);
        const assetSnap = await getDoc(assetRef);
        if (assetSnap.exists()) {
            const data = assetSnap.data() as UserAsset;
            return {
                id: assetSnap.id,
                title: data.metadata.title,
                artist: data.metadata.artist,
                year: data.metadata.year,
                image: data.media.full_res_image_url || data.media.thumbnail,
                source: 'user_assets',
                valuation: data.valuation,
                genres: data.metadata.genres,
                styles: data.metadata.styles,
                format: data.metadata.format_description,
                condition: (data.metadata as any).condition || 'USADO'
            };
        }

        return null;
    },

    async getCombinedPaged(pageSize: number = 20, lastDocs?: { inventory?: any, user_assets?: any }) {
        // Since we can't easily merge-sort paged results from two collections in Firestore without a common index,
        // we'll fetch from both and interleave them in the client for this "Archive" view.

        const invQuery = query(
            collection(db, "inventory"),
            where("logistics.status", "==", "active"),
            orderBy("timestamp", "desc"),
            limit(pageSize / 2)
        );

        const assetQuery = query(
            collection(db, "user_assets"),
            where("status", "==", "active"),
            orderBy("acquiredAt", "desc"),
            limit(pageSize / 2)
        );

        const [invSnap, assetSnap] = await Promise.all([
            getDocs(lastDocs?.inventory ? query(invQuery, startAfter(lastDocs.inventory)) : invQuery),
            getDocs(lastDocs?.user_assets ? query(assetQuery, startAfter(lastDocs.user_assets)) : assetQuery)
        ]);

        const inventoryItems: UnifiedItem[] = invSnap.docs.map(doc => {
            const data = doc.data() as InventoryItem;
            return {
                id: doc.id,
                title: data.metadata.title,
                artist: data.metadata.artist,
                year: data.metadata.year,
                image: data.media.thumbnail,
                source: 'inventory',
                price: data.logistics.price
            };
        });

        const assetItems: UnifiedItem[] = assetSnap.docs.map(doc => {
            const data = doc.data() as UserAsset;
            return {
                id: doc.id,
                title: data.metadata.title,
                artist: data.metadata.artist,
                year: data.metadata.year,
                image: data.media.thumbnail,
                source: 'user_assets',
                valuation: data.valuation
            };
        });

        // Interleave
        const combined: UnifiedItem[] = [];
        const max = Math.max(inventoryItems.length, assetItems.length);
        for (let i = 0; i < max; i++) {
            if (i < inventoryItems.length) combined.push(inventoryItems[i]);
            if (i < assetItems.length) combined.push(assetItems[i]);
        }

        return {
            items: combined,
            lastDocs: {
                inventory: invSnap.docs[invSnap.docs.length - 1],
                user_assets: assetSnap.docs[assetSnap.docs.length - 1]
            },
            hasMore: invSnap.docs.length > 0 || assetSnap.docs.length > 0
        };
    }
};
