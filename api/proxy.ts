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

    // Use the provided token directly to ensure it works on Vercel 
    // without needing manual env configuration in the dashboard
    const DISCOGS_TOKEN = process.env.DISCOGS_API_TOKEN || "cWbHttScejgMgzHxjMXNUcZGRTqjVYhouCGxMMVt";
    const discogsUrl = new URL(`https://api.discogs.com${path}`);
    discogsUrl.searchParams.append('token', DISCOGS_TOKEN);

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
                'User-Agent': 'SonicVaultApp/1.0',
                'Accept': 'application/json',
            },
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Discogs API rejected request:', data);
            return res.status(response.status).json({
                error: 'Discogs API Error',
                details: data,
                status: response.status
            });
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('Proxy connection error:', error);
        return res.status(500).json({ error: 'Failed to connect to Discogs' });
    }
}
