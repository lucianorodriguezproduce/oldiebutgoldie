import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { path, ...params } = req.query;

    if (!path) {
        return res.status(400).json({ error: 'Path is required' });
    }

    const discogsUrl = new URL(`https://api.discogs.com${path}`);
    discogsUrl.searchParams.append('token', process.env.VITE_DISCOGS_TOKEN || '');

    Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach(v => discogsUrl.searchParams.append(key, v));
        } else if (value) {
            discogsUrl.searchParams.append(key, String(value));
        }
    });

    try {
        const response = await fetch(discogsUrl.toString(), {
            headers: {
                'User-Agent': 'DiscogsAppWeb/1.0',
            },
        });

        const data = await response.json();
        return res.status(response.status).json(data);
    } catch (error) {
        console.error('Proxy error:', error);
        return res.status(500).json({ error: 'Failed to fetch from Discogs' });
    }
}
