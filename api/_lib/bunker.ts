import admin from 'firebase-admin';
import { google } from 'googleapis';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// IMPORTANTE: En Vercel, asegúrese de que esta variable sea exactamente el JSON de su Service Account
const rawConfig = process.env.FIREBASE_CONFIG_JSON_STRING || '{}';
const credentials = JSON.parse(rawConfig);

const secretClient = new SecretManagerServiceClient({
    credentials,
    projectId: credentials.project_id || 'buscador-discogs-11425'
});

export async function initBunkerIdentity() {
    // Si ya hay una app, devolvemos Firestore inmediatamente para ahorrar tiempo
    if (admin.apps.length) return admin.firestore();

    console.log('Bunker: Accediendo al Secret Manager...');
    const [version] = await secretClient.accessSecretVersion({
        name: 'projects/344484307950/secrets/FIREBASE_ADMIN_SDK_JSON/versions/latest',
    });

    const payload = version.payload?.data?.toString();
    if (!payload) throw new Error('CRITICAL_IDENTITY_FAILURE: Bunker empty');

    const serviceAccount = JSON.parse(payload);

    // Verificación táctica de tipo
    if (typeof serviceAccount !== 'object') {
        throw new Error("ERROR_CRITICO: serviceAccount no es un objeto tras el parseo.");
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    console.log('Bunker: Firebase Initialized (Centralized).');
    return admin.firestore();
}

export async function getSecret(name: string) {
    try {
        const [version] = await secretClient.accessSecretVersion({
            name: `projects/344484307950/secrets/${name}/versions/latest`,
        });
        return version.payload?.data?.toString();
    } catch (e) {
        console.warn(`CRITICAL_SECRET_FETCH_FAILURE: ${name} no encontrado.`);
        return undefined;
    }
}

export async function getDiscogsToken() {
    return getSecret('DISCOGS_API_TOKEN');
}

/**
 * Initializes and returns a Google Drive API client using credentials from the Bunker.
 */
export async function initDriveIdentity() {
    const [version] = await secretClient.accessSecretVersion({
        name: 'projects/344484307950/secrets/FIREBASE_ADMIN_SDK_JSON/versions/latest',
    });

    const payload = version.payload?.data?.toString();
    if (!payload) throw new Error('BUNKER_EMPTY');
    const credentials = JSON.parse(payload);

    const auth = new google.auth.JWT(
        credentials.client_email,
        undefined,
        credentials.private_key,
        ['https://www.googleapis.com/auth/drive']
    );

    return google.drive({ version: 'v3', auth });
}

export { secretClient };