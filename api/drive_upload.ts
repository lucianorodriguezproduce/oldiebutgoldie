import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { Readable } from 'stream';

// NOTE: These should ideally be in Environment Variables in Vercel.
// For the purpose of this implementation using Stitch, we'll assume they are provided or mocked.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID; // The specific folder to upload to

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Verify environment variables
    const missingVars = [];
    if (!GOOGLE_CLIENT_ID) missingVars.push('GOOGLE_CLIENT_ID');
    if (!GOOGLE_CLIENT_SECRET) missingVars.push('GOOGLE_CLIENT_SECRET');
    if (!GOOGLE_REFRESH_TOKEN) missingVars.push('GOOGLE_REFRESH_TOKEN');

    if (missingVars.length > 0) {
        console.error('CRITICAL: Missing environment variables:', missingVars);
        return res.status(500).json({
            error: 'Configuration Error',
            details: `Missing environment variables: ${missingVars.join(', ')}. Please configure them in Vercel or your .env file.`
        });
    }

    try {
        const { file, fileName, fileType } = req.body;

        if (!file) {
            console.error('Upload Error: No file content received');
            return res.status(400).json({ error: 'File content (base64) is required' });
        }

        console.log(`[DriveSync] Processing upload: ${fileName} (${fileType})`);
        console.log(`[DriveSync] Folder ID: ${DRIVE_FOLDER_ID || 'Root'}`);

        const auth = new google.auth.OAuth2(
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
            GOOGLE_REDIRECT_URI
        );

        auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

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

        // 1. Upload the file
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

        if (!fileId) {
            throw new Error('Failed to get file ID after upload');
        }

        // 2. Change permissions to 'anyone with the link' (public)
        console.log('[DriveSync] Setting file permissions to public...');
        await drive.permissions.create({
            fileId: fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        // 3. Convert webViewLink to Direct Download Link
        const directLink = `https://drive.google.com/uc?export=view&id=${fileId}`;
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

        // Try to extract a friendly message
        let friendlyMessage = error.message;
        if (error.response?.data?.error_description) {
            friendlyMessage = error.response.data.error_description;
        } else if (error.errors?.[0]?.message) {
            friendlyMessage = error.errors[0].message;
        }

        return res.status(500).json({
            error: 'Failed to upload to Google Drive',
            details: friendlyMessage,
            fullError: error.response?.data || error.message
        });
    }
}
