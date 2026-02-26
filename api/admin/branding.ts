import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initBunkerIdentity, initDriveIdentity, getSecret } from '../_lib/bunker';
import { Readable } from 'stream';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { type, base64, fileName, mimeType } = req.body;

        if (!['logo', 'favicon'].includes(type)) {
            return res.status(400).json({ error: 'Invalid branding type' });
        }

        if (!base64 || !fileName || !mimeType) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 1. Initialize Identities
        const db = await initBunkerIdentity();
        const drive = await initDriveIdentity();

        // 2. Get Folder ID
        const folderId = await getSecret('GOOGLE_DRIVE_FOLDER_ID');
        if (!folderId) {
            throw new Error('GOOGLE_DRIVE_FOLDER_ID not configured in Bunker.');
        }

        // 3. Prepare File for Upload
        const buffer = Buffer.from(base64, 'base64');
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);

        console.log(`Bunker: Uploading ${type} to Drive...`);

        // 4. Upload to Drive
        const driveRes = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: [folderId],
            },
            media: {
                mimeType,
                body: stream,
            },
            fields: 'id, webViewLink, webContentLink',
        });

        const fileId = driveRes.data.id;
        if (!fileId) throw new Error('Drive upload failed: No file ID returned.');

        // 5. Set Permissions to Public
        await drive.permissions.create({
            fileId: fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        // Construct a direct link if webViewLink is not direct enough (mostly used for images)
        // Note: Google Drive direct link format is usually: 
        // https://lh3.googleusercontent.com/d/{id} or 
        // https://drive.google.com/uc?export=view&id={id}
        const publicUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

        console.log(`Bunker: Updating Firestore settings/site_config for ${type}...`);

        // 6. Update Firestore
        await db.collection('settings').doc('site_config').set({
            [type]: {
                url: publicUrl,
                fileId: fileId,
                updatedAt: new Date().toISOString()
            }
        }, { merge: true });

        return res.status(200).json({
            status: 'SUCCESS',
            url: publicUrl,
            type
        });

    } catch (error: any) {
        console.error('Branding API Error:', error.message);

        // REDACCIÓN DE SEGURIDAD
        const safeMessage = (error.message || "")
            .replace(/\{"type": "service_account".*?\}/g, "[SERVICE_ACCOUNT_REDACTED]")
            .replace(/-----BEGIN PRIVATE KEY-----.*?-----END PRIVATE KEY-----/gs, "[PRIVATE_KEY_REDACTED]");

        return res.status(500).json({
            error: 'Branding operation failed',
            details: safeMessage
        });
    }
}
