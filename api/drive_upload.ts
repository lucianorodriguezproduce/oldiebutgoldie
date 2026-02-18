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

    try {
        const { file, fileName, fileType } = req.body;

        if (!file || !fileName) {
            return res.status(400).json({ error: 'File and fileName are required' });
        }

        const auth = new google.auth.OAuth2(
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
            GOOGLE_REDIRECT_URI
        );

        auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

        const drive = google.drive({ version: 'v3', auth });

        // Convert base64 to stream
        const buffer = Buffer.from(file, 'base64');
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);

        // 1. Upload the file
        const fileMetadata = {
            name: fileName,
            parents: DRIVE_FOLDER_ID ? [DRIVE_FOLDER_ID] : [],
        };

        const media = {
            mimeType: fileType || 'image/jpeg',
            body: stream,
        };

        const uploadResponse = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink',
        });

        const fileId = uploadResponse.data.id;

        if (!fileId) {
            throw new Error('Failed to get file ID after upload');
        }

        // 2. Change permissions to 'anyone with the link' (public)
        await drive.permissions.create({
            fileId: fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        // 3. Convert webViewLink to Direct Download Link
        // Format: https://drive.google.com/uc?export=view&id={fileId}
        const directLink = `https://drive.google.com/uc?export=view&id=${fileId}`;

        return res.status(200).json({
            success: true,
            fileId: fileId,
            directLink: directLink,
        });
    } catch (error: any) {
        console.error('Google Drive Upload Error:', error);
        return res.status(500).json({
            error: 'Failed to upload to Google Drive',
            details: error.message
        });
    }
}
