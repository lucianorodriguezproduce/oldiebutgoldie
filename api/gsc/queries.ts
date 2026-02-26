import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { initBunkerIdentity, getSecret } from '../_lib/bunker';

const CACHE_DOC_PATH = 'system_cache/gsc_top_keywords';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const db = await initBunkerIdentity();
        // ... existing cache logic ...
        const cacheRef = db.doc(CACHE_DOC_PATH);
        const cacheSnap = await cacheRef.get();
        const now = Date.now();

        if (cacheSnap.exists) {
            const cacheData = cacheSnap.data();
            const ts = cacheData?.timestamp;
            let lastUpdated = 0;
            if (ts) {
                if (typeof ts.toDate === 'function') lastUpdated = ts.toDate().getTime();
                else if (ts instanceof Date) lastUpdated = ts.getTime();
                else if (ts.seconds) lastUpdated = ts.seconds * 1000;
            }

            if (now - lastUpdated < CACHE_TTL_MS) {
                return res.status(200).json(cacheData?.keywords || []);
            }
        }

        const gscConfig = await db.collection('system_config').doc('gsc_auth').get();
        // ... existing config check ...
        if (!gscConfig.exists || !gscConfig.data()?.refresh_token) {
            return res.status(401).json({ error: 'GSC not connected', needs_auth: true, redirect: '/api/auth/gsc-init' });
        }

        const refreshToken = gscConfig.data()?.refresh_token;

        const siteUrl = process.env.VITE_SITE_URL || `https://${req.headers.host}` || 'https://oldiebutgoldie.com.ar/';
        const redirectUri = `${siteUrl.replace(/\/$/, '')}/api/auth/google/callback`;

        const clientId = await getSecret('GOOGLE_CLIENT_ID');
        const clientSecret = await getSecret('GOOGLE_CLIENT_SECRET');

        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri
        );

        oauth2Client.setCredentials({ refresh_token: refreshToken });
        await oauth2Client.getAccessToken();

        const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });

        const response = await searchconsole.searchanalytics.query({
            siteUrl,
            requestBody: {
                startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0],
                dimensions: ['query'],
                rowLimit: 100,
                aggregationType: 'auto'
            }
        });

        const rows = response.data.rows || [];
        const keywords = rows.map(row => ({
            query: row.keys?.[0] || 'Unknown',
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: (row.ctr || 0) * 100,
            position: row.position || 0
        }));

        await cacheRef.set({ keywords, timestamp: new Date(), siteUrl }, { merge: true });

        res.status(200).json(keywords);

    } catch (error: any) {
        console.error('GSC Query Error:', error);
        // REDACCIÓN DE SEGURIDAD (Búnker)
        const safeMessage = (error.message || "")
            .replace(/\{"type": "service_account".*?\}/g, "[SERVICE_ACCOUNT_REDACTED]")
            .replace(/-----BEGIN PRIVATE KEY-----.*?-----END PRIVATE KEY-----/gs, "[PRIVATE_KEY_REDACTED]");

        res.status(500).json({
            error: 'Failed to fetch GSC data',
            details: safeMessage,
            stack: process.env.NODE_ENV === 'development' ? (error.stack?.includes("service_account") ? "Redacted" : error.stack) : undefined
        });
    }
}
