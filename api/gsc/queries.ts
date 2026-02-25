import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// PROTOCOLO: PEM-REWRAP-STABILIZER
const normalizeEnvVar = (val: string | undefined) => (val || '').trim().replace(/^["']|["']$/g, '');
const rawKey = normalizeEnvVar(process.env.FIREBASE_PRIVATE_KEY);
let decodedKey = rawKey.includes('LS0t')
    ? Buffer.from(rawKey, 'base64').toString('utf-8')
    : rawKey;

decodedKey = decodedKey.replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\r/g, '').replace(/\\ /g, ' ');
const header = '-----BEGIN PRIVATE KEY-----';
const footer = '-----END PRIVATE KEY-----';
let cleanBase64 = decodedKey.replace(header, '').replace(footer, '').replace(/\s/g, '');
const lines = cleanBase64.match(/.{1,64}/g) || [];
const finalKey = `${header}\n${lines.join('\n')}\n${footer}`;

const adminConfig = {
    projectId: normalizeEnvVar(process.env.FIREBASE_PROJECT_ID),
    clientEmail: normalizeEnvVar(process.env.FIREBASE_CLIENT_EMAIL),
    privateKey: finalKey,
};

const app = getApps().length === 0
    ? initializeApp({ credential: cert(adminConfig) })
    : getApp();

const db = getFirestore(app);
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
            const ts = cacheData?.timestamp;

            // Robust Timestamp to Date conversion
            let lastUpdated = 0;
            if (ts) {
                if (typeof ts.toDate === 'function') {
                    lastUpdated = ts.toDate().getTime();
                } else if (ts instanceof Date) {
                    lastUpdated = ts.getTime();
                } else if (ts.seconds) { // Plain object from some clients
                    lastUpdated = ts.seconds * 1000;
                }
            }

            if (now - lastUpdated < CACHE_TTL_MS) {
                console.log("Serving GSC data from Firestore cache");
                return res.status(200).json(cacheData?.keywords || []);
            }
        }

        // 1. Get Refresh Token
        const gscConfig = await db.collection('system_config').doc('gsc_auth').get();
        if (!gscConfig.exists || !gscConfig.data()?.refresh_token) {
            console.warn("GSC Auth missing in Firestore. Returning 401.");
            return res.status(401).json({
                error: 'GSC not connected',
                needs_auth: true,
                redirect: '/api/auth/gsc-init'
            });
        }

        const refreshToken = gscConfig.data()?.refresh_token;

        // 2. Setup Google Client
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            'https://www.oldiebutgoldie.com.ar/api/auth/google/callback'
        );

        oauth2Client.setCredentials({ refresh_token: refreshToken });
        const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });

        // 3. Query Analytics
        // GSC Property URL MUST be exact. Usually https://example.com/ or sc-domain:example.com
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

        // 4. Transform
        const keywords = rows.map(row => ({
            query: row.keys?.[0] || 'Unknown',
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: (row.ctr || 0) * 100,
            position: row.position || 0
        }));

        // 5. Update cache in Firestore
        await cacheRef.set({
            keywords,
            timestamp: new Date(), // Stored as Timestamp in Admin SDK
            siteUrl
        }, { merge: true });

        res.status(200).json(keywords);
    } catch (error: any) {
        console.error('GSC Query Error:', error);
        // Return a JSON error even if it's a 500 to avoid response.json() failing on frontend
        res.status(500).json({
            error: 'Failed to fetch GSC data',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
