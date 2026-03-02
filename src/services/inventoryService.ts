import { db } from "@/lib/firebase";
import { discogsService } from "@/lib/discogs";
import {
    collection,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    query,
    where,
    getDocs,
    serverTimestamp,
    orderBy,
    limit,
    startAfter
} from "firebase/firestore";
import type { InventoryItem } from "@/types/inventory";

const COLLECTION_NAME = "inventory";

export const inventoryService = {
    async getItems() {
        const q = query(collection(db, COLLECTION_NAME), where("logistics.status", "==", "active"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
    },

    async getItemById(id: string) {
        const docRef = doc(db, COLLECTION_NAME, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as InventoryItem;
        }
        return null;
    },

    async createItem(item: Omit<InventoryItem, 'id'>) {
        const id = crypto.randomUUID();
        const docRef = doc(db, COLLECTION_NAME, id);
        await setDoc(docRef, {
            ...item,
            id,
            timestamp: serverTimestamp()
        });
        return id;
    },

    async createBatch(batchData: {
        title: string,
        price: number,
        stock: number,
        items: any[]
    }) {
        const id = crypto.randomUUID();
        const firstItem = batchData.items[0];

        // Use the first item's image as batch thumbnail
        const newItem: InventoryItem = {
            id,
            metadata: {
                title: batchData.title,
                artist: "Varios",
                year: new Date().getFullYear(),
                country: "Argentina",
                genres: [],
                styles: [],
                format_description: "Lote Especial",
                isBatch: true
            },
            media: {
                thumbnail: firstItem.thumb || "",
                full_res_image_url: firstItem.full_res_image_url || firstItem.thumb || ""
            },
            reference: {
                originalDiscogsId: 0,
                originalDiscogsUrl: ""
            },
            logistics: {
                stock: batchData.stock,
                price: batchData.price,
                condition: "Mixed",
                status: "active"
            },
            items: batchData.items
        };

        const docRef = doc(db, COLLECTION_NAME, id);
        await setDoc(docRef, {
            ...newItem,
            timestamp: serverTimestamp()
        });
        return id;
    },

    /**
     * Clones a Discogs release and persists it into the local inventory.
     * This is the "Bunker Entry" process.
     */
    async importFromDiscogs(discogsData: any, logistics: InventoryItem['logistics']) {
        const internalId = crypto.randomUUID();

        // 1. Resolve High-Res Image (via Bunker Import API)
        let fullResUrl = discogsData.images?.[0]?.resource_url || discogsData.images?.[0]?.uri || discogsData.cover_image || discogsData.thumb;

        try {
            const response = await fetch('/api/bunker/import_image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: fullResUrl, itemId: internalId })
            });
            if (response.ok) {
                const data = await response.json();
                fullResUrl = data.url;
            }
        } catch (error) {
            console.error("Failed to import image to Storage, using original URL line-of-sight:", error);
        }

        // 2. Fetch Original Year from Master if available
        let originalYear = parseInt(discogsData.year) || 0;
        if (discogsData.master_id) {
            try {
                const master = await discogsService.getMasterDetails(discogsData.master_id);
                if (master && master.year) {
                    originalYear = master.year;
                    console.log(`[Bunker-Import] Found Original Year for ${discogsData.title}: ${originalYear}`);
                }
            } catch (e) {
                console.warn(`[Bunker-Import] Could not fetch master ${discogsData.master_id} for original year.`);
            }
        }

        const newItem: InventoryItem = {
            id: internalId,
            metadata: {
                title: discogsData.title || "Unknown Title",
                artist: discogsData.artists?.[0]?.name || discogsData.artist || "Unknown Artist",
                year: parseInt(discogsData.year) || 0,
                original_year: originalYear,
                country: discogsData.country || "Unknown",
                genres: discogsData.genres || [],
                styles: discogsData.styles || [],
                format_description: Array.isArray(discogsData.formats)
                    ? discogsData.formats.map((f: any) => f.name).join(", ")
                    : discogsData.format || "Unknown Format"
            },
            media: {
                thumbnail: discogsData.thumb || "",
                full_res_image_url: fullResUrl
            },
            reference: {
                originalDiscogsId: discogsData.id,
                originalDiscogsUrl: discogsData.uri || `https://www.discogs.com/release/${discogsData.id}`
            },
            logistics: {
                ...logistics,
                status: logistics.stock > 0 ? "active" : "sold_out"
            },
            tracklist: discogsData.tracklist?.map((t: any) => ({
                position: t.position || "",
                title: t.title || "",
                duration: t.duration || ""
            })),
            labels: discogsData.labels?.map((l: any) => ({
                name: l.name || "",
                catno: l.catno || ""
            }))
        };

        await setDoc(doc(db, COLLECTION_NAME, internalId), {
            ...newItem,
            timestamp: serverTimestamp()
        });

        return internalId;
    },

    async deleteItem(id: string) {
        const docRef = doc(db, COLLECTION_NAME, id);
        await setDoc(docRef, { "logistics.status": "archived" }, { merge: true });
    },

    async updateLogistics(id: string, data: Partial<InventoryItem['logistics']>) {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            "logistics": {
                ...data
            }
        });
    },

    async patchLogistics(id: string, updates: Record<string, any>) {
        const docRef = doc(db, COLLECTION_NAME, id);
        const firestoreUpdates: Record<string, any> = {};
        for (const [key, value] of Object.entries(updates)) {
            firestoreUpdates[`logistics.${key}`] = value;
        }
        await updateDoc(docRef, firestoreUpdates);
    },

    async auditInventory() {
        const q = query(collection(db, COLLECTION_NAME));
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));

        return {
            total: items.length,
            orphans: items.filter(item =>
                !item.media.full_res_image_url ||
                !item.media.full_res_image_url.includes('firebasestorage.googleapis.com')
            ),
            lowStock: items.filter(item => item.logistics.stock > 0 && item.logistics.stock <= 2),
            soldOut: items.filter(item => item.logistics.stock === 0),
            totalValue: items.reduce((acc, item) => acc + (item.logistics.price * item.logistics.stock), 0)
        };
    },

    async searchItems(searchTerm: string) {
        const q = query(collection(db, COLLECTION_NAME), where("logistics.status", "==", "active"));
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));

        if (!searchTerm) return items;

        const lowTerm = searchTerm.toLowerCase();
        return items.filter(item =>
            item.metadata.title.toLowerCase().includes(lowTerm) ||
            item.metadata.artist.toLowerCase().includes(lowTerm)
        );
    },

    async getRecentAdditions(limitCount: number = 20) {
        const q = query(
            collection(db, COLLECTION_NAME),
            where("logistics.status", "==", "active"),
            limit(50) // Fetch more to sort in memory
        );
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem))
            .sort((a, b) => ((b as any).timestamp?.seconds || 0) - ((a as any).timestamp?.seconds || 0))
            .slice(0, limitCount);
    }
};



export const getInventoryPaged = async (pageSize: number = 20, lastDoc?: any) => {
    try {
        let q = query(
            collection(db, "inventory"),
            where("logistics.status", "==", "active"),
            limit(pageSize)
        );

        if (lastDoc) {
            q = query(q, startAfter(lastDoc));
        }

        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as any[];

        return {
            items,
            lastDoc: snapshot.docs[snapshot.docs.length - 1]
        };
    } catch (error) {
        console.error("Error fetching paged inventory:", error);
        return { items: [], lastDoc: null };
    }
};
