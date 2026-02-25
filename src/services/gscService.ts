/**
 * GSC Service: Frontend interface for Search Console data.
 */
export const gscService = {
    /**
     * Triggers the OAuth2 flow by redirecting to the init endpoint.
     */
    connect() {
        window.location.href = '/api/auth/gsc-init';
    },

    /**
     * Fetches keywords and search analytics from the server-side API.
     */
    async getKeywords() {
        try {
            const response = await fetch('/api/gsc/queries');
            if (!response.ok) {
                const errorData = await response.json();
                if (errorData.needs_auth) {
                    return { needs_auth: true, data: [] };
                }
                throw new Error('GSC Fetch Failed');
            }
            const data = await response.json();
            return { needs_auth: false, data };
        } catch (error) {
            console.error('GSC Service Error:', error);
            return { needs_auth: false, data: [], error: true };
        }
    }
};
