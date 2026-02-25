import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// PROTOCOLO: ANTIGRAVITY-ATOMIC-FIX (Filtro de Vacío V2)
const getAdminConfig = () => {
    const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    let sa: any = {};
    if (creds && creds.trim().startsWith('{')) {
        try { sa = JSON.parse(creds); } catch (e) { console.error('JSON Parse failed'); }
    } else {
        sa = {
            project_id: process.env.FIREBASE_PROJECT_ID,
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            private_key: process.env.FIREBASE_PRIVATE_KEY
        };
    }

    let raw = (sa.private_key || sa.privateKey || sa.private_key_id || '').trim();
    if (raw.startsWith('{')) {
        try { raw = JSON.parse(raw).private_key || raw; } catch (e) { }
    }

    // ATOMIC VACUUM: Aislamiento total del cuerpo (Sin espacios ni marcadores previos)
    const body = raw
        .replace(/\\n/g, '\n')
        .replace(/-----[^-]*-----/g, '') // Strip ALL headers/footers
        .replace(/\s/g, '') // ELIMINACIÓN TOTAL (Vacuum)
        .trim();

    if (body.length < 1500) throw new Error("CRITICAL_INTEGRITY_FAILURE: Key body too short.");

    const finalKey = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;

    return {
        projectId: (sa.project_id || sa.projectId || process.env.FIREBASE_PROJECT_ID || 'buscador-discogs-11425').trim().replace(/^["']|["']$/g, ''),
        clientEmail: (sa.client_email || sa.clientEmail || process.env.FIREBASE_CLIENT_EMAIL || '').trim().replace(/^["']|["']$/g, ''),
        privateKey: finalKey,
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
