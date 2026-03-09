import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const secretClient = new SecretManagerServiceClient();

async function getYouTubeApiKey() {
    try {
        const [version] = await secretClient.accessSecretVersion({
            name: 'projects/344484307950/secrets/YOUTUBE_API_KEY/versions/latest',
        });
        return version.payload?.data?.toString();
    } catch (e) {
        console.warn('YOUTUBE_SECRET_FETCH_FAILURE: Falling back to env...');
        return process.env.YOUTUBE_API_KEY;
    }
}

const youtube = google.youtube('v3');

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const q = req.query.q || req.body?.q;

    if (!q) {
        return res.status(400).json({ error: 'Query (q) is required (via query or body)' });
    }

    const apiKey = await getYouTubeApiKey();
    if (!apiKey) {
        return res.status(401).json({ error: 'YouTube API Key not configured' });
    }

    try {
        // Bypass de googleapis: Usamos fetch directamente inyectando la llave en la URL
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(String(q))}&key=${apiKey}&maxResults=1&type=video`;
        const fetchResponse = await fetch(url);
        const data = await fetchResponse.json();

        if (!fetchResponse.ok) {
            console.log('FULL_ERROR_YOUTUBE:', JSON.stringify(data));
            const status = fetchResponse.status === 403 ? 403 : (fetchResponse.status === 401 ? 401 : 530);
            return res.status(status).json({ error: data.error?.message || 'YouTube Service Unavailable', detail: data });
        }

        const video = data.items?.[0];
        if (!video) {
            return res.status(404).json({ error: 'Video not found on YouTube' });
        }

        return res.status(200).json({
            youtube_id: video.id?.videoId,
            title: video.snippet?.title,
            thumbnail: video.snippet?.thumbnails?.default?.url
        });
    } catch (error: any) {
        console.error('YouTube Fetch Failure:', error.message);
        return res.status(500).json({ error: 'Internal YouTube Fetch Error' });
    }
}
