import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { initBunkerIdentity, getSecret } from '../_lib/bunker.js';

const CACHE_DOC_PATH = 'system_cache/gsc_top_keywords';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const db = await initBunkerIdentity().catch(err => {
            console.error('Bunker Identity Failed:', err);
            return null;
        });

        if (!db) {
            return res.status(200).json([]); // Silent fallback
        }

        const cacheRef = db.doc(CACHE_DOC_PATH);
        const cacheSnap = await cacheRef.get().catch(() => null);
        const now = Date.now();

        if (cacheSnap && cacheSnap.exists) {
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

        const gscConfig = await db.collection('system_config').doc('gsc_auth').get().catch(() => null);
        if (!gscConfig || !gscConfig.exists || !gscConfig.data()?.refresh_token) {
            // Signal needs_auth but don't crash the dashboard with a 500
            if (req.query.silent === '1') return res.status(200).json([]);
            return res.status(401).json({ error: 'GSC not connected', needs_auth: true, redirect: '/api/auth/gsc-init' });
        }

        const refreshToken = gscConfig.data()?.refresh_token;

        let siteUrl = (process.env.VITE_SITE_URL || `https://${req.headers.host}` || 'https://www.oldiebutgoldie.com.ar/').trim();
        if (!siteUrl.endsWith('/')) siteUrl += '/';

        const redirectUri = `${siteUrl.replace(/\/$/, '')}/api/auth/google/callback`;

        const clientId = await getSecret('GOOGLE_CLIENT_ID');
        const clientSecret = await getSecret('GOOGLE_CLIENT_SECRET');

        if (!clientId || !clientSecret) {
            console.error('GOOGLE_CLIENT secrets missing');
            return res.status(200).json([]);
        }

        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri
        );

        oauth2Client.setCredentials({ refresh_token: refreshToken });

        // Refresh access token
        await oauth2Client.getAccessToken().catch(err => {
            console.error('GSC Token Refresh Failed:', err.message);
            throw new Error('TOKEN_EXPIRED');
        });

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

        await cacheRef.set({ keywords, timestamp: new Date(), siteUrl }, { merge: true }).catch(() => null);

        res.status(200).json(keywords);

    } catch (error: any) {
        console.error('GSC Query Error (Stabilized):', error.message);

        // Redact and return safe response
        if (error.message === 'TOKEN_EXPIRED') {
            return res.status(401).json({ error: 'Session expired', needs_auth: true });
        }

        // Always return 200 [] on unexpected errors to keep admin dashboard alive
        return res.status(200).json([]);
    }
}
