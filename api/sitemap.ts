import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import admin from 'firebase-admin';
const secretClient = new SecretManagerServiceClient();

async function initBunkerIdentity() {
    console.log('Bunker: Accessing Secret Manager...');

    const [version] = await secretClient.accessSecretVersion({
        name: 'projects/344484307950/secrets/FIREBASE_ADMIN_SDK_JSON/versions/latest',
    });

    const payload = version.payload?.data?.toString();
    if (!payload) throw new Error('CRITICAL_IDENTITY_FAILURE: Secret payload empty');

    let serviceAccount;
    try {
        serviceAccount = typeof payload === 'string' ? JSON.parse(payload) : payload;
    } catch (e) {
        throw new Error("ERROR_CRITICO: El secreto del búnker no es un JSON válido.");
    }

    if (!serviceAccount.project_id || !serviceAccount.private_key) {
        throw new Error("ERROR_CRITICO: Objeto de identidad incompleto tras el parseo.");
    }

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Bunker: Firebase Initialized Successfully.');
    }
    return admin.firestore();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const db = await initBunkerIdentity();
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

        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls}
</urlset>`;

        res.status(200).send(sitemap);

    } catch (error: any) {
        console.error('Sitemap Error:', error);
        // REDACCIÓN DE SEGURIDAD (Búnker)
        const safeMessage = (error.message || "")
            .replace(/\{"type": "service_account".*?\}/g, "[SERVICE_ACCOUNT_REDACTED]")
            .replace(/-----BEGIN PRIVATE KEY-----.*?-----END PRIVATE KEY-----/gs, "[PRIVATE_KEY_REDACTED]");

        res.status(500).end(`Sitemap generation failed: ${safeMessage}`);
    }
}
