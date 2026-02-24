import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200'); // Cache for 24h at the edge

    const host = req.headers.host || 'www.oldiebutgoldie.com.ar';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // We use the REST API of Firestore directly to sidestep any edge-runtime bundling issues with the Firebase Web SDK
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'intras-projects';
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/orders?pageSize=500`;

    let urls = `
        <url>
            <loc>${baseUrl}/</loc>
            <changefreq>daily</changefreq>
            <priority>1.0</priority>
        </url>
        <url>
            <loc>${baseUrl}/actividad</loc>
            <changefreq>hourly</changefreq>
            <priority>0.9</priority>
        </url>
    `;

    try {
        const response = await fetch(firestoreUrl);

        if (response.ok) {
            const data = await response.json();

            if (data.documents && Array.isArray(data.documents)) {
                data.documents.forEach((doc: any) => {
                    const fields = doc.fields;
                    if (!fields) return;

                    const itemType = fields.itemType?.stringValue;
                    const itemId = fields.itemId?.stringValue;
                    const updatedAt = doc.updateTime || doc.createTime;

                    if (itemType && itemId) {
                        urls += `
        <url>
            <loc>${baseUrl}/item/${itemType}/${itemId}</loc>
            <lastmod>${updatedAt}</lastmod>
            <changefreq>weekly</changefreq>
            <priority>0.8</priority>
        </url>`;
                    }
                });
            }
        } else {
            console.error("Failed to fetch Firebase orders for sitemap", response.statusText);
        }
    } catch (error) {
        console.error('Sitemap generation error:', error);
    }

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls}
</urlset>`;

    res.status(200).send(sitemap);
}
