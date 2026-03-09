export interface SpotifyAlbumMatch {
    spotify_id: string;
    external_url: string;
    images: { url: string; height: number; width: number }[];
    bpm?: number;
    key?: string;
}

export const spotifyService = {
    async searchAlbum(artist: string, title: string): Promise<SpotifyAlbumMatch | null> {
        try {
            const response = await fetch(`/api/spotify?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`);
            if (!response.ok) {
                // Silently return null for any non-ok response (404, 401, 503, etc)
                return null;
            }
            return await response.json();
        } catch (error) {
            // Log as warning only to avoid cluttering console with "scary" Red errors
            console.warn('Spotify Search Fallback active:', (error as Error).message);
            return null;
        }
    }
};
