import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// PROTOCOLO: PEM-REWRAP-STABILIZER (Architectural Identity Reset)
const getAdminConfig = () => {
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentials) throw new Error('GOOGLE_APPLICATION_CREDENTIALS missing');
    let serviceAccount;
    try {
        serviceAccount = typeof credentials === 'string' && credentials.trim().startsWith('{')
            ? JSON.parse(credentials)
            : null;
    } catch (e) {
        console.error('JSON Parse failed for GOOGLE_APPLICATION_CREDENTIALS');
    }
    if (!serviceAccount) {
        serviceAccount = {
            project_id: process.env.FIREBASE_PROJECT_ID,
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            private_key: process.env.FIREBASE_PRIVATE_KEY
        };
    }
    const rawKey = (serviceAccount.private_key || serviceAccount.privateKey || '').trim();
    let decodedKey = rawKey.includes('LS0t')
        ? Buffer.from(rawKey.replace(/^["']|["']$/g, ''), 'base64').toString('utf-8')
        : rawKey;
    decodedKey = decodedKey.replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\r/g, '').replace(/\\ /g, ' ');
    const header = '-----BEGIN PRIVATE KEY-----', footer = '-----END PRIVATE KEY-----';
    let cleanBase64 = decodedKey.replace(header, '').replace(footer, '').replace(/\s/g, '');
    const lines = cleanBase64.match(/.{1,64}/g) || [];
    return {
        projectId: (serviceAccount.project_id || serviceAccount.projectId || '').trim().replace(/^["']|["']$/g, ''),
        clientEmail: (serviceAccount.client_email || serviceAccount.clientEmail || '').trim().replace(/^["']|["']$/g, ''),
        privateKey: `${header}\n${lines.join('\n')}\n${footer}`,
    };
};
const app = getApps().length === 0 ? initializeApp({ credential: cert(getAdminConfig()) }) : getApp();
const db = getFirestore(app);

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

        const siteUrl = process.env.VITE_SITE_URL || `https://${req.headers.host}` || 'https://oldiebutgoldie.com.ar/';
        const redirectUri = `${siteUrl.replace(/\/$/, '')}/api/auth/google/callback`;

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            redirectUri
        );

        oauth2Client.setCredentials({ refresh_token: gscConfig.data()?.refresh_token });

        // Force token exchange
        await oauth2Client.getAccessToken();

        const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });

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
