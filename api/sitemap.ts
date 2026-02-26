import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initBunkerIdentity } from './_lib/bunker.js';
const safeDate = (f: any) => (f && typeof f.toDate === 'function') ? f.toDate().toISOString() : new Date().toISOString();

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        // 1. Iniciamos la conexión al búnker (Centralizado)
        const db = await initBunkerIdentity();

        res.setHeader('Content-Type', 'text/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');

        const host = req.headers.host || 'oldiebutgoldie.com.ar';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const baseUrl = `${protocol}://${host}`;

        // 2. Definición de Páginas Estáticas
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
        `;

        // 3. Extracción de Órdenes Activas
        const ordersSnap = await db.collection('orders')
            .where('status', '!=', 'venta_finalizada')
            .limit(1000)
            .get();

        ordersSnap.forEach(doc => {
            const data = doc.data();
            // Fallback de fecha seguroconst updatedAt = safeDate(data.updatedAt || data.timestamp);

            urls += `
            <url>
                <loc>${baseUrl}/orden/${doc.id}</loc>
                <lastmod>${updatedAt}</lastmod>
                <changefreq>daily</changefreq>
                <priority>0.8</priority>
            </url>`;
        });

        // 4. Extracción de Artículos Editoriales
        const articlesSnap = await db.collection('articles').limit(100).get();

        articlesSnap.forEach(doc => {
            const data = doc.data();
            const updatedAt = safeDate(data.updatedAt || data.timestamp); urls += `
            <url>
                <loc>${baseUrl}/editorial/${doc.id}</loc>
                <lastmod>${updatedAt}</lastmod>
                <changefreq>daily</changefreq>
                <priority>0.8</priority>
            </url>`;
        });

        // 5. Construcción Final del XML
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls}
</urlset>`;

        return res.status(200).send(sitemap);

    } catch (error: any) {
        console.error('Sitemap Critical Failure:', error.message);

        // Redacción de seguridad en caso de error expuesto
        const safeMessage = (error.message || "")
            .replace(/\{"type": "service_account".*?\}/g, "[SERVICE_ACCOUNT_REDACTED]")
            .replace(/-----BEGIN PRIVATE KEY-----.*?-----END PRIVATE KEY-----/gs, "[PRIVATE_KEY_REDACTED]");

        return res.status(500).end(`Sitemap generation failed: ${safeMessage}`);
    }
}