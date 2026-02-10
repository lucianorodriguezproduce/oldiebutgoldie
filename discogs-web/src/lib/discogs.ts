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
    cover_image: string;
    thumb: string;
    year?: string;
    label?: string[];
    genre?: string[];
    style?: string[];
    resource_url: string;
    type: string;
    uri: string;
}

export const discogsService = {
    async searchReleases(query: string, genre?: string): Promise<DiscogsSearchResult[]> {
        if (!query) return [];
        const params: Record<string, string> = {
            q: query,
            type: "release",
            per_page: "20",
        };
        if (genre) params.genre = genre;

        const data = await fetchFromDiscogs("/database/search", params);
        return data.results;
    },

    async getReleaseDetails(id: string) {
        return fetchFromDiscogs(`/releases/${id}`);
    },

    async getMasterDetails(id: string) {
        return fetchFromDiscogs(`/masters/${id}`);
    },

    async getTrending(genre?: string): Promise<DiscogsSearchResult[]> {
        const params: Record<string, string> = {
            genre: genre || "Electronic",
            year: "2024",
            type: "release",
            per_page: "18",
        };
        const data = await fetchFromDiscogs("/database/search", params);
        return data.results;
    },
};
