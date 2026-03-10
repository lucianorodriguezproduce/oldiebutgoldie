import type { VercelRequest, VercelResponse } from '@vercel/node';
// @ts-ignore
// google import removed to minimize bundle size and start time since we use fetch directly

// --- Spotify logic ---
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getSpotifyAccessToken() {
    if (cachedToken && Date.now() < tokenExpiry) {
        return cachedToken;
    }
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('Spotify credentials missing');
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`Spotify Auth Error: ${data.error_description || data.error}`);
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
    return cachedToken;
}

// --- Handler ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const service = req.query.service || 'spotify'; // default to spotify for backward compat if possible

    try {
        if (service === 'spotify') {
            const token = await getSpotifyAccessToken();
            const artist = req.query.artist || req.body?.artist || "";
            const title = req.query.title || req.body?.title;
            const spotify_id = req.query.spotify_id || req.body?.spotify_id;

            if (!title && !spotify_id) return res.status(400).json({ error: 'Title or spotify_id is required' });

            if (spotify_id) {
                const response = await fetch(`https://api.spotify.com/v1/albums/${spotify_id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                return res.status(response.status).json(data);
            } else {
                const query = encodeURIComponent(`artist:${artist} album:${title}`);
                const searchUrl = `https://api.spotify.com/v1/search?q=${query}&type=album&limit=1`;
                const response = await fetch(searchUrl, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await response.json();
                return res.status(response.status).json(data);
            }
        }

        if (service === 'youtube') {
            const q = req.query.q || req.body?.q;
            if (!q) return res.status(400).json({ error: 'Query (q) is required' });
            const apiKey = process.env.YOUTUBE_API_KEY;
            if (!apiKey) return res.status(401).json({ error: 'YouTube API Key missing' });

            const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(String(q))}&key=${apiKey}&maxResults=1&type=video`;
            const response = await fetch(url);
            const data = await response.json();

            if (!response.ok) return res.status(response.status).json(data);

            const video = data.items?.[0];
            if (!video) return res.status(404).json({ error: 'Video not found' });

            return res.status(200).json({
                youtube_id: video.id?.videoId,
                title: video.snippet?.title,
                thumbnail: video.snippet?.thumbnails?.default?.url
            });
        }

        if (service === 'proxy') {
            const urlString = req.query.url;
            if (!urlString || typeof urlString !== 'string') return res.status(400).json({ error: 'Url is required' });

            const decodedUrl = decodeURIComponent(urlString);
            console.log(`[Proxy] Fetching: ${decodedUrl}`);

            const response = await fetch(decodedUrl);
            if (!response.ok) {
                console.error(`[Proxy] Upstream Error: ${response.status}`);
                return res.status(response.status).json({ error: 'Upstream Fetch Error', status: response.status });
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            res.setHeader('Content-Type', response.headers.get('Content-Type') || 'audio/mpeg');
            res.setHeader('Content-Length', buffer.length);
            res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache audio for 24h

            return res.status(200).end(buffer);
        }

        return res.status(400).json({ error: 'Invalid service' });

    } catch (error: any) {
        console.error(`[Media-Service] Error in ${service}:`, error.message);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
