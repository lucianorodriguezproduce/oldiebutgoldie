import type { VercelRequest, VercelResponse } from '@vercel/node';
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

    const secretData = JSON.parse(payload);

    if (getApps().length === 0) {
        initializeApp({ credential: cert(secretData) });
        console.log('Bunker: Firebase Initialized Successfully.');
    }
    return getFirestore();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const db = await initBunkerIdentity();

        // Simular verificación de drive o lógica de upload
        res.status(200).json({ status: 'OK', bunker: 'STABILIZED' });

    } catch (error: any) {
        console.error('Drive Upload Error:', error);
        // REDACCIÓN DE SEGURIDAD (Búnker)
        const safeMessage = (error.message || "")
            .replace(/\{"type": "service_account".*?\}/g, "[SERVICE_ACCOUNT_REDACTED]")
            .replace(/-----BEGIN PRIVATE KEY-----.*?-----END PRIVATE KEY-----/gs, "[PRIVATE_KEY_REDACTED]");

        res.status(500).json({ error: 'Drive verification failed', details: safeMessage });
    }
}
