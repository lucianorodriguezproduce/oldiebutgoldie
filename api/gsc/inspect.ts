import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (Manual Identity Override)
if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
        initializeApp({
            credential: cert({
                projectId,
                clientEmail,
                privateKey
            })
        });
    } else {
        console.warn("Manual Firebase Admin config missing (Inspect). Falling back to default.");
        initializeApp();
    }
}

const db = getFirestore();

/**
 * Handler for URL Inspection.
 * Checks indexing status and canonicalization for a specific URL.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const gscConfig = await db.collection('system_config').doc('gsc_auth').get();
        if (!gscConfig.exists || !gscConfig.data()?.refresh_token) {
            return res.status(401).json({ error: 'GSC not connected' });
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            'https://www.oldiebutgoldie.com.ar/api/auth/google/callback'
        );

        oauth2Client.setCredentials({ refresh_token: gscConfig.data()?.refresh_token });
        const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });

        const siteUrl = process.env.VITE_SITE_URL || 'https://oldiebutgoldie.com.ar/';

        const request = {
            inspectionUrl: url,
            siteUrl: siteUrl,
            languageCode: 'es'
        };

        const result = await searchconsole.urlInspection.index.inspect({
            requestBody: request
        });

        const inspectionResult = result.data.inspectionResult;
        const indexStatus = inspectionResult?.indexStatusResult;

        // Log discrepancies if canonical is different from our target
        const googleCanonical = indexStatus?.googleCanonical;
        const userCanonical = indexStatus?.userCanonical;

        if (googleCanonical && userCanonical && googleCanonical !== userCanonical) {
            await db.collection('system_errors').add({
                type: 'CANONICAL_MISMATCH',
                url: url,
                googleCanonical,
                userCanonical,
                timestamp: new Date().toISOString()
            });
        }

        // Detect 404 or NoIndexed
        const verdict = indexStatus?.verdict; // "PASS", "FAIL", "NEUTRAL"
        const coverageState = indexStatus?.coverageState;

        if (verdict === 'FAIL' || coverageState?.includes('noindex')) {
            await db.collection('system_errors').add({
                type: 'CRAWL_ERROR',
                url: url,
                verdict,
                coverageState,
                timestamp: new Date().toISOString()
            });
        }

        res.status(200).json({
            url,
            verdict,
            googleCanonical,
            coverageState
        });

    } catch (error: any) {
        console.error('URL Inspection Error:', error);
        res.status(500).json({ error: 'Failed to inspect URL', details: error.message });
    }
}
