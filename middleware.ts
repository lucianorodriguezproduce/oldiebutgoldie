// Use standard Web APIs for Vercel Edge Middleware in non-Next.js projects
// import { NextResponse } from 'next/server'; // REMOVED: Next.js only
// import type { NextRequest } from 'next/server'; // REMOVED: Next.js only

const BOTS = [
    'whatsapp',
    'facebookexternalhit',
    'twitterbot',
    'discordbot',
    'slackbot',
    'linkedinbot',
    'telegrambot',
    'googlebot', // Optional but good for SEO previews
];

export async function middleware(request: Request) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';
    
    // Check if the request is from a social media bot
    const isBot = BOTS.some(bot => userAgent.includes(bot));

    // Only intercept /item/:type/:id or /archivo/:id for bots
    const itemMatch = url.pathname.match(/\/item\/([^/]+)\/([^/]+)/);
    const archivoMatch = url.pathname.match(/\/archivo\/([^/]+)/);

    if (isBot && (itemMatch || archivoMatch)) {
        const type = itemMatch ? itemMatch[1] : 'release';
        const id = itemMatch ? itemMatch[2] : archivoMatch![1];

        // Only fetch from Firestore if it looks like a local UUID (Inventory Sovereign)
        // Non-local IDs (Discogs) would need a Discogs API fetch, but for now we focus on logistics.price
        // which is only in our Firestore for local assets or imported assets in 'inventory' collection.
        
        const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
        
        try {
            // Using Firestore REST API (Edge compatible)
            // We look into 'inventory' collection which contains the unified schema
            const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/inventory/${id}`;
            const response = await fetch(firestoreUrl);
            
            if (response.ok) {
                const data = await response.json();
                const fields = data.fields;

                // Extract fields (Firestore REST format is nested)
                const title = fields.metadata?.mapValue?.fields?.title?.stringValue || 'Colección Oldie But Goldie';
                const artist = fields.metadata?.mapValue?.fields?.artist?.stringValue || '';
                const price = fields.logistics?.mapValue?.fields?.price?.doubleValue || 
                              fields.logistics?.mapValue?.fields?.price?.integerValue || '0';
                const thumb = fields.media?.mapValue?.fields?.thumbnail?.stringValue || 
                              fields.media?.mapValue?.fields?.full_res_image_url?.stringValue || 
                              'https://www.oldiebutgoldie.com.ar/og-image.jpg';

                const metaTitle = `${artist} - ${title} | $${price} ARS`;
                const metaDesc = `Ítem disponible en Oldie But Goldie. Estado: ${fields.logistics?.mapValue?.fields?.condition?.stringValue || 'Verificado'}.`;

                // Return a minimal HTML with meta tags
                return new Response(
                    `<!DOCTYPE html>
                    <html>
                        <head>
                            <title>${metaTitle}</title>
                            <meta name="description" content="${metaDesc}" />
                            <meta property="og:type" content="music.album" />
                            <meta property="og:url" content="${url.href}" />
                            <meta property="og:title" content="${metaTitle}" />
                            <meta property="og:description" content="${metaDesc}" />
                            <meta property="og:image" content="${thumb}" />
                            <meta name="twitter:card" content="summary_large_image" />
                            <meta name="twitter:title" content="${metaTitle}" />
                            <meta name="twitter:description" content="${metaDesc}" />
                            <meta name="twitter:image" content="${thumb}" />
                            <meta http-equiv="refresh" content="0;url=${url.href}?no-bot=true" />
                        </head>
                        <body>
                            <h1>Redirigiendo a ${metaTitle}...</h1>
                        </body>
                    </html>`,
                    {
                        headers: { 'Content-Type': 'text/html' },
                    }
                );
            }
        } catch (error) {
            console.error('[SEO-Middleware] Error:', error);
            // Fallback to default index.html if fetch fails
        }
    }

    return // Standard pass-through via absence of response (or return undefined)
}

// Config to limit where the middleware runs
export const config = {
    matcher: ['/item/:type/:id', '/archivo/:id'],
};
