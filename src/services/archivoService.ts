import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, limit, startAfter, orderBy } from "firebase/firestore";
import type { InventoryItem, UserAsset } from "@/types/inventory";
import type { EditorialBlock } from "@/types/editorial";

export interface UnifiedItem {
    id: string;
    title: string;
    artist: string;
    year: number | string;
    image: string;
    full_res_image?: string;
    source: 'inventory' | 'user_assets' | 'hardware_inventory';
    price?: number;
    valuation?: number;
    stock?: number;
    genres?: string[];
    styles?: string[];
    format?: string;
    condition?: string;
    // V12.0 Extended Metadata
    tracklist?: { position: string; title: string; duration: string }[];
    labels?: { name: string; catno: string }[];
    youtube_id?: string;
    spotify_id?: string;
    bpm?: number;
    key?: string;
    wants?: number;
    have?: number;
    notes?: string;
    preview_url?: string;
    status_warning?: string;
    blocks?: EditorialBlock[];
    isBatch?: boolean;
    items?: any[];
    sellerId?: string;
}

import { emitHealthEvent } from "@/context/HealthContext";

const CACHE_KEY_PREFIX = "obg_archivo_cache_";

export const archivoService = {
    async getItemById(id: string): Promise<UnifiedItem | null> {
        // 1. SWR: Try cache first
        const cacheKey = `${CACHE_KEY_PREFIX}item_${id}`;
        const cached = localStorage.getItem(cacheKey);
        let cachedResult: UnifiedItem | null = null;
        if (cached) {
            try {
                cachedResult = JSON.parse(cached);
            } catch {
                localStorage.removeItem(cacheKey);
            }
        }

        // 2. Fetch from Source (Always executed to revalidate)
        const fetchSource = async () => {
            const start = performance.now();
            
            // Try Inventory first
            let itemRef = doc(db, "inventory", id);
            let itemSnap = await getDoc(itemRef);
            let source: 'inventory' | 'user_assets' | 'hardware_inventory' = 'inventory';

            // Try Hardware Inventory (Gear) if not in Vinyl/Main
            if (!itemSnap.exists()) {
                itemRef = doc(db, "hardware_inventory", id);
                itemSnap = await getDoc(itemRef);
                source = 'hardware_inventory';
            }

            emitHealthEvent('firebase', performance.now() - start);

            if (itemSnap.exists()) {
                const data = itemSnap.data() as InventoryItem;
                
                // Protocol V106: Resolve optimized image if available
                const image = data.media.optimized_thumb || data.media.full_res_image_url || data.media.thumbnail;

                const result: UnifiedItem = {
                    id: itemSnap.id,
                    title: data.metadata.title,
                    artist: data.metadata.artist,
                    year: data.metadata.year,
                    image: image,
                    full_res_image: data.media.optimized_detail || data.media.full_res_image_url,
                    source: source === 'hardware_inventory' ? 'inventory' : source as any, // Map to inventory for UI consistency if needed, or keep discrete
                    price: data.logistics.price,
                    stock: data.logistics.stock, // Added stock
                    genres: data.metadata.genres,
                    styles: data.metadata.styles,
                    format: data.metadata.format_description,
                    condition: data.logistics.condition,
                    tracklist: data.tracklist,
                    labels: data.labels,
                    youtube_id: data.metadata.youtube_id,
                    spotify_id: data.metadata.spotify_id,
                    bpm: data.metadata.bpm,
                    key: data.metadata.key,
                    wants: data.metadata.wants,
                    have: data.metadata.have,
                    notes: data.metadata.notes,
                    blocks: data.blocks,
                    isBatch: data.metadata.isBatch,
                    items: data.items
                };
                localStorage.setItem(cacheKey, JSON.stringify(result));
                return result;
            }

            // Fallback to User Assets
            try {
                const assetRef = doc(db, "user_assets", id);
                const assetSnap = await getDoc(assetRef);
                if (assetSnap.exists()) {
                    const data = assetSnap.data() as UserAsset;
                    const result: UnifiedItem = {
                        id: assetSnap.id,
                        title: data.metadata.title,
                        artist: data.metadata.artist,
                        year: data.metadata.year,
                        image: data.media.optimized_thumb || data.media.full_res_image_url || data.media.thumbnail,
                        full_res_image: data.media.optimized_detail || data.media.full_res_image_url,
                        source: 'user_assets',
                        valuation: data.logistics?.price || (data as any).valuation,
                        stock: data.logistics?.stock ?? 1,
                        genres: data.metadata.genres,
                        styles: data.metadata.styles,
                        format: data.metadata.format_description,
                        condition: data.logistics?.condition || (data.metadata.isBatch ? 'MIXTO' : 'USADO'),
                        tracklist: data.tracklist,
                        labels: data.labels,
                        youtube_id: data.metadata.youtube_id,
                        bpm: data.metadata.bpm,
                        key: data.metadata.key,
                        wants: data.metadata.wants,
                        have: data.metadata.have,
                        notes: data.metadata.notes,
                        status_warning: data.metadata.status_warning,
                        isBatch: data.metadata.isBatch,
                        items: data.items,
                        sellerId: data.ownerId
                    };
                    localStorage.setItem(cacheKey, JSON.stringify(result));
                    return result;
                }
            } catch (e) {
                console.warn("Asset no encontrado o acceso denegado.");
            }
            return null;
        };

        const resultPromise = fetchSource();

        if (cachedResult) {
            // Background fetch to update cache, but return immediately
            resultPromise.catch(console.error);
            return cachedResult;
        }

        return await resultPromise;
    },

    async getCombinedPaged(pageSize: number = 20, lastDocs?: { inventory?: any, user_assets?: any }) {
        const cacheKey = `${CACHE_KEY_PREFIX}paged_${lastDocs ? 'next' : 'root'}`;

        // SWR Logic: Return cached immediately if root call
        if (!lastDocs && localStorage.getItem(cacheKey)) {
            // We return a promise that resolves but also trigger the background refresh
            // In a real SWR hook this is cleaner, here we do it service-side
        }

        const invQuery = query(
            collection(db, "inventory"),
            where("logistics.status", "==", "active"),
            orderBy("timestamp", "desc"),
            limit(pageSize / 2)
        );

        const assetQuery = query(
            collection(db, "user_assets"),
            where("logistics.status", "==", "active"),
            orderBy("acquiredAt", "desc"),
            limit(pageSize / 2)
        );

        const [invResult, assetResult] = await Promise.allSettled([
            getDocs(lastDocs?.inventory ? query(invQuery, startAfter(lastDocs.inventory)) : invQuery),
            getDocs(lastDocs?.user_assets ? query(assetQuery, startAfter(lastDocs.user_assets)) : assetQuery)
        ]);

        const invSnap = invResult.status === 'fulfilled' ? invResult.value : null;
        const assetSnap = assetResult.status === 'fulfilled' ? assetResult.value : null;

        if (invResult.status === 'rejected') console.error("Archive: Inventory fetch failed", invResult.reason);
        if (assetResult.status === 'rejected') console.error("Archive: Assets fetch failed", assetResult.reason);

        const inventoryItems: UnifiedItem[] = invSnap ? invSnap.docs.map(doc => {
            const data = doc.data() as InventoryItem;
            return {
                id: doc.id,
                title: data.metadata.title,
                artist: data.metadata.artist,
                year: data.metadata.year,
                image: data.media.thumbnail,
                source: 'inventory',
                price: data.logistics.price,
                tracklist: data.tracklist,
                labels: data.labels,
                youtube_id: data.metadata.youtube_id,
                spotify_id: data.metadata.spotify_id,
                bpm: data.metadata.bpm,
                key: data.metadata.key,
                wants: data.metadata.wants,
                have: data.metadata.have,
                notes: data.metadata.notes,
                isBatch: data.metadata.isBatch,
                items: data.items,
                preview_url: data.metadata.preview_url
            };
        }) : [];

        const assetItems: UnifiedItem[] = assetSnap ? assetSnap.docs.map(doc => {
            const data = doc.data() as UserAsset;
            return {
                id: doc.id,
                title: data.metadata.title,
                artist: data.metadata.artist,
                year: data.metadata.year,
                image: data.media.thumbnail,
                source: 'user_assets',
                valuation: data.logistics?.price || (data as any).valuation,
                tracklist: data.tracklist,
                labels: data.labels,
                youtube_id: data.metadata.youtube_id,
                spotify_id: data.metadata.spotify_id,
                bpm: data.metadata.bpm,
                key: data.metadata.key,
                wants: data.metadata.wants,
                have: data.metadata.have,
                notes: data.metadata.notes,
                status_warning: data.metadata.status_warning,
                isBatch: data.metadata.isBatch,
                items: data.items,
                preview_url: data.metadata.preview_url,
                sellerId: data.ownerId
            };
        }) : [];

        // Interleave (Already O(n+m))
        const combined: UnifiedItem[] = [];
        const length = Math.max(inventoryItems.length, assetItems.length);
        for (let i = 0; i < length; i++) {
            if (i < inventoryItems.length) combined.push(inventoryItems[i]);
            if (i < assetItems.length) combined.push(assetItems[i]);
        }

        const response = {
            items: combined,
            lastDocs: {
                inventory: invSnap?.docs[invSnap.docs.length - 1] || null,
                user_assets: assetSnap?.docs[assetSnap.docs.length - 1] || null
            },
            hasMore: (invSnap?.docs.length || 0) > 0 || (assetSnap?.docs.length || 0) > 0
        };

        if (!lastDocs) {
            localStorage.setItem(cacheKey, JSON.stringify({
                items: combined.map(i => ({ ...i, cached: true })),
                hasMore: response.hasMore
            }));
        }

        return response;
    }
};
