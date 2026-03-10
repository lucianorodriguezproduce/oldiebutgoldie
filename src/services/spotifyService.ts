export interface SpotifyAlbumMatch {
    spotify_id: string;
    external_url: string;
    images: { url: string; height: number; width: number }[];
    bpm?: number;
    key?: string;
    preview_url?: string;
}

export const spotifyService = {
    async searchAlbum(artist: string, title: string): Promise<SpotifyAlbumMatch | null> {
        try {
            const response = await fetch(`/api/media?service=spotify&artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`);
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            if (data.error) {
                console.warn('Spotify API (Bypass) returned error:', data.error);
                return null;
            }
            return data;
        } catch (error) {
            // Log as warning only to avoid cluttering console with "scary" Red errors
            console.warn('Spotify Search Fallback active:', (error as Error).message);
            return null;
        }
    }
};
