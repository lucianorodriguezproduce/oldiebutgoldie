import fs from 'fs';
import path from 'path';

// This function intercepts requests to /item/:type/:id to inject SEO tags before serving the SPA index.html

export default async function handler(req, res) {
    try {
        // 1. Extract type and ID from the URL path
        // Example URL: /item/release/12345
        const urlObj = new URL(req.url, `https://${req.headers.host}`);
        const pathSegments = urlObj.pathname.split('/').filter(Boolean);

        let targetType = 'release';
        let targetId = '';

        if (pathSegments.length >= 3 && pathSegments[0] === 'item') {
            targetType = pathSegments[1];
            targetId = pathSegments[2];
        } else {
            // Fallback if not matching expected structure
            return serveStaticIndex(res);
        }

        // 2. Fetch data from Discogs API
        const DISCOGS_URL = `https://api.discogs.com/${targetType}s/${targetId}`;
        const discogsRes = await fetch(DISCOGS_URL, {
            headers: {
                // Must provide a generic user agent for public endpoints
                'User-Agent': 'OldieButGoldie/1.0 +https://oldie-but-goldie.vercel.app'
            }
        });

        if (!discogsRes.ok) {
            console.error(`Discogs API failed: ${discogsRes.status}`);
            return serveStaticIndex(res);
        }

        const data = await discogsRes.json();

        // 3. Prepare SEO metadata
        const title = data.title ? `${data.title} - Oldie but Goldie` : 'Oldie but Goldie';
        const description = data.title ? `Compra, vende o cotiza ${data.title} de forma instantánea en Oldie but Goldie.` : 'El sistema definitivo para coleccionismo físico.';
        const image = data.images?.[0]?.uri || data.thumb || 'https://oldie-but-goldie.vercel.app/og-image.jpg';
        const url = `https://oldie-but-goldie.vercel.app/item/${targetType}/${targetId}`;
        const price = data.lowest_price ? data.lowest_price.toString() : null;

        // Structured Data Building
        const schema = {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": data.title || 'Unknown Item',
            "image": [image],
            "description": `Formato físico de ${data.title || 'este artículo'}.`,
        };

        if (price) {
            schema.offers = {
                "@type": "Offer",
                "priceCurrency": "USD", // Defaulting based on Discogs generic response or adjust as needed
                "price": price,
                "availability": "https://schema.org/InStock"
            };
        }

        // 4. Read the static index.html built by Vite
        const indexPath = path.join(process.cwd(), 'dist', 'index.html');
        let html = fs.readFileSync(indexPath, 'utf8');

        // 5. Inject into <head>
        const injection = `
            <title>${title}</title>
            <meta name="description" content="${description}" />
            <link rel="canonical" href="${url}" />
            
            <meta property="og:type" content="product" />
            <meta property="og:url" content="${url}" />
            <meta property="og:title" content="${title}" />
            <meta property="og:description" content="${description}" />
            <meta property="og:image" content="${image}" />
            
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:url" content="${url}" />
            <meta name="twitter:title" content="${title}" />
            <meta name="twitter:description" content="${description}" />
            <meta name="twitter:image" content="${image}" />
            
            <script type="application/ld+json">
                ${JSON.stringify(schema)}
            </script>
        `;

        // Replace the generic <title> tag with our injected block
        // Or inject right before </head>
        html = html.replace('</head>', `${injection}</head>`);

        // 6. Send the modified HTML
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate'); // Cache at the Edge for 1 day
        res.status(200).send(html);

    } catch (error) {
        console.error('Prerender error:', error);
        return serveStaticIndex(res);
    }
}

function serveStaticIndex(res) {
    try {
        const indexPath = path.join(process.cwd(), 'dist', 'index.html');
        const html = fs.readFileSync(indexPath, 'utf8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(html);
    } catch (e) {
        res.status(500).send('Internal Server Error');
    }
}
