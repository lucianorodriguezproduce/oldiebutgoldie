import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initBunkerIdentity } from './_lib/bunker.js';

const safeDate = (f: any) => {
    try {
        if (f && typeof f.toDate === 'function') return f.toDate().toISOString();
        if (f instanceof Date) return f.toISOString();
        return new Date().toISOString();
    } catch (e) {
        return new Date().toISOString();
    }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const db = await initBunkerIdentity();

        // Headers de seguridad y caché agresivo (24h)
        res.setHeader('Content-Type', 'text/xml; charset=utf-8');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');

        const host = req.headers.host || 'www.oldiebutgoldie.com.ar';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const baseUrl = `${protocol}://${host}`;

        const xmlEscape = (str: string) => str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

        const urlList: string[] = [];

        // 1. Páginas Estáticas
        urlList.push(`<url><loc>${xmlEscape(baseUrl)}/</loc><changefreq>always</changefreq><priority>1.0</priority></url>`);
        urlList.push(`<url><loc>${xmlEscape(baseUrl)}/comercio</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`);
        urlList.push(`<url><loc>${xmlEscape(baseUrl)}/comunidad</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`);
        urlList.push(`<url><loc>${xmlEscape(baseUrl)}/tienda</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`);
        urlList.push(`<url><loc>${xmlEscape(baseUrl)}/guias</loc><changefreq>weekly</changefreq><priority>0.4</priority></url>`);

        // 2. Inventario Soberano (Búnker)
        const inventorySnap = await db.collection('inventory')
            .where('logistics.status', '==', 'active')
            .limit(5000)
            .get();

        inventorySnap.forEach(doc => {
            const data = doc.data();
            const updatedAt = safeDate(data.updatedAt || data.timestamp || data.lastUpdated);
            const loc = `${baseUrl}/album/${doc.id}`;
            urlList.push(`<url><loc>${xmlEscape(loc)}</loc><lastmod>${updatedAt}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`);
        });

        // 4. El Archivo (The SEO Funnel)
        urlList.push(`<url><loc>${xmlEscape(baseUrl)}/archivo</loc><changefreq>always</changefreq><priority>0.9</priority></url>`);

        // Fetch all items from inventory and user_assets for the Archive
        const [archiveInvSnap, archiveAssetSnap] = await Promise.all([
            db.collection('inventory').where('logistics.status', '==', 'active').limit(1000).get(),
            db.collection('user_assets').where('status', '==', 'active').limit(1000).get()
        ]);

        archiveInvSnap.forEach(doc => {
            const data = doc.data();
            const updatedAt = safeDate(data.updatedAt || data.timestamp);
            const loc = `${baseUrl}/archivo/${doc.id}`;
            urlList.push(`<url><loc>${xmlEscape(loc)}</loc><lastmod>${updatedAt}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
        });

        archiveAssetSnap.forEach(doc => {
            const data = doc.data();
            const updatedAt = safeDate(data.acquiredAt || data.timestamp);
            const loc = `${baseUrl}/archivo/${doc.id}`;
            urlList.push(`<url><loc>${xmlEscape(loc)}</loc><lastmod>${updatedAt}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
        });

        // 5. Construcción Final (Sin espacios iniciales)
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlList.join('')}</urlset>`;

        return res.status(200).send(sitemap.trim());

    } catch (error: any) {
        console.error('Sitemap Critical Failure:', error.message);
        // Redacción de seguridad para no exponer llaves privadas en el error 500
        const safeMessage = (error.message || "Unknown Error").replace(/-----BEGIN PRIVATE KEY-----.*?-----END PRIVATE KEY-----/gs, "[REDACTED]");
        return res.status(500).send(`Sitemap generation failed: ${safeMessage}`);
    }
}