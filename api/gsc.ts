import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { initBunkerIdentity, getSecret } from './_lib/bunker.js';

const CACHE_DOC_PATH = 'system_cache/gsc_top_keywords';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { action } = req.query;

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const db = await initBunkerIdentity();
        const gscConfig = await db.collection('system_config').doc('gsc_auth').get();
        if (!gscConfig.exists || !gscConfig.data()?.refresh_token) {
            return res.status(401).json({ error: 'GSC not connected', needs_auth: true });
        }

        const siteUrl = (process.env.VITE_SITE_URL || `https://${req.headers.host}` || 'https://oldiebutgoldie.com.ar/').trim();
        const redirectUri = `${siteUrl.replace(/\/$/, '')}/api/auth/google/callback`;
        const clientId = await getSecret('GOOGLE_CLIENT_ID');
        const clientSecret = await getSecret('GOOGLE_CLIENT_SECRET');

        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
        oauth2Client.setCredentials({ refresh_token: gscConfig.data()?.refresh_token });
        await oauth2Client.getAccessToken();

        const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });

        if (action === 'inspect') {
            const { url } = req.body;
            if (!url) return res.status(400).json({ error: 'URL is required' });
            const result = await searchconsole.urlInspection.index.inspect({
                requestBody: { inspectionUrl: url, siteUrl: siteUrl, languageCode: 'es' }
            });
            const indexStatus = result.data.inspectionResult?.indexStatusResult;
            return res.status(200).json({
                url,
                verdict: indexStatus?.verdict,
                googleCanonical: indexStatus?.googleCanonical,
                coverageState: indexStatus?.coverageState
            });
        }

        // Default: Queries/Keywords
        const cacheRef = db.doc(CACHE_DOC_PATH);
        const cacheSnap = await cacheRef.get();
        if (cacheSnap.exists && (Date.now() - (cacheSnap.data()?.timestamp?.seconds * 1000 || 0) < CACHE_TTL_MS)) {
            return res.status(200).json(cacheSnap.data()?.keywords || []);
        }

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

        const keywords = (response.data.rows || []).map(row => ({
            query: row.keys?.[0] || 'Unknown',
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: (row.ctr || 0) * 100,
            position: row.position || 0
        }));

        await cacheRef.set({ keywords, timestamp: new Date(), siteUrl }, { merge: true });
        return res.status(200).json(keywords);

    } catch (error: any) {
        console.error('GSC Dynamic Error:', error.message);
        return res.status(200).json([]); // Fallback silent
    }
}
