export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initBunkerIdentity, initDriveIdentity } from '../_lib/bunker';
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

        // 1. Identidades
        const db = await initBunkerIdentity();
        const drive = await initDriveIdentity();

        // 2. ID de Carpeta (Hardcoded para evitar fallos de Secret Manager)
        const folderId = '1djP4_hmGCbzgH-WMNSrek46VySg-gVs4'.trim();

        // 3. Limpieza de Base64 y preparación de Buffer
        // Eliminamos el prefijo "data:image/...;base64," si existe
        const cleanBase64 = base64.includes('base64,') ? base64.split('base64,')[1] : base64;
        const buffer = Buffer.from(cleanBase64, 'base64');
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);

        console.log(`Bunker: Uploading ${type} to Drive...`);

        // 4. Subida a Drive
        const driveRes = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: [folderId],
            },
            media: {
                mimeType,
                body: stream,
            },
            fields: 'id',
        });

        const fileId = driveRes.data.id;
        if (!fileId) throw new Error('Drive upload failed: No file ID returned.');

        // 5. Permisos Públicos
        await drive.permissions.create({
            fileId: fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        const publicUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

        console.log(`Bunker: Updating Firestore settings/site_config for ${type}...`);

        // 6. Actualización en Firestore
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

        const safeMessage = (error.message || "")
            .replace(/\{"type": "service_account".*?\}/g, "[SERVICE_ACCOUNT_REDACTED]")
            .replace(/-----BEGIN PRIVATE KEY-----.*?-----END PRIVATE KEY-----/gs, "[PRIVATE_KEY_REDACTED]");

        return res.status(500).json({
            error: 'Branding operation failed',
            details: safeMessage
        });
    }
}