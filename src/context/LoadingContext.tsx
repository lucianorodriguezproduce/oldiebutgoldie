import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface LoadingContextType {
    isLoading: boolean;
    message: string;
    showLoading: (message?: string) => void;
    hideLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('Procesando...');
    const [timerId, setTimerId] = useState<any>(null);

    const showLoading = (msg: string = 'Procesando...') => {
        // Clear any existing timer
        if (timerId) clearTimeout(timerId);

        setMessage(msg);
        setIsLoading(true);

        // Safety Timeout: 12 seconds
        const newTimer = setTimeout(() => {
            setIsLoading(false);
            console.warn('Loading safety timeout reached (12s). Forcing closure.');
        }, 12000);

        setTimerId(newTimer);
    };

    const hideLoading = () => {
        if (timerId) clearTimeout(timerId);
        setIsLoading(false);
        setTimerId(null);
    };

    return (
        <LoadingContext.Provider value={{ isLoading, message, showLoading, hideLoading }}>
            {children}
        </LoadingContext.Provider>
    );
}

export function useLoading() {
    const context = useContext(LoadingContext);
    if (context === undefined) {
        throw new Error('useLoading must be used within a LoadingProvider');
    }
    return context;
}
