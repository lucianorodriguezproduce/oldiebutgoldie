import type { VercelRequest, VercelResponse } from '@vercel/node';
import { uploadToBunker } from './_lib/bunker.js';

const sanitizeFileName = (name: string) => {
    return name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-_.]/g, '')
        .replace(/-+/g, '-');
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { file, fileName, fileType } = req.body;

        if (!file || !fileName) {
            return res.status(400).json({ error: 'Missing file data' });
        }

        const sanitizedName = sanitizeFileName(fileName);
        console.log(`Editorial: Centralizing upload for ${sanitizedName} to Firebase Storage...`);

        // Use the new Bunker Storage logic for Editorial
        const storagePath = `editorial/${Date.now()}_${sanitizedName}`;
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
