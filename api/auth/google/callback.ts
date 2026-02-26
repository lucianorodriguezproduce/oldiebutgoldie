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
        const { code } = req.query;

        if (!code) {
            return res.status(400).send('No code provided');
        }

        const clientId = await getSecret('GOOGLE_CLIENT_ID');
        const clientSecret = await getSecret('GOOGLE_CLIENT_SECRET');

        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            'https://www.oldiebutgoldie.com.ar/api/auth/google/callback'
        );
        // ... existing callback logic ...
        const { tokens } = await oauth2Client.getToken(code as string);

        if (tokens.refresh_token) {
            await db.collection('system_config').doc('gsc_auth').set({
                refresh_token: tokens.refresh_token,
                last_updated: new Date().toISOString(),
                status: 'active'
            }, { merge: true });

            res.redirect('/admin/analytics?gsc=success');
        } else {
            res.redirect('/admin/analytics?gsc=partial');
        }
    } catch (error: any) {
        console.error('GSC OAuth Callback Error:', error);
        res.redirect('/admin/analytics?gsc=error');
    }
}
