const CACHE_KEY = "obg_analytics_data_cache";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export interface AnalyticsDataPoint {
    date: string;
    activeUsers: number;
    sessions: number;
    averageSessionDuration: number;
    transactions: number;
}

/**
 * Fetches Google Analytics 4 report data.
 * Implements a stale-while-revalidate caching map to respect Google API strict quotas.
 */
export const runReport = async (): Promise<AnalyticsDataPoint[]> => {
    try {
        const cachedStr = localStorage.getItem(CACHE_KEY);
        const now = Date.now();

        if (cachedStr) {
            const parsed = JSON.parse(cachedStr);
            const isStale = now - parsed.timestamp >= CACHE_DURATION;

            if (!isStale && parsed.data) {
                // If data is perfectly fresh, return immediately
                return parsed.data;
            } else if (isStale && parsed.data) {
                // Stale-While-Revalidate: Return stale data immediately, but fetch fresh in background
                fetchFreshData().catch(err => console.error("SWR Background Fetch Failed:", err));
                return parsed.data;
            }
        }

        // Cache miss: block and await fresh data
        return await fetchFreshData();
    } catch (error) {
        console.error("Error in analytics runReport:", error);
        return getMockDataFallback();
    }
};

/**
 * Perform server-side call.
 * Defaults to mock data if the Edge function isn't connected.
 */
const fetchFreshData = async (): Promise<AnalyticsDataPoint[]> => {
    try {
        // En un entorno de producción real, esto apuntaría a una Función Serverless (Ej. Vercel /api/ga4)
        // que esconde las credenciales seguras (Service Account JSON) para hablar con la API de Google Analytics Data.
        const response = await fetch('/api/analytics/runReport', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dimensions: [{ name: "date" }],
                metrics: [
                    { name: "activeUsers" },
                    { name: "sessions" },
                    { name: "averageSessionDuration" },
                    { name: "transactions" }
                ],
                dateRanges: [{ startDate: "7daysAgo", endDate: "today" }]
            })
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
            return data;
        }

        throw new Error("Analytics API missing or failed.");
    } catch (e) {
        // Fallback to synthetic logic for front-end structure mapping
        const mockData = getMockDataFallback();
        localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: mockData }));
        return mockData;
    }
};

const getMockDataFallback = (): AnalyticsDataPoint[] => {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        // Formato YYYY-MM-DD
        const dateStr = d.toISOString().split('T')[0];

        return {
            date: dateStr,
            activeUsers: Math.floor(Math.random() * 800) + 200,
            sessions: Math.floor(Math.random() * 1200) + 300,
            averageSessionDuration: Math.floor(Math.random() * 180) + 40, // Segundos
            transactions: Math.floor(Math.random() * 15) // Eventos de oferta
        };
    });
};
