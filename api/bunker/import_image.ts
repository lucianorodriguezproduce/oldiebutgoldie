import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initBunkerIdentity, getDiscogsToken, uploadToBunker } from '../_lib/bunker.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { imageUrl, itemId } = req.body;
    if (!imageUrl || !itemId) return res.status(400).json({ error: 'Missing imageUrl or itemId' });

    try {
        const discogsToken = await getDiscogsToken();
        const fetchHeaders: Record<string, string> = {
            'User-Agent': 'OldieButGoldieBot/1.0'
        };
        if (discogsToken) {
            fetchHeaders['Authorization'] = `Discogs token=${discogsToken}`;
        }

        const imageRes = await fetch(imageUrl, { headers: fetchHeaders });
        if (!imageRes.ok) throw new Error(`Failed to fetch image: ${imageRes.statusText}`);

        const blob = await imageRes.arrayBuffer();
        const buffer = Buffer.from(blob);
        const base64 = buffer.toString('base64');
        const mimeType = imageRes.headers.get('content-type') || 'image/jpeg';

        const fileName = `inventory/${itemId}_${Date.now()}.jpg`;
        const result = await uploadToBunker(base64, fileName, mimeType);

        return res.status(200).json({ url: result.url });
    } catch (error) {
        console.error('Bunker Import Image Error:', error);
        return res.status(500).json({ error: (error as Error).message });
    }
}
