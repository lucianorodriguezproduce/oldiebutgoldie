import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { Readable } from 'stream';

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const secretClient = new SecretManagerServiceClient();

async function initBunkerIdentity() {
    console.log('Bunker: Accessing Secret Manager...');
    const [version] = await secretClient.accessSecretVersion({
        name: 'projects/344484307950/secrets/FIREBASE_ADMIN_SDK_JSON/versions/latest',
    });

    const payload = version.payload?.data?.toString();
    if (!payload) throw new Error('CRITICAL_IDENTITY_FAILURE: Secret payload empty');

    const sa = JSON.parse(payload);
    const rawKey = (sa.private_key || sa.privateKey || sa.private_key_id || '').trim();

    // FILTRO DE VACÍO (Seguridad Bunker): Aislamiento total del cuerpo
    const body = rawKey
        .replace(/\\n/g, '\n')
        .replace(/-----[^-]*-----/g, '')
        .replace(/\s/g, '')
        .trim();

    if (body.length < 1500) throw new Error("CRITICAL_INTEGRITY_FAILURE: Key body too short in Bunker.");

    const finalKey = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;

    const config = {
        projectId: (sa.project_id || sa.projectId || 'buscador-discogs-11425').trim(),
        clientEmail: (sa.client_email || sa.clientEmail || '').trim(),
        privateKey: finalKey,
    };

    if (getApps().length === 0) {
        initializeApp({ credential: cert(config) });
        console.log('Bunker: Firebase Initialized Successfully.');
    }
    return getFirestore();
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim().replace(/^=/, '');
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim().replace(/^=/, '');
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI?.trim().replace(/^=/, '');
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID?.trim().replace(/^=/, '');

/**
 * Handler for Drive upload.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const db = await initBunkerIdentity();

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Diagnostic logging (non-sensitive)
    console.log('[DriveSync] Received upload request');

    // Verify environment variables
    const missingVars = [];
    if (!GOOGLE_CLIENT_ID) missingVars.push('GOOGLE_CLIENT_ID');
    if (!GOOGLE_CLIENT_SECRET) missingVars.push('GOOGLE_CLIENT_SECRET');

    if (missingVars.length > 0) {
        console.error('CRITICAL: Missing environment variables:', missingVars);
        return res.status(500).json({
            error: 'Configuration Error',
            details: `Missing environment variables: ${missingVars.join(', ')}. Please configure them in Vercel.`
        });
    }

    let dynamicRefreshToken = 'NOT_FETCHED';
    try {
        const { file, fileName, fileType } = req.body;

        if (!file) {
            console.error('Upload Error: No file content received');
            return res.status(400).json({ error: 'File content (base64) is required' });
        }

        // 1. Fetch Dynamic Token from Firestore
        const gscConfig = await db.collection('system_config').doc('gsc_auth').get();
        dynamicRefreshToken = gscConfig.data()?.refresh_token;

        if (!dynamicRefreshToken) {
            console.error('[DriveSync] Refresh Token missing in Firestore');
            return res.status(500).json({ error: 'Google Auth missing in DB' });
        }

        console.log(`[DriveSync] Processing upload: ${fileName} (${fileType})`);

        const auth = new google.auth.OAuth2(
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
            GOOGLE_REDIRECT_URI
        );

        auth.setCredentials({ refresh_token: dynamicRefreshToken });

        // Force token refresh
        await auth.getAccessToken();

        const drive = google.drive({ version: 'v3', auth });

        // Convert base64 to stream
        let buffer;
        try {
            buffer = Buffer.from(file, 'base64');
        } catch (e: any) {
            console.error('Base64 Decoding Failed:', e.message);
            return res.status(400).json({ error: 'Invalid base64 encoding', details: e.message });
        }

        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);

        const fileMetadata = {
            name: fileName || `upload_${Date.now()}`,
            parents: DRIVE_FOLDER_ID ? [DRIVE_FOLDER_ID] : [],
        };

        const media = {
            mimeType: fileType || 'image/jpeg',
            body: stream,
        };

        console.log('[DriveSync] Sending file to Google Drive API...');
        const uploadResponse = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink',
        });

        const fileId = uploadResponse.data.id;
        console.log('[DriveSync] Upload success. ID:', fileId);

        if (!fileId) throw new Error('Failed to get file ID after upload');

        console.log('[DriveSync] Setting file permissions to public...');
        await drive.permissions.create({
            fileId: fileId,
            requestBody: { role: 'reader', type: 'anyone' },
        });

        const directLink = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1920`;
        console.log('[DriveSync] Final public link:', directLink);

        return res.status(200).json({
            success: true,
            fileId: fileId,
            directLink: directLink,
        });
    } catch (error: any) {
        console.error('[DriveSync] ERROR:', error.message);

        let googleError = error.message;
        if (error.response?.data?.error) {
            const gErr = error.response.data.error;
            googleError = typeof gErr === 'string' ? gErr : (gErr.message || error.message);
        }

        return res.status(500).json({
            error: 'Failed to upload to Google Drive',
            details: googleError,
            fullError: error.response?.data || error.message
        });
    }
}
