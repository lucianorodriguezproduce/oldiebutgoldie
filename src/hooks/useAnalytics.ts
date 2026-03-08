import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const useAnalytics = () => {
    const location = useLocation();

    useEffect(() => {
        // Reporte automático al DataLayer en cada cambio de ruta
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: 'virtual_pageview',
            page_path: location.pathname + location.search,
            page_title: document.title,
        });

        // Telemetría para Google Analytics directo
        if (typeof window.gtag === 'function') {
            window.gtag('event', 'page_view', {
                page_path: location.pathname,
                send_to: 'G-S9KW4RX9W0'
            });
        }
    }, [location]);
};
