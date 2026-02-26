const DISCOGS_BASE_URL = "/api/proxy";

async function fetchFromDiscogs(endpoint: string, params: Record<string, string> = {}) {
    const url = new URL(window.location.origin + DISCOGS_BASE_URL);
    url.searchParams.append("path", endpoint);

    for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, value);
    }

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
        const error = new Error(`Discogs API error: ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).details = data;
        throw error;
    }

    return data;
}

export interface DiscogsSearchResult {
    id: number;
    title: string;
    cover_image: string;
    thumb: string;
    year?: string;
    format?: string[];
    label?: string[];
    country?: string;
    genre?: string[];
    style?: string[];
    resource_url: string;
    type: string;
    uri: string;
}

export const discogsService = {
    async searchReleases(query: string, page: number = 1, genre?: string, type?: string, format?: string): Promise<{ results: DiscogsSearchResult[], pagination: any }> {
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
        if (format) params.format = format;

        const data = await fetchFromDiscogs("/database/search", params);
        return { results: data.results, pagination: data.pagination };
    },

    async getReleaseDetails(id: string) {
        return fetchFromDiscogs(`/releases/${id}`);
    },

    async getMasterDetails(id: string) {
        return fetchFromDiscogs(`/masters/${id}`);
    },

    async getArtistReleases(artistId: string, page: number = 1, options: { sort?: string, type?: string } = {}): Promise<{ results: DiscogsSearchResult[], pagination: any }> {
        const params: Record<string, string> = {
            sort: options.sort || "year", // 'have' is not supported on artist releases endpoint
            sort_order: "desc",
            per_page: "10",
            page: page.toString(),
        };
        // The artist releases endpoint does NOT support 'type' or 'q' parameters in the standard API
        const data = await fetchFromDiscogs(`/artists/${artistId}/releases`, params);
        // Artist releases endpoint has a slightly different format, we map it to match DiscogsSearchResult
        const mappedResults = (data.releases || []).map((r: any) => ({
            id: r.id,
            title: `${r.artist || r.role} - ${r.title}`, // Best effort to keep consistency
            cover_image: r.thumb,
            thumb: r.thumb,
            year: r.year?.toString() || "",
            type: r.type || "release",
            uri: r.resource_url,
            resource_url: r.resource_url
        }));

        return { results: mappedResults, pagination: data.pagination };
    },

    async searchArtistReleases(artistName: string, query: string, page: number = 1): Promise<{ results: DiscogsSearchResult[], pagination: any }> {
        const params: Record<string, string> = {
            q: query,
            artist: artistName, // Use search endpoint with artist filter for contextual search
            type: "master",
            per_page: "10",
            page: page.toString(),
        };
        const data = await fetchFromDiscogs(`/database/search`, params);
        return { results: data.results, pagination: data.pagination };
    },

    async getLabelReleases(labelId: string, page: number = 1): Promise<{ results: DiscogsSearchResult[], pagination: any }> {
        const params: Record<string, string> = {
            sort: "year",
            sort_order: "desc",
            per_page: "10",
            page: page.toString(),
        };
        const data = await fetchFromDiscogs(`/labels/${labelId}/releases`, params);
        const mappedResults = (data.releases || []).map((r: any) => ({
            id: r.id,
            title: r.artist ? `${r.artist} - ${r.title}` : r.title,
            cover_image: r.thumb,
            thumb: r.thumb,
            year: r.year?.toString() || "",
            type: "release",
            uri: r.resource_url,
            resource_url: r.resource_url
        }));

        return { results: mappedResults, pagination: data.pagination };
    },

    async getMasterVersions(masterId: string, page: number = 1): Promise<{ results: DiscogsSearchResult[], pagination: any }> {
        const params: Record<string, string> = {
            sort: "released",
            sort_order: "desc",
            per_page: "10",
            page: page.toString(),
        };
        const data = await fetchFromDiscogs(`/masters/${masterId}/versions`, params);
        const mappedResults = (data.versions || []).map((v: any) => ({
            id: v.id,
            title: v.title,
            cover_image: v.thumb,
            thumb: v.thumb,
            year: v.released || "",
            type: "release", // versions are releases
            uri: v.resource_url,
            resource_url: v.resource_url
        }));

        return { results: mappedResults, pagination: data.pagination };
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

    async getCuratedRecommendations(genre: string): Promise<DiscogsSearchResult[]> {
        const sideAParams: Record<string, string> = {
            genre: genre || "Electronic",
            type: "release",
            per_page: "10",
        };
        const sideBParams: Record<string, string> = {
            genre: genre || "Electronic",
            type: "release",
            format: "Limited Edition",
            per_page: "10",
        };

        try {
            const [sideAResponse, sideBResponse] = await Promise.all([
                fetchFromDiscogs("/database/search", sideAParams),
                fetchFromDiscogs("/database/search", sideBParams)
            ]);

            const sideA = sideAResponse.results || [];
            const sideB = sideBResponse.results || [];

            const mixer: DiscogsSearchResult[] = [];
            const maxLength = Math.max(sideA.length, sideB.length);

            // Interleave Mainstream and Underground results
            for (let i = 0; i < maxLength; i++) {
                if (i < sideA.length) mixer.push(sideA[i]);
                if (i < sideB.length) mixer.push(sideB[i]);
            }

            // Remove exact duplicates
            const uniqueMixer = Array.from(new Map(mixer.map(item => [item.id, item])).values());
            return uniqueMixer;
        } catch (error) {
            console.error("Error fetching curated recommendations:", error);
            // Fallback to basic search
            return this.getTrending(genre);
        }
    },
};
