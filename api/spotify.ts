import type { VercelRequest, VercelResponse } from '@vercel/node';
// ADC was removed, using process.env strictly

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getAccessToken() {
    if (cachedToken && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error('Spotify credentials not configured');
    }

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
    if (!response.ok) {
        throw new Error(`Spotify Auth Error: ${data.error_description || data.error}`);
    }

    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 min buffer
    return cachedToken;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const artist = req.query.artist || req.body?.artist || "";
    const title = req.query.title || req.body?.title;

    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
    }

    try {
        const clientId = process.env.SPOTIFY_CLIENT_ID;
        const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            return res.status(500).json({ error: 'Spotify credentials not configured in environment' });
        }

        const token = await getAccessToken();
        const query = encodeURIComponent(`artist:${artist} album:${title}`);
        const searchUrl = `https://api.spotify.com/v1/search?q=${query}&type=album&limit=1`;

        const response = await fetch(searchUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        const data = await response.json();

        if (!response.ok) {
            const status = response.status === 401 ? 401 : (response.status === 429 ? 429 : 400);
            return res.status(status).json(data);
        }

        const album = data.albums.items[0];
        if (!album) {
            return res.status(404).json({ error: 'Album not found on Spotify' });
        }

        // --- ENRIQUECIMIENTO V16.5 & V17.5: BPM, KEY & PREVIEW ---
        let bpm = 0;
        let keyText = "";
        let previewUrl = "";

        try {
            // 1. Obtener el primer track del álbum
            const trackRes = await fetch(`https://api.spotify.com/v1/albums/${album.id}/tracks?limit=1`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const trackData = await trackRes.json();
            const trackItem = trackData.items?.[0];
            const trackId = trackItem?.id;

            if (trackItem?.preview_url) {
                previewUrl = trackItem.preview_url;
            }

            if (trackId) {
                // 2. Obtener Audio Features de ese track
                const featuresRes = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const featuresData = await featuresRes.json();

                if (featuresData && featuresData.tempo) {
                    bpm = Math.round(featuresData.tempo);

                    // Pitch Class to Key mapping
                    const pitchClasses = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                    if (featuresData.key >= 0 && featuresData.key < 12) {
                        const mode = featuresData.mode === 1 ? 'Major' : 'Minor';
                        keyText = `${pitchClasses[featuresData.key]} ${mode}`;
                    }
                }
            }
        } catch (enrichError) {
            console.warn("Error obteniendo features/preview de Spotify (Ignorado para retornar al menos el ID de álbum):", enrichError);
        }

        return res.status(200).json({
            spotify_id: album.id,
            external_url: album.external_urls.spotify,
            images: album.images,
            bpm,
            key: keyText,
            preview_url: previewUrl
        });
    } catch (error: any) {
        console.error('Spotify API Error:', error);
        // Error 401 for auth failures, 400 for bad requests, default to 503 instead of 500 if possible
        const status = error.message?.includes('credentials') ? 401 : 503;
        return res.status(status).json({ error: error.message || 'Spotify Service Unavailable' });
    }
}
