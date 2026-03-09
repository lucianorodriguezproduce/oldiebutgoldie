export interface YouTubeMatch {
    youtube_id: string;
    title: string;
    thumbnail: string;
}

export const youtubeService = {
    async searchVideo(query: string): Promise<YouTubeMatch | null> {
        try {
            const response = await fetch(`/api/youtube?q=${encodeURIComponent(query)}`);
            if (!response.ok) {
                // Silently return null for any non-ok response
                return null;
            }
            return await response.json();
        } catch (error) {
            // Log as warning only
            console.warn('YouTube Search Fallback active:', (error as Error).message);
            return null;
        }
    }
};
