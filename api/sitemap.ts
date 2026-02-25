import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (Identity Sync)
if (!getApps().length) {
    const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (creds) {
        try {
            const serviceAccount = creds.startsWith('{') ? JSON.parse(creds) : JSON.parse(Buffer.from(creds, 'base64').toString());
            initializeApp({ credential: cert(serviceAccount) });
        } catch (e) {
            console.error("Firebase Admin Init Error (Sitemap):", e);
            initializeApp();
        }
    } else {
        initializeApp();
    }
}

const db = getFirestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');

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
        // Fetch Orders (Active Public Orders)
        const ordersSnap = await db.collection('orders')
            .where('status', '!=', 'venta_finalizada')
            .limit(1000)
            .get();

        ordersSnap.forEach(doc => {
            const data = doc.data();
            const updatedAt = data.updatedAt?.toDate()?.toISOString() || data.timestamp?.toDate()?.toISOString() || new Date().toISOString();
            urls += `
        <url>
            <loc>${baseUrl}/orden/${doc.id}</loc>
            <lastmod>${updatedAt}</lastmod>
            <changefreq>daily</changefreq>
            <priority>0.8</priority>
        </url>`;
        });

        // Fetch Editorial Articles
        const articlesSnap = await db.collection('articles')
            .limit(100)
            .get();

        articlesSnap.forEach(doc => {
            const data = doc.data();
            const updatedAt = data.updatedAt?.toDate()?.toISOString() || data.timestamp?.toDate()?.toISOString() || new Date().toISOString();
            urls += `
        <url>
            <loc>${baseUrl}/editorial/${doc.id}</loc>
            <lastmod>${updatedAt}</lastmod>
            <changefreq>daily</changefreq>
            <priority>0.8</priority>
        </url>`;
        });
    } catch (error) {
        console.error('Sitemap generation error:', error);
    }

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls}
</urlset>`;

    res.status(200).send(sitemap);
}
