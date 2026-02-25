import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200'); // Cache for 24h at the edge

    const host = req.headers.host || 'oldiebutgoldie.com.ar';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // Static Pages
    let urls = `
        <url>
            <loc>${baseUrl}/</loc>
            <changefreq>daily</changefreq>
            <priority>1.0</priority>
        </url>
        <url>
            <loc>${baseUrl}/actividad</loc>
            <changefreq>daily</changefreq>
            <priority>0.9</priority>
        </url>
        <url>
            <loc>${baseUrl}/editorial</loc>
            <changefreq>daily</changefreq>
            <priority>0.9</priority>
        </url>
        <url>
            <loc>${baseUrl}/eventos</loc>
            <changefreq>daily</changefreq>
            <priority>0.8</priority>
        </url>
    `;

    try {
        const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'intras-projects';

        // Fetch Orders
        const ordersUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/orders?pageSize=1000`;
        const ordersRes = await fetch(ordersUrl);

        if (ordersRes.ok) {
            const data = await ordersRes.json();
            if (data.documents && Array.isArray(data.documents)) {
                data.documents.forEach((doc: any) => {
                    const orderId = doc.name.split('/').pop();
                    const updatedAt = doc.updateTime || doc.createTime;
                    const status = doc.fields?.status?.stringValue;
                    if (orderId && status !== 'venta_finalizada') {
                        urls += `
        <url>
            <loc>${baseUrl}/orden/${orderId}</loc>
            <lastmod>${updatedAt}</lastmod>
            <changefreq>daily</changefreq>
            <priority>0.8</priority>
        </url>`;
                    }
                });
            }
        }

        // Fetch Editorial Articles
        const articlesUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/articles?pageSize=100`;
        const articlesRes = await fetch(articlesUrl);

        if (articlesRes.ok) {
            const data = await articlesRes.json();
            if (data.documents && Array.isArray(data.documents)) {
                data.documents.forEach((doc: any) => {
                    const articleId = doc.name.split('/').pop();
                    const updatedAt = doc.updateTime || doc.createTime;
                    if (articleId) {
                        urls += `
        <url>
            <loc>${baseUrl}/editorial/${articleId}</loc>
            <lastmod>${updatedAt}</lastmod>
            <changefreq>daily</changefreq>
            <priority>0.8</priority>
        </url>`;
                    }
                });
            }
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
