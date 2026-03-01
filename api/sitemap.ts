import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initBunkerIdentity } from './_lib/bunker.js';
const safeDate = (f: any) => (f && typeof f.toDate === 'function') ? f.toDate().toISOString() : new Date().toISOString();

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        // 1. Iniciamos la conexión al búnker (Centralizado)
        const db = await initBunkerIdentity();

        res.setHeader('Content-Type', 'text/xml; charset=utf-8');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        // Aggressive Cache for SEO stability: 24h edge cache, 12h stale-while-revalidate
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');

        const host = req.headers.host || 'www.oldiebutgoldie.com.ar';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const baseUrl = `${protocol}://${host}`;

        // Helper para escape de XML (Seguridad y Validez)
        const xmlEscape = (str: string) => str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

        // 2. Definición de Páginas Estáticas (Sin indentación accidental)
        let urls = `<url><loc>${xmlEscape(baseUrl)}/</loc><changefreq>always</changefreq><priority>1.0</priority></url>`;
        urls += `<url><loc>${xmlEscape(baseUrl)}/actividad</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`;
        urls += `<url><loc>${xmlEscape(baseUrl)}/editorial</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`;

        // 3. Extracción de Ítems de Inventario Soberano (Búnker)
        // Solo incluimos ítems activos (logistics.status === 'active')
        const inventorySnap = await db.collection('inventory')
            .where('logistics.status', '==', 'active')
            .limit(5000)
            .get();

        inventorySnap.forEach(doc => {
            const data = doc.data();
            const updatedAt = safeDate(data.updatedAt || data.timestamp);
            const loc = `${baseUrl}/album/${doc.id}`;

            urls += `<url><loc>${xmlEscape(loc)}</loc><lastmod>${updatedAt}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`;
        });

        // 4. Extracción de Artículos Editoriales
        const articlesSnap = await db.collection('articles').limit(100).get();

        articlesSnap.forEach(doc => {
            const data = doc.data();
            const updatedAt = safeDate(data.updatedAt || data.timestamp);
            const loc = `${baseUrl}/editorial/${doc.id}`;

            urls += `<url><loc>${xmlEscape(loc)}</loc><lastmod>${updatedAt}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`;
        });

        // 5. Construcción Final del XML (Bloque sólido)
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

        return res.status(200).send(sitemap.trim());

    } catch (error: any) {
        console.error('Sitemap Critical Failure:', error.message);

        // Redacción de seguridad en caso de error expuesto
        const safeMessage = (error.message || "")
            .replace(/\{"type": "service_account".*?\}/g, "[SERVICE_ACCOUNT_REDACTED]")
            .replace(/-----BEGIN PRIVATE KEY-----.*?-----END PRIVATE KEY-----/gs, "[PRIVATE_KEY_REDACTED]");

        return res.status(500).end(`Sitemap generation failed: ${safeMessage}`);
    }
}