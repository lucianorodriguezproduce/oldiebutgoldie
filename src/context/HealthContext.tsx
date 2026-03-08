import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface HealthState {
    firebaseLatency: number;
    discogsLatency: number;
    isEnergyMode: boolean;
}

const HealthContext = createContext<{
    health: HealthState;
    recordLatency: (service: 'firebase' | 'discogs', time: number) => void;
} | undefined>(undefined);

export const emitHealthEvent = (service: 'firebase' | 'discogs', time: number) => {
    window.dispatchEvent(new CustomEvent('obg-health-update', { detail: { service, time } }));
};

export function HealthProvider({ children }: { children: React.ReactNode }) {
    const [health, setHealth] = useState<HealthState>({
        firebaseLatency: 0,
        discogsLatency: 0,
        isEnergyMode: false
    });

    useEffect(() => {
        const handler = (e: any) => {
            const { service, time } = e.detail;
            setHealth(prev => {
                const next = { ...prev };
                if (service === 'firebase') next.firebaseLatency = time;
                if (service === 'discogs') next.discogsLatency = time;
                next.isEnergyMode = next.firebaseLatency > 2500 || next.discogsLatency > 2500;
                return next;
            });
        };
        window.addEventListener('obg-health-update', handler);
        return () => window.removeEventListener('obg-health-update', handler);
    }, []);

    return (
        <HealthContext.Provider value={{ health, recordLatency: emitHealthEvent }}>
            {children}
        </HealthContext.Provider>
    );
}

export function useHealth() {
    const context = useContext(HealthContext);
    if (!context) throw new Error("useHealth must be used within HealthProvider");
    return context;
}
