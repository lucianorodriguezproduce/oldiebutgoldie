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

    const showLoading = React.useCallback((msg: string = 'Procesando...') => {
        // Clear any existing timer
        setTimerId((prevId: any) => {
            if (prevId) clearTimeout(prevId);
            return null;
        });

        setMessage(msg);
        setIsLoading(true);

        // Safety Timeout: 12 seconds
        const newTimer = setTimeout(() => {
            setIsLoading(false);
            console.warn('Loading safety timeout reached (12s). Forcing closure.');
        }, 12000);

        setTimerId(newTimer);
    }, []);

    const hideLoading = React.useCallback(() => {
        setTimerId((prevId: any) => {
            if (prevId) clearTimeout(prevId);
            return null;
        });
        setIsLoading(false);
    }, []);

    const value = React.useMemo(() => ({
        isLoading,
        message,
        showLoading,
        hideLoading
    }), [isLoading, message, showLoading, hideLoading]);

    return (
        <LoadingContext.Provider value={value}>
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
