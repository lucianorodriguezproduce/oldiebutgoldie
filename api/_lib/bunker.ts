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

/**
 * Shared helper to upload a Base64 file to Google Drive and return a public link.
 * Folder: Oldie_Assets (1djP4_hmGCbzgH-WMNSrek46VySg-gVs4)
 */
export async function uploadToDrive(base64: string, fileName: string, mimeType: string) {
    const drive = await initDriveIdentity();
    const folderId = '1djP4_hmGCbzgH-WMNSrek46VySg-gVs4';

    // 1. Clean Base64
    const cleanBase64 = base64.includes('base64,') ? base64.split('base64,')[1] : base64;
    const buffer = Buffer.from(cleanBase64, 'base64');

    // 2. Prepare Stream
    const { Readable } = await import('stream');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    console.log(`Bunker: Uploading ${fileName} to Drive Folder ${folderId}...`);

    // 3. Upload File
    const driveRes = await drive.files.create({
        requestBody: {
            name: fileName,
            parents: [folderId],
        },
        media: {
            mimeType: mimeType,
            body: stream,
        },
        supportsAllDrives: true,
        fields: 'id',
    } as any);

    const fileId = driveRes.data.id;
    if (!fileId) throw new Error('Drive upload failed: No ID returned');

    // 4. Set Public Permissions
    await drive.permissions.create({
        fileId: fileId,
        requestBody: { role: 'reader', type: 'anyone' },
        supportsAllDrives: true,
    });

    // 5. Standard Public URL (UC direct view)
    const publicUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

    return {
        fileId,
        url: publicUrl
    };
}

/**
 * Shared helper to upload a Base64 file to Firebase Storage (Bunker) and return a public link.
 */
export async function uploadToBunker(base64: string, path: string, mimeType: string) {
    await initBunkerIdentity();
    const bucket = admin.storage().bucket(); // Default bucket

    // 1. Clean Base64
    const cleanBase64 = base64.includes('base64,') ? base64.split('base64,')[1] : base64;
    const buffer = Buffer.from(cleanBase64, 'base64');

    console.log(`Bunker Storage: Uploading to ${path} (${mimeType})...`);

    const file = bucket.file(path);

    // 2. Save file and make public
    await file.save(buffer, {
        metadata: {
            contentType: mimeType,
            cacheControl: 'public, max-age=31536000'
        },
        public: true,
        resumable: false // Better for small serverless payloads
    });

    // 3. Construct Public URL (Standard GCS format)
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;

    console.log(`Bunker Storage: Upload successful. URL: ${publicUrl}`);

    return {
        url: publicUrl,
        name: file.name
    };
}

export { secretClient };