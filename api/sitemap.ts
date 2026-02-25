import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const secretClient = new SecretManagerServiceClient();

async function initBunkerIdentity() {
    console.log('Bunker: Accessing Secret Manager...');
    const [version] = await secretClient.accessSecretVersion({
        name: 'projects/344484307950/secrets/FIREBASE_ADMIN_SDK_JSON/versions/latest',
    });

    const payload = version.payload?.data?.toString();
    if (!payload) throw new Error('CRITICAL_IDENTITY_FAILURE: Secret payload empty');

    const sa = JSON.parse(payload);
    const rawKey = (sa.private_key || sa.privateKey || sa.private_key_id || '').trim();

    // FILTRO DE VACÍO (Seguridad Bunker): Aislamiento total del cuerpo
    const body = rawKey
        .replace(/\\n/g, '\n')
        .replace(/-----[^-]*-----/g, '')
        .replace(/\s/g, '')
        .trim();

    if (body.length < 1500) throw new Error("CRITICAL_INTEGRITY_FAILURE: Key body too short in Bunker.");

    const finalKey = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;

    const config = {
        projectId: (sa.project_id || sa.projectId || 'buscador-discogs-11425').trim(),
        clientEmail: (sa.client_email || sa.clientEmail || '').trim(),
        privateKey: finalKey,
    };

    if (getApps().length === 0) {
        initializeApp({ credential: cert(config) });
        console.log('Bunker: Firebase Initialized Successfully.');
    }
    return getFirestore();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
