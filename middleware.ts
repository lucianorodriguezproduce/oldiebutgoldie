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

    // Match rules
    const itemMatch = url.pathname.match(/\/item\/([^/]+)\/([^/]+)/);
    const archivoMatch = url.pathname.match(/\/archivo\/([^/]+)/);

    const isItemRoute = itemMatch || archivoMatch;
    
    // We want branding info for BOTH item routes (as fallback) and potentially other routes
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;

    // 1. Fetch Dynamic Branding (V98.0)
    let dynamicLogo = 'https://www.oldiebutgoldie.com.ar/og-image.jpg'; // Hard fallback
    try {
        const configUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/site_config`;
        const configRes = await fetch(configUrl);
        if (configRes.ok) {
            const configData = await configRes.json();
            dynamicLogo = configData.fields.logo?.mapValue?.fields?.url?.stringValue || dynamicLogo;
        }
    } catch (e) {
        console.error('[SEO-Middleware] Branding Fetch Error:', e);
    }

    if (isBot && isItemRoute) {
        const id = itemMatch ? itemMatch[2] : archivoMatch![1];
        
        try {
            // Using Firestore REST API (Edge compatible)
            const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/inventory/${id}`;
            const response = await fetch(firestoreUrl);
            
            if (response.ok) {
                const data = await response.json();
                const fields = data.fields;

                // Extract fields
                const title = fields.metadata?.mapValue?.fields?.title?.stringValue || 'Colección Oldie But Goldie';
                const artist = fields.metadata?.mapValue?.fields?.artist?.stringValue || '';
                const price = fields.logistics?.mapValue?.fields?.price?.doubleValue || 
                              fields.logistics?.mapValue?.fields?.price?.integerValue || '0';
                const thumb = fields.media?.mapValue?.fields?.thumbnail?.stringValue || 
                              fields.media?.mapValue?.fields?.full_res_image_url?.stringValue || 
                              dynamicLogo;

                const metaTitle = `${artist} - ${title} | $${price} ARS`;
                const metaDesc = `Ítem disponible en Oldie But Goldie. Estado: ${fields.logistics?.mapValue?.fields?.condition?.stringValue || 'Verificado'}.`;

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
                    { headers: { 'Content-Type': 'text/html' } }
                );
            }
        } catch (error) {
            console.error('[SEO-Middleware] Item Fetch Error:', error);
        }
    }

    return; // Pass-through
}

// Config to limit where the middleware runs
export const config = {
    matcher: ['/item/:type/:id', '/archivo/:id'],
};
