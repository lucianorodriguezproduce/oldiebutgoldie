export interface SpotifyAlbumMatch {
    spotify_id: string;
    external_url: string;
    images: { url: string; height: number; width: number }[];
}

export const spotifyService = {
    async searchAlbum(artist: string, title: string): Promise<SpotifyAlbumMatch | null> {
        try {
            const response = await fetch(`/api/spotify?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`);
            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error('Spotify API Error');
            }
            return await response.json();
        } catch (error) {
            console.error('Error searching Spotify:', error);
            return null;
        }
    }
};
