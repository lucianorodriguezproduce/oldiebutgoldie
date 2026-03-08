import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// 🛡️ DECLARACIÓN DE SOBERANÍA: Informamos a TypeScript sobre los comandos globales
declare global {
    interface Window {
        dataLayer: any[];
        gtag: (...args: any[]) => void;
    }
}

export const useAnalytics = () => {
    const location = useLocation();

    useEffect(() => {
        // 1. Inicialización segura del DataLayer
        window.dataLayer = window.dataLayer || [];

        // 2. Reporte a GTM (Virtual Pageview)
        window.dataLayer.push({
            event: 'virtual_pageview',
            page_path: location.pathname + location.search,
            page_title: document.title,
        });

        // 3. Reporte directo a Google Analytics (GA4)
        if (typeof window.gtag === 'function') {
            window.gtag('event', 'page_view', {
                page_path: location.pathname,
                send_to: 'G-S9KW4RX9W0'
            });
        }
    }, [location]);
};
