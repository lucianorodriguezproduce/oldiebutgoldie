import admin from 'firebase-admin';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// Explicit client configuration to avoid auto-detection failure in Vercel
const secretClient = new SecretManagerServiceClient({
    credentials: JSON.parse(process.env.FIREBASE_CONFIG_JSON_STRING || '{}'),
    projectId: 'buscador-discogs-11425'
});

/**
 * Ensures Firebase Admin SDK is initialized with a forced JSON object from Secret Manager.
 */
export async function initBunkerIdentity() {
    const [version] = await secretClient.accessSecretVersion({
        name: 'projects/344484307950/secrets/FIREBASE_ADMIN_SDK_JSON/versions/latest',
    });

    const payload = version.payload?.data?.toString();
    if (!payload) throw new Error('CRITICAL_IDENTITY_FAILURE: Bunker empty');

    // PROTOCOLO DE SEGURIDAD: Force conversion to Object
    const serviceAccount = JSON.parse(payload);

    // Deployment verification log (Tactical Directive 3)
    console.log('Bunker Check:', typeof serviceAccount);
    if (typeof serviceAccount !== 'object') {
        throw new Error("ERROR_CRITICO: serviceAccount is not an object after parsing.");
    }

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Bunker: Firebase Initialized Successfully (Centralized).');
    }
    return admin.firestore();
}

/**
 * Retrieves a secret value as a string from Secret Manager.
 */
export async function getSecret(name: string) {
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

/**
 * Specialized helper for the Discogs API Token.
 */
export async function getDiscogsToken() {
    return getSecret('DISCOGS_API_TOKEN');
}

export { secretClient };
