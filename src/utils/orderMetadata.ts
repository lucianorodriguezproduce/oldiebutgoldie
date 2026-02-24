/**
 * Centralizes the logic for extracting artist, album, and image from an order.
 * Handles the different data schemas present in Firestore (Legacy, Individual User, Batch Admin).
 */
export const getCleanOrderMetadata = (order: any) => {
    const items = Array.isArray(order.items) ? order.items : [];
    const isBatch = items.length > 1;

    // Helper to clean "UNKNOWN ARTIST" prefixes
    const cleanString = (str: string | undefined | null) => {
        if (!str) return '';
        return str.replace(/UNKNOWN ARTIST\s*[-—–]*\s*/gi, '').trim();
    };

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
            artist = isBatch ? "Varios Artistas" : "";
        }
    }

    if (!album) album = isBatch ? `Lote de ${items.length} discos` : "Detalle del Disco";

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
