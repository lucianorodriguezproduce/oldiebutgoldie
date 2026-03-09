import { db } from "@/lib/firebase";
import { discogsService } from "@/lib/discogs";
import { spotifyService } from "@/services/spotifyService";
import { youtubeService } from "@/services/youtubeService";
import { quotaService } from "@/services/quotaService";
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
    startAfter,
    deleteDoc,
    writeBatch,
    onSnapshot
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
     * This is the "batea Entry" process.
     */
    async importFromDiscogs(discogsData: any, logistics: InventoryItem['logistics'], extraData?: { youtube_id?: string; notes?: string; internalId?: string }) {
        const internalId = extraData?.internalId || crypto.randomUUID();

        // 1. Resolve High-Res Image (via batea Import API)
        let fullResUrl = discogsData.images?.[0]?.resource_url || discogsData.images?.[0]?.uri || discogsData.cover_image || discogsData.thumb;

        try {
            const response = await fetch('/api/batea/import_image', {
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

        quotaService.track('discogs', 1); // Importación base

        // 2. Fetch Original Year from Master if available
        let originalYear = parseInt(discogsData.year) || 0;
        if (discogsData.master_id) {
            try {
                const master = await discogsService.getMasterDetails(discogsData.master_id);
                if (master && master.year) {
                    originalYear = master.year;
                    quotaService.track('discogs', 1); // Costo de consulta adicional
                    console.log(`[batea-Import] Found Original Year for ${discogsData.title}: ${originalYear}`);
                }
            } catch (e) {
                console.warn(`[batea-Import] Could not fetch master ${discogsData.master_id} for original year.`);
            }
        }

        // Parse artist and title from Discogs title format "Artist - Album"
        let parsedArtist = discogsData.artists?.[0]?.name || discogsData.artist || "";
        let parsedTitle = discogsData.title || "";

        if (!parsedArtist && parsedTitle) {
            // Discogs titles use "Artist - Album" format
            if (parsedTitle.includes(' - ')) {
                const parts = parsedTitle.split(' - ');
                parsedArtist = parts[0].trim();
                parsedTitle = parts.slice(1).join(' - ').trim();
            } else if (parsedTitle.includes(' — ')) {
                const parts = parsedTitle.split(' — ');
                parsedArtist = parts[0].trim();
                parsedTitle = parts.slice(1).join(' — ').trim();
            }
        }

        // Clean up "Unknown Artist" prefix if it slipped through
        if (parsedArtist.toLowerCase() === 'unknown artist') parsedArtist = "";

        // Attempt to extract YouTube ID from Discogs data
        let discogsYoutubeId = "";
        if (discogsData.videos && Array.isArray(discogsData.videos) && discogsData.videos.length > 0) {
            for (const video of discogsData.videos) {
                if (video.uri && video.uri.includes('youtube.com/watch?v=')) {
                    discogsYoutubeId = video.uri.split('v=')[1]?.split('&')[0];
                    if (discogsYoutubeId) break;
                }
            }
        }

        const finalYoutubeId = extraData?.youtube_id || discogsYoutubeId;
        let finalSpotifyId = "";

        // Super-Sanitización (V14.7)
        const sanitize = (text: string, isArtist: boolean = false) => {
            if (!text) return "";
            let clean = text;

            if (isArtist) {
                // Sui Generis (4) -> Sui Generis
                clean = clean.replace(/\s*\(\d+\)$/, "");
            } else {
                // Remover nombre del artista del título si está duplicado: "Miles Davis - Miles Davis Kind" -> "Kind"
                const artistLower = (parsedArtist || "").toLowerCase();
                if (artistLower && clean.toLowerCase().startsWith(artistLower)) {
                    clean = clean.substring(artistLower.length).replace(/^[\s\-—–]+/, "");
                }

                // Remover palabras ruido
                const noise = [
                    /Parte \d+ra/gi, /Remaster/gi, /Edition/gi, /Anniversary/gi,
                    /\[180g\]/g, /\(\d+\)/g, /Special/gi, /Deluxe/gi
                ];
                noise.forEach(pattern => {
                    clean = clean.replace(pattern, "");
                });
            }

            // Normalización final
            clean = clean.replace(/[•\*\/]/g, " ").replace(/\s\s+/g, " ").trim();
            return clean;
        };

        const cleanArtist = sanitize(parsedArtist, true);
        const cleanTitle = sanitize(parsedTitle);

        // Fallback Inteligente y Protocolo de Redundancia Crítica V15.2
        let resolvedYoutubeId = finalYoutubeId;
        let finalBpm = 0;
        let finalKey = "";

        if (resolvedYoutubeId) {
            console.log(`[Quota-Safe] YouTube ID found in Discogs/Metadata for ${parsedTitle}. Skipping proactive search.`);
        } else {
            console.log(`[Quota-Action] No YouTube ID found for ${parsedTitle}. Initiating efficiency flow (YouTube First)...`);

            // 1. Intentar YouTube API Primario
            try {
                const searchQuery = `${cleanArtist} ${cleanTitle}`;
                let ytMatch = await youtubeService.searchVideo(searchQuery);

                if (!ytMatch) {
                    console.log(`[Fallback-YouTube] Full query failed. Retrying ONLY with title: ${cleanTitle}`);
                    ytMatch = await youtubeService.searchVideo(cleanTitle);
                }

                if (!ytMatch && cleanTitle.includes(" ")) {
                    const simpleYtQuery = cleanTitle.split(" ").slice(0, 3).join(" ");
                    console.log(`[Fallback-YouTube] Secondary failure. Final retry with simplified title: ${simpleYtQuery}`);
                    ytMatch = await youtubeService.searchVideo(simpleYtQuery);
                }

                quotaService.track('youtube', 100);
                if (ytMatch) {
                    resolvedYoutubeId = ytMatch.youtube_id;
                    console.log(`[batea-Import] Found YouTube ID via API: ${resolvedYoutubeId}`);
                }
            } catch (e) {
                // Silencio Positivo (YouTube Falló o 403/404)
                console.warn(`[Redundancia-Crítica] YouTube API falló o rechazó. Invocando Sound Savior (Spotify)...`);
            }

            // 2. Enriquecimiento Obligatorio (V16.5): Fallback y Extracción Sonora (Spotify)

            try {
                let spotifyMatch = await spotifyService.searchAlbum(cleanArtist, cleanTitle);

                if (!spotifyMatch) {
                    spotifyMatch = await spotifyService.searchAlbum("", cleanTitle);
                }

                if (!spotifyMatch && cleanTitle.includes(" ")) {
                    const simpleTitle = cleanTitle.split(" ").slice(0, 3).join(" ");
                    spotifyMatch = await spotifyService.searchAlbum("", simpleTitle);
                }

                quotaService.track('spotify', 1);
                if (spotifyMatch) {
                    finalSpotifyId = spotifyMatch.spotify_id;
                    if (spotifyMatch.bpm) finalBpm = spotifyMatch.bpm;
                    if (spotifyMatch.key) finalKey = spotifyMatch.key;
                    console.log(`[batea-Import] The Sound Savior actuó: Cuyo Spotify ID -> ${finalSpotifyId} | BPM: ${finalBpm} | Key: ${finalKey}`);
                }
            } catch (e) {
                // Silencio
            }
        } // Closing the 'else' block

        // 3. Protocolo de Enriquecimiento (V15.6)
        const tracklistArray = (discogsData.tracklist || []).map((t: any) => ({
            position: t.position || "",
            title: t.title || "",
            duration: t.duration || ""
        })).slice(0, 5); // Limit to 5 for DB scale

        const wants = discogsData.community?.want || 0;
        const have = discogsData.community?.have || 0;
        const isGoldenSelection = (have > 0 && (wants / have) > 5) ? true : undefined;

        // 4. Parada de Seguridad y Bloqueo de Persistencia (V16.5)
        if (tracklistArray.length === 0 || (!resolvedYoutubeId && !finalSpotifyId)) {
            throw new Error(`Integridad fallida: Metadata crítica ausente (Tracklist vacío o sin ID de Audio). Abortando.`);
        }

        const newItem: InventoryItem = {
            id: internalId,
            metadata: {
                title: parsedTitle || discogsData.title || "Unknown Title",
                artist: parsedArtist || "Desconocido",
                year: parseInt(discogsData.year) || 0,
                original_year: originalYear,
                country: discogsData.country || "Unknown",
                genres: discogsData.genres || [],
                styles: discogsData.styles || [],
                format_description: Array.isArray(discogsData.formats)
                    ? discogsData.formats.map((f: any) => f.name).join(", ")
                    : discogsData.format || "Unknown Format",
                ...(resolvedYoutubeId && { youtube_id: resolvedYoutubeId }),
                ...(finalSpotifyId && { spotify_id: finalSpotifyId }),
                wants: wants,
                have: have,
                ...(extraData?.notes && { notes: extraData.notes }),
                ...(isGoldenSelection && { is_golden_selection: isGoldenSelection }),
                bpm: finalBpm,
                key: finalKey
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
            tracklist: tracklistArray,
            labels: (discogsData.labels || []).map((l: any) => ({
                name: l.name || "",
                catno: l.catno || ""
            }))
        };

        // Persistencia INMEDIATA con Merge True para salvaguardar futuros enriquecimientos
        await setDoc(doc(db, COLLECTION_NAME, internalId), {
            ...newItem,
            timestamp: serverTimestamp()
        }, { merge: true });

        return internalId;
    },

    async deleteItem(id: string) {
        const docRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(docRef);
    },

    async deleteItems(ids: string[]) {
        const batch = writeBatch(db);
        ids.forEach(id => {
            const docRef = doc(db, COLLECTION_NAME, id);
            batch.delete(docRef);
        });
        await batch.commit();
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
            (item.metadata.title.toLowerCase().includes(lowTerm) ||
                item.metadata.artist.toLowerCase().includes(lowTerm)) &&
            (item.logistics.stock > 0)
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
            .filter(item => item.logistics.stock > 0)
            .sort((a, b) => ((b as any).timestamp?.seconds || 0) - ((a as any).timestamp?.seconds || 0))
            .slice(0, limitCount);
    },

    onSnapshotInventory(callback: (items: InventoryItem[]) => void) {
        const q = query(
            collection(db, COLLECTION_NAME),
            where("logistics.status", "==", "active")
        );
        return onSnapshot(q, (snapshot) => {
            const items = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem))
                .filter(item => item.logistics.stock > 0);
            callback(items);
        });
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
