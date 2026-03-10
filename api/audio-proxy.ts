import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { url } = req.query;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Audio URL is required' });
    }

    try {
        const response = await fetch(decodeURIComponent(url), {
            headers: {
                'User-Agent': 'SonicVaultApp/1.0',
            },
        });

        if (!response.ok) {
            console.error('Audio proxy failed to fetch upstream:', response.status);
            return res.status(response.status).json({
                error: 'Upstream Audio Fetch Error',
                status: response.status
            });
        }

        // Forward the audio binary stream
        const arrayBuffer = await response.arrayBuffer();

        res.setHeader('Content-Type', response.headers.get('Content-Type') || 'audio/mpeg');
        res.setHeader('Content-Length', arrayBuffer.byteLength);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.status(200).send(Buffer.from(arrayBuffer));

    } catch (error) {
        console.error('Audio proxy connection error:', error);
        return res.status(500).json({ error: 'Failed to connect to upstream audio source' });
    }
}
