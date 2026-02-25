import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
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
