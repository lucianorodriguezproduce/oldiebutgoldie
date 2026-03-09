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
                if (response.status === 404) return null;
                throw new Error('YouTube API Error');
            }
            return await response.json();
        } catch (error) {
            console.error('Error searching YouTube:', error);
            return null;
        }
    }
};
