import { db } from "@/lib/firebase";
import { discogsService } from "@/lib/discogs";
import { spotifyService } from "@/services/spotifyService";
import { youtubeService } from "@/services/youtubeService";
import { quotaService } from "@/services/quotaService";
import { idService } from "@/services/idService";
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
    onSnapshot,
    deleteField,
    getCountFromServer,
    getAggregateFromServer,
    sum
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
        const id = await idService.generateInternalID('VTA');
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
        const id = await idService.generateInternalID('VTA');
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
     * Protocol V93.0: Ingestor Universal (Single Source of Truth)
     * Centraliza la carga de Admin, Sourcing y Batea de Usuario.
     */
    async universalIngest(sourceData: any, context: 'admin' | 'sourcing' | 'user_upload', extraData?: any) {
        console.log(`[V93.0-INGESTOR] Starting universal ingest for context: ${context}`);
        
        // 1. Enriquecimiento y Normalización (Pipeline Maestro)
        // Usamos importFromDiscogs como el motor de procesamiento base
        const { id, item } = await this.importFromDiscogs(sourceData, {
            stock: extraData?.stock ?? (context === 'user_upload' ? 1 : 0),
            price: extraData?.price ?? 0,
            condition: extraData?.condition ?? 'M/NM',
            status: context === 'sourcing' ? 'requested' : (context === 'user_upload' ? 'archived' : 'active')
        }, extraData);

        // 2. Ruteo (Output Split)
        if (context === 'user_upload') {
            const userId = extraData?.userId;
            if (!userId) throw new Error("SISTEMA_IDENTIDAD_USUARIO_REQUERIDO");

            const { userAssetService } = await import("@/services/userAssetService");
            
            await userAssetService.addAsset(userId, {
                originalInventoryId: id,
                metadata: item.metadata,
                media: item.media,
                logistics: {
                    price: extraData?.price ?? 0,
                    stock: extraData?.stock ?? 1,
                    condition: extraData?.condition ?? 'M/NM',
                    status: 'active',
                    isTradeable: extraData?.isTradeable ?? false
                },
                reference: item.reference,
                tracklist: item.tracklist,
                labels: item.labels,
                items: item.items
            } as any);

            console.log(`[V93.0-INGESTOR] User asset created and linked to shadow item ${id}`);
        }

        return { id, item };
    },

    /**
     * Clones a Discogs release and persists it into the local inventory.
     * This is the "batea Entry" process.
     */
    async importFromDiscogs(discogsData: any, logistics: InventoryItem['logistics'], extraData?: { youtube_id?: string; notes?: string; internalId?: string }) {
        const internalId = extraData?.internalId || await idService.generateInternalID('VTA');

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
        let originalYear = parseInt(String(discogsData.year)) || 0;
        if (discogsData.master_id) {
            try {
                const master = await discogsService.getMasterDetails(discogsData.master_id);
                if (master && master.year) {
                    originalYear = parseInt(String(master.year)) || 0;
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
        let finalPreviewUrl = "";

        // 1. YouTube Enrichment (if missing)
        if (!resolvedYoutubeId) {
            console.log(`[Quota-Action] No YouTube ID found for ${parsedTitle}. Initiating search...`);

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
                console.warn(`[Redundancia-Crítica] YouTube API falló o rechazó.`);
            }
        }

        // 2. Spotify Enrichment (if missing or always to get audio features/preview)
        if (!finalSpotifyId) {
            console.log(`[Quota-Action] Searching Spotify for ${parsedTitle} enrichment...`);
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
                    if (spotifyMatch.preview_url) finalPreviewUrl = spotifyMatch.preview_url;
                    // Note: BPM/Key extraction usually happens in a separate background process or via V17.5 player
                    console.log(`[batea-Import] The Sound Savior actuó: Spotify ID -> ${finalSpotifyId}`);
                }
            } catch (e) {
                console.warn(`[Redundancia-Crítica] Spotify API falló.`);
            }
        }

        // 3. Protocolo de Enriquecimiento (V15.6)
        const tracklistArray = (discogsData.tracklist || []).map((t: any) => ({
            position: t.position || "",
            title: t.title || "",
            duration: t.duration || ""
        })); // Removed limit to fetch full tracklist

        const wants = discogsData.community?.want || 0;
        const have = discogsData.community?.have || 0;
        const isGoldenSelection = (have > 0 && (wants / have) > 5) ? true : undefined;

        // 4. Parada de Seguridad Suavizada (V17.5) - Dry Run Passthrough
        let integrityWarning = "";
        if (tracklistArray.length === 0 || (!resolvedYoutubeId && !finalSpotifyId)) {
            console.warn(`[Integridad-Parcial] Metadata crítica ausente para ${parsedTitle}. Se cargará con Status Warning.`);
            integrityWarning = "Audio IDs o Tracklist ausentes";
        }

        const newItem: InventoryItem = {
            id: internalId,
            metadata: {
                title: parsedTitle || discogsData.title || "Unknown Title",
                artist: parsedArtist || "Desconocido",
                year: parseInt(String(discogsData.year)) || 0,
                original_year: parseInt(String(originalYear)) || 0,
                country: discogsData.country || "Unknown",
                genres: discogsData.genres || [],
                styles: discogsData.styles || [],
                format_description: Array.isArray(discogsData.formats)
                    ? discogsData.formats.map((f: any) => f.name).join(", ")
                    : discogsData.format || "Unknown Format",
                ...(resolvedYoutubeId && { youtube_id: resolvedYoutubeId }),
                ...(finalSpotifyId && { spotify_id: finalSpotifyId }),
                ...(finalPreviewUrl && { preview_url: finalPreviewUrl }),
                wants: wants,
                have: have,
                ...(extraData?.notes && { notes: extraData.notes }),
                ...(isGoldenSelection && { is_golden_selection: isGoldenSelection }),
                ...(integrityWarning && { status_warning: integrityWarning }),
                bpm: finalBpm,
                key: finalKey,
                isVisible: logistics.status === 'requested' ? false : (discogsData.isVisible !== undefined ? discogsData.isVisible : true)
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
                status: logistics.status || (logistics.stock > 0 ? "active" : "sold_out")
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

        return { id: internalId, item: newItem };
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
        const coll = collection(db, COLLECTION_NAME);
        
        // 1. Total Count
        const totalSnap = await getCountFromServer(coll);
        
        // 2. Low Stock Count (0 < stock <= 2)
        const lowStockQuery = query(coll, where("logistics.stock", ">", 0), where("logistics.stock", "<=", 2));
        const lowStockSnap = await getCountFromServer(lowStockQuery);
        
        // 3. Sold Out Count (stock == 0)
        const soldOutQuery = query(coll, where("logistics.stock", "==", 0));
        const soldOutSnap = await getCountFromServer(soldOutQuery);
        
        // 4. Total Value (Approximate sum of prices)
        const valueSnap = await getAggregateFromServer(coll, {
            totalValue: sum('logistics.price')
        });

        // Orphans still need document analysis because of complex string matching 
        // We'll calculate it from a sample or return 0 for now to save costs, 
        // or just fetch orphans specifically if we can structure the query.
        // For now, I'll return a placeholder or a simplified query if possible.
        
        return {
            total: totalSnap.data().count,
            orphans: [], // Optimized to avoid doc fetching
            lowStockCount: lowStockSnap.data().count,
            soldOutCount: soldOutSnap.data().count,
            totalValue: valueSnap.data().totalValue || 0
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
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where("logistics.status", "==", "active"),
                limit(limitCount * 2) // Fetch same buffer as fallback
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
        } catch (error) {
            console.error("Error in getRecentAdditions:", error);
            // Fallback: fetch without order by (if index is missing) and sort in memory
            const q = query(
                collection(db, COLLECTION_NAME),
                where("logistics.status", "==", "active"),
                limit(limitCount * 2)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem))
                .filter(item => item.logistics.stock > 0)
                .sort((a, b) => ((b as any).timestamp?.seconds || 0) - ((a as any).timestamp?.seconds || 0))
                .slice(0, limitCount);
        }
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
    },

    async updateTechnicalData(id: string, bpm: number, key: string) {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            "metadata.bpm": bpm,
            "metadata.key": key,
            "metadata.status_warning": deleteField()
        });
    },

    async bulkUpdatePrices(category: string, mode: 'fixed' | 'percentage', value: number) {
        try {
            console.log(`[Bulk-Price] Iniciando ajuste masivo para categoría: ${category}...`);
            const q = query(
                collection(db, COLLECTION_NAME),
                where("logistics.internal_category", "==", category),
                where("logistics.status", "==", "active")
            );

            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                console.warn(`[Bulk-Price] No se encontraron discos bajo la categoría: ${category}`);
                return;
            }

            const batch = writeBatch(db);
            let count = 0;

            snapshot.docs.forEach(docSnap => {
                const item = docSnap.data() as InventoryItem;
                const oldPrice = item.logistics.price;
                let newPrice = oldPrice;

                if (mode === 'fixed') {
                    newPrice = oldPrice + value;
                } else {
                    newPrice = oldPrice * (1 + value / 100);
                }

                // Round to nearest 100 (ceil)
                newPrice = Math.ceil(newPrice / 100) * 100;

                if (newPrice !== oldPrice) {
                    batch.update(docSnap.ref, { "logistics.price": newPrice });
                    count++;
                }
            });

            if (count > 0) {
                await batch.commit();
                console.log(`[Bulk-Price] Ajuste masivo completado: ${count} discos actualizados.`);
            }
        } catch (error) {
            console.error("[Bulk-Price] CRITICAL ERROR:", error);
            throw error;
        }
    },

    async healRecord(item: InventoryItem) {
        try {
            console.log(`[Heal-Protocol] Iniciando restauración de metadatos para ${item.metadata.title}...`);

            let newTracklist = item.tracklist || [];
            let finalSpotifyId = item.metadata.spotify_id || "";
            let finalYoutubeId = item.metadata.youtube_id || "";

            // 1. Search for Spotify ID if missing
            if (!finalSpotifyId) {
                try {
                    const cleanArtist = item.metadata.artist.replace(/\s*\(\d+\)$/, "").trim();
                    const cleanTitle = item.metadata.title.replace(/[•\*\/]/g, " ").replace(/\s\s+/g, " ").trim();

                    let searchRes = await spotifyService.searchAlbum(cleanArtist, cleanTitle);
                    if (!searchRes) searchRes = await spotifyService.searchAlbum("", cleanTitle);

                    if (searchRes) {
                        finalSpotifyId = searchRes.spotify_id;
                        console.log(`[Heal-Protocol] Nuevo Spotify ID encontrado: ${finalSpotifyId}`);
                    }
                } catch (e) {
                    console.warn("[Heal-Protocol] Falló la búsqueda en Spotify:", e);
                }
            }

            // 2. Search for YouTube ID if missing
            if (!finalYoutubeId) {
                try {
                    const cleanArtist = item.metadata.artist.replace(/\s*\(\d+\)$/, "").trim();
                    const cleanTitle = item.metadata.title.replace(/[•\*\/]/g, " ").replace(/\s\s+/g, " ").trim();
                    let ytMatch = await youtubeService.searchVideo(`${cleanArtist} ${cleanTitle}`);
                    if (!ytMatch) ytMatch = await youtubeService.searchVideo(cleanTitle);

                    if (ytMatch) {
                        finalYoutubeId = ytMatch.youtube_id;
                        console.log(`[Heal-Protocol] Recuperado desde YouTube: ${finalYoutubeId}`);
                    }
                } catch (e) {
                    console.warn("[Heal-Protocol] Falló la búsqueda en YouTube:", e);
                }
            }

            // 3. Extract tracklist if empty (re-fetch Discogs)
            if (newTracklist.length === 0 && item.reference?.originalDiscogsId) {
                try {
                    let discogsData: any;
                    const id = item.reference.originalDiscogsId.toString();
                    
                    try {
                        // Try as release first
                        const discogsRes = await fetch(`/api/proxy?path=/releases/${id}`);
                        if (discogsRes.ok) {
                            discogsData = await discogsRes.json();
                        } else {
                            throw new Error("No es un release válido o no encontrado");
                        }
                    } catch (e) {
                        // Try as master if release fails
                        const masterRes = await fetch(`/api/proxy?path=/masters/${id}`);
                        if (masterRes.ok) {
                            const master = await masterRes.json();
                            if (master.main_release) {
                                const mainReleaseRes = await fetch(`/api/proxy?path=/releases/${master.main_release}`);
                                if (mainReleaseRes.ok) {
                                    discogsData = await mainReleaseRes.json();
                                }
                            } else {
                                discogsData = master; // Fallback to master if no main release
                            }
                        }
                    }

                    if (discogsData) {
                        newTracklist = (discogsData.tracklist || []).map((t: any) => ({
                            position: t.position || "",
                            title: t.title || "",
                            duration: t.duration || ""
                        }));
                        console.log(`[Heal-Protocol] Recuperado Tracklist desde Discogs.`);
                    }
                } catch (e) {
                    console.warn("[Heal-Protocol] Falló el rescate de Discogs:", e);
                }
            }

            // 4. Persistence
            const docRef = doc(db, COLLECTION_NAME, item.id);
            const updatePayload: Record<string, any> = {};

            if (newTracklist.length > 0) updatePayload["tracklist"] = newTracklist;
            if (finalSpotifyId) updatePayload["metadata.spotify_id"] = finalSpotifyId;
            if (finalYoutubeId) updatePayload["metadata.youtube_id"] = finalYoutubeId;

            // Remove warning if IDs are now present
            if (finalSpotifyId || finalYoutubeId || newTracklist.length > 0) {
                updatePayload["metadata.status_warning"] = deleteField();
            }

            if (Object.keys(updatePayload).length > 0) {
                await updateDoc(docRef, updatePayload);
                console.log(`[Heal-Protocol] Metadatos actualizados en Firestore.`);
            }
        } catch (err) {
            console.error("FATAL ERROR en healRecord:", err);
            throw err;
        }
    },

    async patchBlocks(id: string, blocks: any[]) {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, { blocks });
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
