import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
    interface Window {
        gtag: (...args: any[]) => void;
        dataLayer: any[];
    }
}

/**
 * Hook soberano para el rastreo automático de rutas en SPAs.
 * Centraliza el rastreo en GTM vía DataLayer para mayor flexibilidad.
 */
export const useAnalytics = () => {
    const location = useLocation();

    useEffect(() => {
        if (typeof window.dataLayer !== 'undefined') {
            window.dataLayer.push({
                event: 'page_view',
                page_path: location.pathname + location.search,
                page_location: window.location.href,
                page_title: document.title
            });

            if (import.meta.env.DEV) {
                console.log(`[GTM PageView]: ${location.pathname}${location.search}`);
            }
        }
    }, [location]);
};
