import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// NEUTRALIZACIÓN DIFERIDA DE INFRAESTRUCTURA (Búnker)
if (process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_APPLICATION_CREDENTIALS.includes('/')) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "";
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const secretClient = new SecretManagerServiceClient();

async function initBunkerIdentity() {
    console.log('Bunker: Accessing Secret Manager...');

    const [version] = await secretClient.accessSecretVersion({
        name: 'projects/344484307950/secrets/FIREBASE_ADMIN_SDK_JSON/versions/latest',
    });

    const payload = version.payload?.data?.toString();
    if (!payload) throw new Error('CRITICAL_IDENTITY_FAILURE: Secret payload empty');

    const serviceAccount = JSON.parse(payload);

    if (getApps().length === 0) {
        initializeApp({ credential: cert(serviceAccount) });
        console.log('Bunker: Firebase Initialized Successfully.');
    }
    return getFirestore();
}

async function getSecret(name: string) {
    try {
        const [version] = await secretClient.accessSecretVersion({
            name: `projects/344484307950/secrets/${name}/versions/latest`,
        });
        return version.payload?.data?.toString();
    } catch (e) {
        console.warn(`CRITICAL_SECRET_FETCH_FAILURE: ${name} not found in Bunker.`);
        return undefined;
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const db = await initBunkerIdentity();
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const gscConfig = await db.collection('system_config').doc('gsc_auth').get();
        if (!gscConfig.exists || !gscConfig.data()?.refresh_token) {
            return res.status(401).json({ error: 'GSC not connected' });
        }

        const siteUrl = process.env.VITE_SITE_URL || `https://${req.headers.host}` || 'https://oldiebutgoldie.com.ar/';
        const redirectUri = `${siteUrl.replace(/\/$/, '')}/api/auth/google/callback`;

        const clientId = await getSecret('GOOGLE_CLIENT_ID');
        const clientSecret = await getSecret('GOOGLE_CLIENT_SECRET');

        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri
        );

        oauth2Client.setCredentials({ refresh_token: gscConfig.data()?.refresh_token });
        await oauth2Client.getAccessToken();

        const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });

        const result = await searchconsole.urlInspection.index.inspect({
            requestBody: { inspectionUrl: url, siteUrl: siteUrl, languageCode: 'es' }
        });

        const inspectionResult = result.data.inspectionResult;
        const indexStatus = inspectionResult?.indexStatusResult;

        res.status(200).json({
            url,
            verdict: indexStatus?.verdict,
            googleCanonical: indexStatus?.googleCanonical,
            coverageState: indexStatus?.coverageState
        });

    } catch (error: any) {
        console.error('URL Inspection Error:', error);
        // REDACCIÓN DE SEGURIDAD (Búnker)
        const safeMessage = (error.message || "")
            .replace(/\{"type": "service_account".*?\}/g, "[SERVICE_ACCOUNT_REDACTED]")
            .replace(/-----BEGIN PRIVATE KEY-----.*?-----END PRIVATE KEY-----/gs, "[PRIVATE_KEY_REDACTED]");

        res.status(500).json({ error: 'Failed to inspect URL', details: safeMessage });
    }
}
