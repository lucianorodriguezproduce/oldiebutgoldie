export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initBunkerIdentity, initDriveIdentity } from '../_lib/bunker.js';
import { Readable } from 'stream';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { type, base64, fileName, mimeType } = req.body;

        if (!['logo', 'favicon'].includes(type)) {
            return res.status(400).json({ error: 'Invalid branding type' });
        }

        const db = await initBunkerIdentity();
        const drive = await initDriveIdentity();
        const folderId = '1djP4_hmGCbzgH-WMNSrek46VySg-gVs4'.trim();

        const cleanBase64 = base64.includes('base64,') ? base64.split('base64,')[1] : base64;
        const buffer = Buffer.from(cleanBase64, 'base64');
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);

        // 4. Subida a Drive con bypass de cuota
        const driveRes = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: [folderId],
            },
            media: {
                mimeType: mimeType,
                body: stream,
            },
            // Esta es la clave para evitar el error de cuota en Service Accounts
            supportsAllDrives: true,
            fields: 'id',
        } as any); // Usamos 'as any' para evitar fricciones de tipos con el SDK

        const fileId = driveRes.data.id;
        if (!fileId) throw new Error('Drive no devolvió ID');

        // 5. Permisos
        await drive.permissions.create({
            fileId: fileId,
            requestBody: { role: 'reader', type: 'anyone' },
            supportsAllDrives: true,
        });

        const publicUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

        // 6. Firestore
        await db.collection('settings').doc('site_config').set({
            [type]: {
                url: publicUrl,
                fileId: fileId,
                updatedAt: new Date().toISOString()
            }
        }, { merge: true });

        return res.status(200).json({ status: 'SUCCESS', url: publicUrl, type });

    } catch (error: any) {
        console.error('Branding API Error:', error.message);
        return res.status(500).json({
            error: 'Branding operation failed',
            details: error.message
        });
    }
}