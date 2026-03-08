import React, { createContext, useContext, useCallback } from 'react';

interface GTMContextType {
    pushEvent: (event: string, params?: Record<string, any>) => void;
}

const GTMContext = createContext<GTMContextType | undefined>(undefined);

export const GTMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const pushEvent = useCallback((event: string, params: Record<string, any> = {}) => {
        if (typeof window !== 'undefined' && window.dataLayer) {
            window.dataLayer.push({
                event,
                ...params,
                timestamp: new Date().toISOString(),
            });

            if (import.meta.env.DEV) {
                console.log(`[GTM Event] ${event}:`, params);
            }
        }
    }, []);

    return (
        <GTMContext.Provider value={{ pushEvent }}>
            {children}
        </GTMContext.Provider>
    );
};

export const useGTM = () => {
    const context = useContext(GTMContext);
    if (!context) {
        throw new Error('useGTM must be used within a GTMProvider');
    }
    return context;
};
