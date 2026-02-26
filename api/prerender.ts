import fs from 'fs';
import path from 'path';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initBunkerIdentity, getDiscogsToken } from './_lib/bunker';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const CACHE_CONTROL = 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800';
    res.setHeader('Cache-Control', CACHE_CONTROL);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    const host = req.headers.host || 'oldiebutgoldie.com.ar';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const siteUrlBase = `${protocol}://${host}`;

    const defaultImage = `${siteUrlBase}/og-image.jpg`;
    const defaultTitle = 'Oldie but Goldie';
    const defaultDescription = 'Comprar/Vender formato físico. Consultar disponibilidad vía WhatsApp.';

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
        const db = await initBunkerIdentity();

        if (targetType === 'orden') {
            try {
                const orderDoc = await db.collection('orders').doc(targetId).get();
                if (orderDoc.exists) {
                    const data = orderDoc.data() || {};
                    const itemsArray = data.items || [];
                    const isBatch = data.isBatch || itemsArray.length > 1;

                    const cleanStr = (s: string | undefined | null) => s ? s.replace(/UNKNOWN ARTIST\s*[-—–]*\s*/gi, '').trim() : '';

                    const rawArtist = cleanStr(
                        data.artist ||
                        itemsArray[0]?.artist ||
                        data.details?.artist ||
                        ""
                    );

                    const rawAlbum = cleanStr(
                        data.title ||
                        data.album ||
                        data.details?.album ||
                        itemsArray[0]?.title ||
                        itemsArray[0]?.album ||
                        "Detalle del Disco"
                    );

                    let displayArtist = rawArtist;
                    let displayAlbum = rawAlbum;

                    const status = (data.status || 'PENDIENTE').toUpperCase();
                    const intent = (data.details?.intent || data.intent || 'CONSULTAR').toUpperCase();
                    const intentStr = intent === 'VENDER' ? 'En Venta' : 'En Compra';

                    const isNegotiating = ['PENDING', 'QUOTED', 'COUNTEROFFERED'].includes(status);

                    if (!isBatch && displayArtist && displayAlbum && displayArtist.toLowerCase() === displayAlbum.toLowerCase()) {
                        displayAlbum = "";
                    }

                    if (!displayArtist) displayArtist = isBatch ? "Varios Artistas" : "";

                    const thumbUrl = data.thumbnailUrl;
                    const coverImage = data.details?.cover_image || data.details?.thumb;
                    const firstItemCover = itemsArray[0]?.cover_image || itemsArray[0]?.thumb;

                    let image = thumbUrl || coverImage || firstItemCover || defaultImage;
                    if (image.startsWith('http://')) {
                        image = image.replace('http://', 'https://');
                    }

                    let title = defaultTitle;
                    if (isBatch) {
                        title = `Lote de ${itemsArray.length > 0 ? itemsArray.length : 'varios'} discos | Oldie but Goldie`;
                    } else {
                        title = displayArtist
                            ? (displayAlbum ? `${displayArtist} - ${displayAlbum} | Oldie but Goldie` : `${displayArtist} | Oldie but Goldie`)
                            : `${displayAlbum || "Disco Registrado"} | Oldie but Goldie`;
                    }

                    const description = `Orden de ${intentStr}: estado ${status}. ${isNegotiating ? "¡Participa en la negociación abierta!" : ""}`;
                    return serveFallback(res, title, description, image, url);
                }
            } catch (e) {
                console.error("Bunker prerender orden fetch failed: ", e);
            }
            return serveFallback(res, defaultTitle, defaultDescription, defaultImage, url);
        }

        let orderStatusStr = "";
        let orderIntentStr = "SOLICITUD";
        try {
            const orderSnap = await db.collection('orders')
                .where('item_id', '==', parseInt(targetId))
                .limit(1)
                .get();

            if (!orderSnap.empty) {
                const orderData = orderSnap.docs[0].data();
                const status = orderData.status;
                const intent = orderData.details?.intent || orderData.intent;

                if (status) orderStatusStr = status.toUpperCase();
                if (intent) {
                    orderIntentStr = intent === 'VENDER' ? 'EN VENTA' : 'EN COMPRA';
                }
            }
        } catch (e) {
            console.error("Bunker prerender cross-ref failed: ", e);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const fetchHeaders: Record<string, string> = {
            'User-Agent': `OldieButGoldieBot/1.0 +${siteUrlBase}`
        };

        const discogsToken = await getDiscogsToken();
        if (discogsToken) {
            fetchHeaders['Authorization'] = `Discogs token=${discogsToken}`;
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
        const title = discogsData.title ? `${discogsData.title} | Oldie but Goldie` : defaultTitle;
        const description = orderStatusStr
            ? `Orden de ${orderIntentStr}: ${title} en Oldie but Goldie. Estado: ${orderStatusStr}.`
            : defaultDescription;

        let image = discogsData.images?.[0]?.resource_url || discogsData.images?.[0]?.uri || discogsData.thumb || defaultImage;
        if (image.startsWith('http://')) {
            image = image.replace('http://', 'https://');
        }

        return serveFallback(res, title, description, image, url);

    } catch (error) {
        console.error('Prerender API Error/Timeout:', (error as Error).message);
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
