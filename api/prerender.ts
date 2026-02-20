import fs from 'fs';
import path from 'path';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// This function intercepts requests to /item/:type/:id to inject SEO tags before serving the SPA index.html

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. Aggressive Caching for Edge
    const CACHE_CONTROL = 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800';
    res.setHeader('Cache-Control', CACHE_CONTROL);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    const defaultImage = 'https://oldie-but-goldie.vercel.app/og-image.jpg';
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
    } else {
        return serveFallback(res, defaultTitle, defaultDescription, defaultImage, urlObj.href);
    }

    try {
        const url = `https://${req.headers.host || 'localhost'}/item/${targetType}/${targetId}`;

        // FIREBASE CROSS-REFERENCE FOR DYNAMIC SEO
        let orderStatusStr = "";
        try {
            const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'intras-projects';
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
                                value: { integerValue: parseInt(targetId) } // Assuming targetId is an integer for item_id
                            }
                        },
                        limit: 1
                    }
                }),
                signal: AbortSignal.timeout(1000) // 1s strict timeout for cross-reference so we don't block the scraper too long
            });

            if (fbResponse.ok) {
                const fbData = await fbResponse.json();
                if (fbData && fbData.length > 0 && fbData[0].document) {
                    const status = fbData[0].document.fields?.status?.stringValue;
                    if (status) orderStatusStr = status.toUpperCase();
                }
            }
        } catch (e) {
            console.error("Firebase prerender cross-ref failed: ", e);
            // Non-blocking failure, proceed with default SEO
        }

        // 2. Fetch with Strict Timeout (WhatsApp bots abandon quickly)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 seconds strict timeout

        const fetchHeaders: Record<string, string> = {
            'User-Agent': 'OldieButGoldieBot/1.0 +https://oldie-but-goldie.vercel.app'
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
            ? `Orden de ${title} generada en Oldie but Goldie. Estado: ${orderStatusStr}. Especialistas en formato físico.`
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
