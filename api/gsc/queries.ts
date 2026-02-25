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

/**
 * Endpoint to fetch GSC search analytics.
 * Uses refresh_token from Firestore to access the API.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        // 1. Get Refresh Token
        const gscConfig = await db.collection('system_config').doc('gsc_auth').get();
        if (!gscConfig.exists() || !gscConfig.data()?.refresh_token) {
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
        const siteUrl = process.env.VITE_SITE_URL || 'https://tudominio.com/'; // Ensure this matches GSC property

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

        // 4. Transform and Filter (Logic: Low CTR / High Impressions)
        const keywords = rows.map(row => ({
            query: row.keys?.[0] || 'Unknown',
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: (row.ctr || 0) * 100, // Scale to percentage
            position: row.position || 0
        }));

        res.status(200).json(keywords);
    } catch (error: any) {
        console.error('GSC Query Error:', error);
        res.status(500).json({ error: 'Failed to fetch GSC data', details: error.message });
    }
}
