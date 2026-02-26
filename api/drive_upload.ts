import type { VercelRequest, VercelResponse } from '@vercel/node';
import { uploadToBunker } from './_lib/bunker.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { file, fileName, fileType } = req.body;

        if (!file || !fileName) {
            return res.status(400).json({ error: 'Missing file data' });
        }

        console.log(`Editorial: Centralizing upload for ${fileName} to Firebase Storage...`);

        // Use the new Bunker Storage logic for Editorial
        const storagePath = `editorial/${Date.now()}_${fileName}`;
        const result = await uploadToBunker(file, storagePath, fileType || 'image/jpeg');

        return res.status(200).json({
            success: true,
            directLink: result.url,
            fileId: result.name
        });

    } catch (error: any) {
        console.error('Editorial Storage Error:', error.message);
        return res.status(500).json({
            error: 'Editorial upload failed',
            details: error.message
        });
    }
}
