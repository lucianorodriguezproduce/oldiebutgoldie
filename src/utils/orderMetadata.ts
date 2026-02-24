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
        items[0]?.artist ||
        order.details?.artist ||
        order.artist ||
        (order.title?.includes(' - ') ? order.title.split(' - ')[0] : null)
    );

    const rawAlbum = cleanString(
        order.details?.album ||
        items[0]?.title ||
        items[0]?.album ||
        order.title ||
        (order.title?.includes(' - ') ? order.title.split(' - ')[1] : null)
    );

    // 2. IDENTITY RESOLUTION (Deduplication)
    // [STRICT-TACTICAL] If artist and album are identical, we suppress the album to prioritize the artist.
    let artist = rawArtist;
    let album = rawAlbum;

    if (!isBatch && artist && album && artist.toLowerCase() === album.toLowerCase()) {
        album = ""; // Prevent "Soda Stereo / Soda Stereo" visual error
    }

    if (!isBatch && artist.toLowerCase() === "unknown artist") {
        artist = "";
    }

    if (!artist) artist = isBatch ? "Varios Artistas" : "";
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
        image: image.startsWith('http://') ? image.replace('http://', 'https://') : image,
        isBatch,
        itemsCount: items.length
    };
};
