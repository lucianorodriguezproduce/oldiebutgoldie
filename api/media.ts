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
            const clientId = process.env.SPOTIFY_CLIENT_ID;
            const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
            if (!clientId || !clientSecret) {
                console.error("[Media Proxy] SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is missing.");
                // Bypass de Emergencia
                return res.status(200).json({ error: 'Spotify Unavailable (Missing Credentials)' });
            }

            let token: string;
            try {
                token = await getSpotifyAccessToken();
            } catch (tokenErr: any) {
                console.error("[Spotify-Debug] Token fetching failed:", tokenErr.message);
                return res.status(200).json({ error: 'Spotify Unavailable (Token Error)' });
            }

            const paramArtist = req.query.artist || req.body?.artist || "";
            const paramTitle = req.query.title || req.body?.title;
            let spotify_id = req.query.spotify_id || req.body?.spotify_id;

            if (!paramTitle && !spotify_id) {
                return res.status(400).json({ error: 'Title or spotify_id is required' });
            }

            try {
                // 1. If no spotify_id, we must search for the album first
                if (!spotify_id && paramTitle) {
                    const query = paramArtist ? `artist:${paramArtist} album:${paramTitle}` : `album:${paramTitle}`;
                    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=1`;
                    const searchRes = await fetch(searchUrl, {
                        headers: { 'Authorization': `Bearer ${token}` },
                    });

                    console.log("[Spotify-Debug] Search Status:", searchRes.status);
                    if (!searchRes.ok) {
                        const errorText = await searchRes.text();
                        console.error("[Spotify-Debug] Search Error Text:", errorText);
                        return res.status(200).json({ error: 'Spotify Unavailable' });
                    }

                    const searchData = await searchRes.json();
                    const albumNode = searchData.albums?.items?.[0];

                    if (!albumNode) {
                        return res.status(200).json({ error: 'Album not found on Spotify' });
                    }
                    spotify_id = albumNode.id;
                }

                // 2. We now have a spotify_id (album). Let's get the album details to find the first track.
                const albumRes = await fetch(`https://api.spotify.com/v1/albums/${spotify_id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                console.log("[Spotify-Debug] Album Fetch Status:", albumRes.status);
                if (!albumRes.ok) {
                    const errorText = await albumRes.text();
                    console.error("[Spotify-Debug] Album Fetch Error Text:", errorText);
                    return res.status(200).json({ error: 'Spotify Unavailable' });
                }

                const albumData = await albumRes.json();
                const firstTrack = albumData.tracks?.items?.[0];

                let bpm = 0;
                let key = "";
                let preview_url = firstTrack?.preview_url || "";

                // 3. If we have a track, let's get its audio features
                if (firstTrack?.id) {
                    const featuresRes = await fetch(`https://api.spotify.com/v1/audio-features/${firstTrack.id}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    console.log("[Spotify-Debug] Audio Features Status:", featuresRes.status);
                    if (featuresRes.ok) {
                        const features = await featuresRes.json();
                        if (features) {
                            bpm = Math.round(features.tempo || 0);
                            // Convert Spotify key to standard format
                            const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                            const keyStr = keys[features.key] || "";
                            const modeStr = features.mode === 0 ? "m" : "";
                            if (keyStr) key = `${keyStr}${modeStr}`;
                        }
                    } else {
                        const errorText = await featuresRes.text();
                        console.error("[Spotify-Debug] Audio Features Error Text:", errorText);
                    }
                }

                // 4. Return the consolidated SpotifyAlbumMatch
                return res.status(200).json({
                    spotify_id: albumData.id,
                    external_url: albumData.external_urls?.spotify || "",
                    images: albumData.images || [],
                    bpm: bpm,
                    key: key,
                    preview_url: preview_url
                });

            } catch (spotifyApiError: any) {
                console.error("[Spotify-Debug] Unhandled API Exception:", spotifyApiError.message);
                return res.status(200).json({ error: 'Spotify Unavailable (Exception)' });
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
