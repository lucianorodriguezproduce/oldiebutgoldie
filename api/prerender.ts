import fs from 'fs';
import path from 'path';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// This function intercepts requests to /item/:type/:id to inject SEO tags before serving the SPA index.html

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. Aggressive Caching for Edge
    const CACHE_CONTROL = 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800';
    res.setHeader('Cache-Control', CACHE_CONTROL);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    const host = req.headers.host || 'oldiebutgoldie.com.ar';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const siteUrlBase = `${protocol}://${host}`;

    const defaultImage = `${siteUrlBase}/og-image.jpg`;
    const defaultTitle = 'Oldie but Goldie';
    const defaultDescription = 'Comprar/Vender formato físico. Consultar disponibilidad vía WhatsApp.';

    // URL Parsing
    const urlObj = new URL(req.url || '', `https://${req.headers.host || 'localhost'}`);
    const pathSegments = urlObj.pathname.split('/').filter(Boolean);

    let targetType = 'release';
    let targetId = '';

    if (pathSegments.length >= 3 && pathSegments[0] === 'item') {
        targetType = pathSegments[1];
        targetId = pathSegments[2];
    } else if (pathSegments.length >= 2 && pathSegments[0] === 'orden') {
        targetType = 'orden';
        targetId = pathSegments[1];
    } else {
        return serveFallback(res, defaultTitle, defaultDescription, defaultImage, urlObj.href);
    }

    try {
        const url = `https://${req.headers.host || 'localhost'}/${targetType === 'orden' ? 'orden' : 'item/' + targetType}/${targetId}`;

        if (targetType === 'orden') {
            try {
                const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'buscador-discogs-11425';
                const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/orders/${targetId}`;

                const fbResponse = await fetch(firestoreUrl, {
                    method: 'GET',
                    signal: AbortSignal.timeout(2000)
                });

                if (fbResponse.ok) {
                    const fbData = await fbResponse.json();
                    const fields = fbData.fields || {};
                    // [STRICT-EXTRACT-EDGE] Sync with getCleanOrderMetadata logic
                    const itemsArray = fields.items?.arrayValue?.values || [];
                    const isBatch = fields.isBatch?.booleanValue || itemsArray.length > 1;

                    const cleanStr = (s: string | undefined | null) => s ? s.replace(/UNKNOWN ARTIST\s*[-—–]*\s*/gi, '').trim() : '';

                    const rawArtist = cleanStr(
                        fields.artist?.stringValue ||
                        itemsArray[0]?.mapValue?.fields?.artist?.stringValue ||
                        fields.details?.mapValue?.fields?.artist?.stringValue ||
                        ""
                    );

                    const rawAlbum = cleanStr(
                        fields.title?.stringValue ||
                        fields.album?.stringValue ||
                        fields.details?.mapValue?.fields?.album?.stringValue ||
                        itemsArray[0]?.mapValue?.fields?.title?.stringValue ||
                        itemsArray[0]?.mapValue?.fields?.album?.stringValue ||
                        "Detalle del Disco"
                    );

                    let displayArtist = rawArtist;
                    let displayAlbum = rawAlbum;

                    const status = (fields.status?.stringValue || 'PENDIENTE').toUpperCase();
                    const intent = (fields.details?.mapValue?.fields?.intent?.stringValue || fields.intent?.stringValue || 'CONSULTAR').toUpperCase();
                    const intentStr = intent === 'VENDER' ? 'En Venta' : 'En Compra';

                    const isNegotiating = ['PENDING', 'QUOTED', 'COUNTEROFFERED'].includes(status);

                    // [STRICT-TACTICAL] Deduplication for zero-error visual parity
                    if (!isBatch && displayArtist && displayAlbum && displayArtist.toLowerCase() === displayAlbum.toLowerCase()) {
                        displayAlbum = "";
                    }

                    if (!displayArtist) displayArtist = isBatch ? "Varios Artistas" : "";

                    const thumbUrl = fields.thumbnailUrl?.stringValue;
                    const coverImage = fields.details?.mapValue?.fields?.cover_image?.stringValue || fields.details?.mapValue?.fields?.thumb?.stringValue;
                    const firstItemCover = itemsArray[0]?.mapValue?.fields?.cover_image?.stringValue || itemsArray[0]?.mapValue?.fields?.thumb?.stringValue;

                    let image = thumbUrl || coverImage || firstItemCover || defaultImage;
                    if (image.startsWith('http://')) {
                        image = image.replace('http://', 'https://');
                    }

                    // Hierarchy Elevation for Title
                    let title = defaultTitle;
                    if (isBatch) {
                        title = `Lote de ${itemsArray.length > 0 ? itemsArray.length : 'varios'} discos | Oldie but Goldie`;
                    } else {
                        // Priority: Display Artist - Display Album. If album was deduplicated, it will be empty.
                        title = displayArtist
                            ? (displayAlbum ? `${displayArtist} - ${displayAlbum} | Oldie but Goldie` : `${displayArtist} | Oldie but Goldie`)
                            : `${displayAlbum || "Disco Registrado"} | Oldie but Goldie`;
                    }

                    const description = `Orden de ${intentStr}: estado ${status}. ${isNegotiating ? "¡Participa en la negociación abierta!" : ""}`;

                    return serveFallback(res, title, description, image, url);
                }
            } catch (e) {
                console.error("Firebase prerender orden fetch failed: ", e);
            }
            return serveFallback(res, defaultTitle, defaultDescription, defaultImage, url);
        }

        // FIREBASE CROSS-REFERENCE FOR DYNAMIC SEO [LEGACY /item/type/id]
        let orderStatusStr = "";
        let orderIntentStr = "SOLICITUD";
        try {
            const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'buscador-discogs-11425';
            const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

            const fbResponse = await fetch(firestoreUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    structuredQuery: {
                        from: [{ collectionId: "orders" }],
                        where: {
                            fieldFilter: {
                                field: { fieldPath: "item_id" },
                                op: "EQUAL",
                                value: { integerValue: parseInt(targetId) }
                            }
                        },
                        limit: 1
                    }
                }),
                signal: AbortSignal.timeout(1000)
            });

            if (fbResponse.ok) {
                const fbData = await fbResponse.json();
                if (fbData && fbData.length > 0 && fbData[0].document) {
                    const status = fbData[0].document.fields?.status?.stringValue;
                    const detailsMap = fbData[0].document.fields?.details?.mapValue?.fields;
                    const intent = detailsMap?.intent?.stringValue;

                    if (status) orderStatusStr = status.toUpperCase();
                    if (intent) {
                        orderIntentStr = intent === 'VENDER' ? 'EN VENTA' : 'EN COMPRA';
                    }
                }
            }
        } catch (e) {
            console.error("Firebase prerender cross-ref failed: ", e);
        }

        // 2. Fetch with Strict Timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 seconds strict timeout

        const fetchHeaders: Record<string, string> = {
            'User-Agent': `OldieButGoldieBot/1.0 +${siteUrlBase}`
        };

        if (process.env.DISCOGS_API_TOKEN) {
            fetchHeaders['Authorization'] = `Discogs token=${process.env.DISCOGS_API_TOKEN}`;
        }

        const DISCOGS_URL = `https://api.discogs.com/${targetType}s/${targetId}`;
        const discogsRes = await fetch(DISCOGS_URL, {
            headers: fetchHeaders,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!discogsRes.ok) {
            throw new Error(`Discogs returned ${discogsRes.status}`);
        }

        const discogsData = await discogsRes.json();

        // 3. Precise Meta Tags per User Instructions
        const title = discogsData.title ? `${discogsData.title} | Oldie but Goldie` : defaultTitle;

        // Generate description based on whether an order exists in Firebase
        const description = orderStatusStr
            ? `Orden de ${orderIntentStr}: ${title} en Oldie but Goldie. Estado: ${orderStatusStr}.`
            : defaultDescription;

        // Ensure image is absolute and HTTPS. Discogs sometimes returns HTTP or missing images.
        // Also fallback to higher resolution image first.
        let image = discogsData.images?.[0]?.resource_url || discogsData.images?.[0]?.uri || discogsData.thumb || defaultImage;
        if (image.startsWith('http://')) {
            image = image.replace('http://', 'https://');
        }

        return serveFallback(res, title, description, image, url);

    } catch (error) {
        console.error('Prerender API Error/Timeout:', (error as Error).message);
        // 4. Bulletproof Fallback
        return serveFallback(res, defaultTitle, defaultDescription, defaultImage, urlObj.href);
    }
}

function serveFallback(res: VercelResponse, title: string, description: string, image: string, url: string) {
    const injection = `
        <title>${title}</title>
        <meta name="description" content="${description}" />
        <link rel="canonical" href="${url}" />
        
        <meta property="og:type" content="music.album" />
        <meta property="fb:app_id" content="966242223397117" />
        <meta property="og:url" content="${url}" />
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        
        <meta property="og:image" content="${image}" />
        <meta property="og:image:secure_url" content="${image}" />
        <meta property="og:image:width" content="600" />
        <meta property="og:image:height" content="600" />
        <meta property="og:image:type" content="image/jpeg" />
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="${url}" />
        <meta name="twitter:title" content="${title}" />
        <meta name="twitter:description" content="${description}" />
        <meta name="twitter:image" content="${image}" />
    `;

    try {
        const indexPath = path.join(process.cwd(), 'dist', 'index.html');
        let html = fs.readFileSync(indexPath, 'utf8');
        html = html.replace('</head>', `${injection}</head>`);
        res.status(200).send(html);
    } catch (e) {
        // Absolute worst case: dist/index.html is missing (Vercel deployment issue)
        // Return a valid minimalist HTML document just for the bots
        res.status(200).send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                ${injection}
            </head>
            <body>
                <script>window.location.href = "/";</script>
            </body>
            </html>
        `);
    }
}
