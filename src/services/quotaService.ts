export interface QuotaStats {
    youtube: number;
    spotify: number;
    discogs: number;
    lastReset: string;
}

const STORAGE_KEY = 'obg_quota_telemetry';

export const quotaService = {
    getStats(): QuotaStats {
        const today = new Date().toISOString().split('T')[0];
        const cached = localStorage.getItem(STORAGE_KEY);

        if (cached) {
            const stats = JSON.parse(cached) as QuotaStats;
            if (stats.lastReset === today) return stats;
        }

        return { youtube: 0, spotify: 0, discogs: 0, lastReset: today };
    },

    track(service: keyof Omit<QuotaStats, 'lastReset'>, units: number) {
        const stats = this.getStats();
        stats[service] += units;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
        // Emit a custom event for real-time UI updates
        window.dispatchEvent(new CustomEvent('obg_quota_update', { detail: stats }));
    }
};
