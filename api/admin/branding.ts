export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initBunkerIdentity, uploadToDrive } from '../_lib/bunker.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { type, base64, fileName, mimeType } = req.body;

        if (!['logo', 'favicon'].includes(type)) {
            return res.status(400).json({ error: 'Invalid branding type' });
        }

        if (!base64 || !fileName) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const db = await initBunkerIdentity();

        console.log(`Branding: Aligned upload for ${type}...`);

        // Use the Standard Editorial-Bunker Upload logic
        const result = await uploadToDrive(base64, fileName, mimeType || 'image/png');

        // 6. Sync Firestore
        console.log('Branding: Syncing with site_config...');
        await db.collection('settings').doc('site_config').set({
            [type]: {
                url: result.url,
                fileId: result.fileId,
                updatedAt: new Date().toISOString()
            }
        }, { merge: true });

        console.log('Branding: Alignment success.');
        return res.status(200).json({ status: 'SUCCESS', url: result.url, type });

    } catch (error: any) {
        console.error('Branding Aligned Error:', error.message);
        return res.status(500).json({
            error: 'Branding operation failed',
            details: error.message,
            code: error.code || 'BUNKER_ALIGN_FAULT'
        });
    }
}
