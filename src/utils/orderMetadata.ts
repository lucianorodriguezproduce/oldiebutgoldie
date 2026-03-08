/**
 * Centralizes the logic for extracting artist, album, and image from an order.
 * Handles the different data schemas present in Firestore (Legacy, Individual User, Batch Admin, and batea Trade).
 */
export const getCleanOrderMetadata = (order: any) => {
    if (!order) return { artist: '', album: '', format: 'Vinyl', condition: 'N/A', image: '', isBatch: false, itemsCount: 0 };

    const items = (Array.isArray(order.items) && order.items.length > 0)
        ? order.items
        : (Array.isArray(order.manifest?.items) ? order.manifest.items : []);
    const isBatch = items.length > 1;

    // Helper to clean "UNKNOWN ARTIST" prefixes
    const cleanString = (str: string | undefined | null) => {
        if (!str) return '';
        return str.replace(/UNKNOWN ARTIST\s*[-—–]*\s*/gi, '').trim();
    };

    // 0. batea PRIORITIZATION (Data Sovereignty)
    if (order.is_batea_data && items.length > 0) {
        console.log(`[batea-Sync] Processing sovereign data for ID: ${order.id}`);
        const first = items[0];
        return {
            artist: cleanString(first.artist) || '',
            album: first.album || first.title || (isBatch ? `Lote de ${items.length} discos` : 'Detalle del Disco'),
            format: first.format || 'Vinyl',
            condition: first.condition || 'N/A',
            image: first.cover_image || first.thumb || "https://raw.githubusercontent.com/lucianorodriguezproduce/buscadordiscogs2/refs/heads/main/public/obg.png",
            isBatch,
            itemsCount: items.length
        };
    }

    // 0.1 DIRECT INVENTORY ITEM SUPPORT (Raw batea Items)
    if (order.metadata && order.logistics) {
        return {
            artist: order.metadata.artist || '',
            album: order.metadata.title || 'Detalle del Disco',
            format: order.metadata.format_description || 'Vinyl',
            condition: order.logistics.condition || 'N/A',
            image: order.media?.full_res_image_url || order.media?.thumbnail || "https://raw.githubusercontent.com/lucianorodriguezproduce/buscadordiscogs2/refs/heads/main/public/obg.png",
            isBatch: false,
            itemsCount: 1,
            isInventoryItem: true // Tag to identify local stock
        };
    }

    // 1. EXTRACT RAW DATA (Priority: items[0] > details > root)
    const rawArtist = cleanString(
        order.details?.artist ||
        items[0]?.artist ||
        order.artist ||
        (order.title?.includes(' - ') ? order.title.split(' - ')[0] : null)
    );

    const rawAlbum = cleanString(
        order.details?.album ||
        items[0]?.album ||
        items[0]?.title ||
        order.title ||
        (order.title?.includes(' - ') ? order.title.split(' - ')[1] : null)
    );

    const format =
        order.details?.format ||
        items[0]?.format ||
        order.format ||
        "Vinyl";

    const condition =
        order.details?.condition ||
        items[0]?.condition ||
        "N/A";

    // 2. IDENTITY RESOLUTION (Deduplication)
    let artist = rawArtist;
    let album = rawAlbum;

    // [STRICT-RECOVERY] If root artist is empty, fallback to the first item's artist
    if (!artist && items.length > 0 && items[0].artist) {
        artist = items[0].artist;
    }

    // [STRICT-TACTICAL] If artist and album are identical, suppress the album to prioritize the artist.
    if (!isBatch && artist && album && artist.toLowerCase() === album.toLowerCase()) {
        album = ""; // Prevent "Soda Stereo / Soda Stereo" visual error
    }

    if (!isBatch && artist.toLowerCase() === "unknown artist") {
        artist = "";
    }

    if (!artist) {
        // Final emergency fallback: try segmenting the album if it was previously used as title
        if (album && album.includes(' - ')) {
            artist = album.split(' - ')[0].trim();
            album = album.split(' - ').slice(1).join(' - ').trim();
        } else {
            artist = isBatch ? "Lote de ítems" : "";
        }
    }

    if (!album) album = isBatch ? `Lote de ${items.length} ítems` : "Detalle del Disco";

    // 3. IMAGE EXTRACTION
    const image =
        items[0]?.cover_image ||
        items[0]?.thumb ||
        order.details?.cover_image ||
        order.thumbnailUrl ||
        order.cover_image ||
        order.thumb ||
        "https://raw.githubusercontent.com/lucianorodriguezproduce/buscadordiscogs2/refs/heads/main/public/obg.png";

    return {
        artist,
        album,
        format,
        condition,
        image: image.startsWith('http://') ? image.replace('http://', 'https://') : image,
        isBatch,
        itemsCount: items.length
    };
};
