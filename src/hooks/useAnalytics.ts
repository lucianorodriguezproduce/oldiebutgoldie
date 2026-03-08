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
 * Elimina los puntos ciegos de GTM ejecutando page_view en cada cambio de location.
 */
export const useAnalytics = () => {
    const location = useLocation();

    useEffect(() => {
        if (typeof window.gtag === 'function') {
            window.gtag('event', 'page_view', {
                page_path: location.pathname + location.search,
                page_location: window.location.href,
                page_title: document.title
            });

            // Log táctico para verificación en consola (V8.4)
            console.log(`[Analytics] Page View: ${location.pathname}${location.search}`);
        }
    }, [location]);
};
