import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// PROTOCOLO: PEM-REWRAP-STABILIZER (Architectural Identity Reset)
const getAdminConfig = () => {
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentials) throw new Error('GOOGLE_APPLICATION_CREDENTIALS missing');
    let serviceAccount;
    try {
        serviceAccount = typeof credentials === 'string' && credentials.trim().startsWith('{')
            ? JSON.parse(credentials)
            : null;
    } catch (e) {
        console.error('JSON Parse failed for GOOGLE_APPLICATION_CREDENTIALS');
    }
    if (!serviceAccount) {
        serviceAccount = {
            project_id: process.env.FIREBASE_PROJECT_ID,
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            private_key: process.env.FIREBASE_PRIVATE_KEY
        };
    }
    const rawKey = (serviceAccount.private_key || serviceAccount.privateKey || '').trim();
    let decodedKey = rawKey.includes('LS0t')
        ? Buffer.from(rawKey.replace(/^["']|["']$/g, ''), 'base64').toString('utf-8')
        : rawKey;
    decodedKey = decodedKey.replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\r/g, '').replace(/\\ /g, ' ');
    const header = '-----BEGIN PRIVATE KEY-----', footer = '-----END PRIVATE KEY-----';
    let cleanBase64 = decodedKey.replace(header, '').replace(footer, '').replace(/\s/g, '');
    const lines = cleanBase64.match(/.{1,64}/g) || [];
    return {
        projectId: (serviceAccount.project_id || serviceAccount.projectId || '').trim().replace(/^["']|["']$/g, ''),
        clientEmail: (serviceAccount.client_email || serviceAccount.clientEmail || '').trim().replace(/^["']|["']$/g, ''),
        privateKey: `${header}\n${lines.join('\n')}\n${footer}`,
    };
};
const app = getApps().length === 0 ? initializeApp({ credential: cert(getAdminConfig()) }) : getApp();

const db = getFirestore(app);

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
