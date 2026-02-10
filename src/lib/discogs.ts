const DISCOGS_BASE_URL = "/api/proxy";

async function fetchFromDiscogs(endpoint: string, params: Record<string, string> = {}) {
    const url = new URL(window.location.origin + DISCOGS_BASE_URL);
    url.searchParams.append("path", endpoint);
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, value);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
        throw new Error(`Discogs API error: ${response.statusText}`);
    }

    return response.json();
}

export interface DiscogsSearchResult {
    id: number;
    title: string;
    thumb: string;
    cover_image: string;
    year?: string;
}

export const discogsService = {
    async searchReleases(query: string): Promise<DiscogsSearchResult[]> {
        if (!query) return [];
        const data = await fetchFromDiscogs("/database/search", {
            q: query,
            type: "release",
            per_page: "20",
        });
        return data.results;
    },

    async getReleaseDetails(id: string) {
        return fetchFromDiscogs(`/releases/${id}`);
    },

    async getMasterDetails(id: string) {
        return fetchFromDiscogs(`/masters/${id}`);
    },

    async getTrending() {
        // Discogs doesn't have a direct "trending" endpoint for free tokens, 
        // so we search for popular recent electronic releases as a fallback
        const data = await fetchFromDiscogs("/database/search", {
            genre: "Electronic",
            year: "2024",
            type: "release",
            per_page: "10",
        });
        return data.results;
    }
};
