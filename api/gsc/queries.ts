import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (Static fallback if needed)
if (!getApps().length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        initializeApp({
            credential: cert(serviceAccount)
        });
    } else {
        initializeApp();
    }
}

const db = getFirestore();
const CACHE_DOC_PATH = 'system_cache/gsc_top_keywords';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Endpoint to fetch GSC search analytics.
 * Checks Firestore cache first, then calls Google API if stale or missing.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        // 0. Check Firestore Cache
        const cacheRef = db.doc(CACHE_DOC_PATH);
        const cacheSnap = await cacheRef.get();
        const now = Date.now();

        if (cacheSnap.exists) {
            const cacheData = cacheSnap.data();
            const lastUpdated = cacheData?.timestamp?.toDate()?.getTime() || 0;
            if (now - lastUpdated < CACHE_TTL_MS) {
                console.log("Serving GSC data from Firestore cache");
                return res.status(200).json(cacheData?.keywords || []);
            }
        }

        // 1. Get Refresh Token
        const gscConfig = await db.collection('system_config').doc('gsc_auth').get();
        if (!gscConfig.exists || !gscConfig.data()?.refresh_token) {
            return res.status(401).json({ error: 'GSC not connected', needs_auth: true });
        }

        const refreshToken = gscConfig.data()?.refresh_token;

        // 2. Setup Google Client
        const oauth2Client = new google.auth.OAuth2(
            process.env.GSC_CLIENT_ID,
            process.env.GSC_CLIENT_SECRET,
            process.env.GSC_REDIRECT_URI
        );

        oauth2Client.setCredentials({ refresh_token: refreshToken });

        const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });

        // 3. Query Analytics
        const siteUrl = process.env.VITE_SITE_URL || 'https://oldiebutgoldie.com.ar/';

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

        // 4. Transform and Filter
        const keywords = rows.map(row => ({
            query: row.keys?.[0] || 'Unknown',
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: (row.ctr || 0) * 100, // Scale to percentage
            position: row.position || 0
        }));

        // 5. Update cache in Firestore
        await cacheRef.set({
            keywords,
            timestamp: new Date(),
            siteUrl
        });

        res.status(200).json(keywords);
    } catch (error: any) {
        console.error('GSC Query Error:', error);
        res.status(500).json({ error: 'Failed to fetch GSC data', details: error.message });
    }
}
