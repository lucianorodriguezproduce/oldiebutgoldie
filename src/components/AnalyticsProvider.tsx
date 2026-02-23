import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const GA_TRACKING_ID = 'G-S9KW4RX9W0';

// Agregar gtag al objeto window para TypeScript
declare global {
    interface Window {
        dataLayer: any[];
        gtag: (...args: any[]) => void;
    }
}

export const AnalyticsProvider = ({ children }: { children: React.ReactNode }) => {
    const location = useLocation();

    useEffect(() => {
        // Inicializar GTAG
        const script = document.createElement('script');
        script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`;
        script.async = true;
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer || [];
        window.gtag = function gtag() {
            window.dataLayer.push(arguments);
        };
        window.gtag('js', new Date());

        return () => {
            document.head.removeChild(script);
        };
    }, []);

    // Rastrear Page Views (SPA Routing)
    useEffect(() => {
        if (typeof window.gtag === 'function') {
            window.gtag('config', GA_TRACKING_ID, {
                page_path: location.pathname + location.search,
            });
        }
    }, [location]);

    return <>{children}</>;
};

// Utils para eventos
export const trackEvent = (action: string, params?: Record<string, any>) => {
    if (typeof window.gtag === 'function') {
        window.gtag('event', action, params);
    }
};
