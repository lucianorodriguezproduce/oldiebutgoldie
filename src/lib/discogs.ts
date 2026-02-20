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
    country?: string;
    genre?: string[];
    style?: string[];
    resource_url: string;
    type: string;
    uri: string;
}

export const discogsService = {
    async searchReleases(query: string, page: number = 1, genre?: string, type?: string): Promise<{ results: DiscogsSearchResult[], pagination: any }> {
        if (!query) return { results: [], pagination: {} };
        const params: Record<string, string> = {
            q: query,
            per_page: "5",
            page: page.toString(),
        };
        if (type) {
            params.type = type;
        } else {
            params.type = "release,master,artist"; // Default to all meaningful types
        }
        if (genre) params.genre = genre;

        const data = await fetchFromDiscogs("/database/search", params);
        return { results: data.results, pagination: data.pagination };
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
