import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { Readable } from 'stream';

import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// PROTOCOLO: ANTIGRAVITY-ATOMIC-FIX (Filtro de Vacío)
const getAdminConfig = () => {
    const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!creds) throw new Error('GOOGLE_APPLICATION_CREDENTIALS missing');

    let sa;
    try {
        sa = typeof creds === 'string' && creds.trim().startsWith('{')
            ? JSON.parse(creds)
            : creds;
    } catch (e) {
        console.error('Initial Parse failed');
        sa = creds;
    }

    let rawKey = (typeof sa === 'object' ? (sa.private_key || sa.privateKey) : sa) || '';

    // FILTRO DE VACÍO: Aislamiento total del cuerpo (Sin espacios ni saltos)
    const body = rawKey
        .replace(/\\n/g, '\n')
        .replace('-----BEGIN PRIVATE KEY-----', '')
        .replace('-----END PRIVATE KEY-----', '')
        .replace(/\s/g, '') // ELIMINACIÓN TOTAL (Vacuum)
        .trim();

    if (body.length < 1500) throw new Error("CRITICAL_INTEGRITY_FAILURE: Key body too short.");

    const finalKey = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;

    return {
        projectId: (sa.project_id || sa.projectId || process.env.FIREBASE_PROJECT_ID || 'buscador-discogs-11425').trim().replace(/^["']|["^']$/g, ''),
        clientEmail: (sa.client_email || sa.clientEmail || process.env.FIREBASE_CLIENT_EMAIL || '').trim().replace(/^["']|["']$/g, ''),
        privateKey: finalKey,
    };
};

const app = getApps().length === 0 ? initializeApp({ credential: cert(getAdminConfig()) }) : getApp();
const db = getFirestore(app);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim().replace(/^=/, '');
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim().replace(/^=/, '');
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI?.trim().replace(/^=/, '');
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID?.trim().replace(/^=/, '');

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Diagnostic logging (non-sensitive)
    console.log('[DriveSync] Received upload request');
    console.log('[DriveSync] Env Check:', {
        hasClientId: !!GOOGLE_CLIENT_ID,
        clientIdStart: GOOGLE_CLIENT_ID?.substring(0, 10) + '...',
        hasClientSecret: !!GOOGLE_CLIENT_SECRET,
        hasFolderId: !!DRIVE_FOLDER_ID
    });

    // Verify environment variables (Exclude REFRESH_TOKEN check as we fetch it from DB)
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
        console.error('[DriveSync] ERROR:', {
            message: error.message,
            code: error.code,
            errors: error.errors,
            data: error.response?.data
        });

        let googleError = error.message;
        if (error.response?.data?.error) {
            const gErr = error.response.data.error;
            if (typeof gErr === 'string') {
                googleError = `${gErr}`;
            } else {
                googleError = `${gErr.message || error.message} (${gErr.code || error.code})`;
                if (gErr.errors && gErr.errors.length > 0) {
                    googleError += `: ${gErr.errors[0].reason} - ${gErr.errors[0].message}`;
                }
            }
        } else if (error.response?.data?.error_description) {
            googleError = error.response.data.error_description;
        }

        const redactedCheck = {
            clientId: GOOGLE_CLIENT_ID ? `${GOOGLE_CLIENT_ID.substring(0, 10)}...${GOOGLE_CLIENT_ID.slice(-5)}` : 'MISSING',
            clientSecret: GOOGLE_CLIENT_SECRET ? `${GOOGLE_CLIENT_SECRET.substring(0, 5)}...` : 'MISSING',
            hasDynamicRefreshToken: !!dynamicRefreshToken,
            redirectUri: GOOGLE_REDIRECT_URI,
            folderId: DRIVE_FOLDER_ID
        };

        return res.status(500).json({
            error: 'Failed to upload to Google Drive',
            details: googleError,
            meta: redactedCheck,
            fullError: error.response?.data || error.message
        });
    }
}
