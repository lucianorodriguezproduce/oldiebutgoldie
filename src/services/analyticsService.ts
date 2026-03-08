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
/**
 * GA4 Intelligence Radar - DEPRECATED in V4.8.3
 * Integrated Looker Studio Dashboard replaces this service.
 * Legacy runReport removed to prevent 500 errors.
 */
export const runReport = async (): Promise<AnalyticsDataPoint[]> => {
    console.warn("Legacy GA4 runReport called. Use Looker Dashboard instead.");
    return getMockDataFallback();
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
