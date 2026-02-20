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
        // 2. Fetch with Strict Timeout (WhatsApp bots abandon quickly)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 seconds strict timeout

        const DISCOGS_URL = `https://api.discogs.com/${targetType}s/${targetId}`;
        const discogsRes = await fetch(DISCOGS_URL, {
            headers: {
                'User-Agent': 'OldieButGoldieBot/1.0 +https://oldie-but-goldie.vercel.app'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!discogsRes.ok) {
            throw new Error(`Discogs returned ${discogsRes.status}`);
        }

        const data = await discogsRes.json();

        // 3. Precise Meta Tags per User Instructions
        const title = data.title ? `${data.title} | Oldie but Goldie` : defaultTitle;
        const description = defaultDescription; // User requested exact static description for WhatsApp

        // Ensure image is absolute and HTTPS. Discogs sometimes returns HTTP or missing images
        let image = data.images?.[0]?.uri || data.thumb || defaultImage;
        if (image.startsWith('http://')) {
            image = image.replace('http://', 'https://');
        }

        const url = urlObj.href;

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
        <meta property="og:url" content="${url}" />
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:image" content="${image}" />
        <meta property="og:image:secure_url" content="${image}" />
        
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
