import { useEffect } from 'react';
import { siteConfigService } from '@/services/siteConfigService';

/**
 * Hook to dynamically sync the site's favicon based on the branding config in Firestore.
 */
export const useDynamicFavicon = () => {
    useEffect(() => {
        return siteConfigService.onSnapshotConfig((newConfig) => {
            if (newConfig?.favicon?.url) {
                // Actualizar todas las etiquetas de favicon para máxima compatibilidad
                const links = document.querySelectorAll("link[rel~='icon']") as NodeListOf<HTMLLinkElement>;
                
                if (links.length > 0) {
                    links.forEach(link => {
                        link.href = newConfig.favicon!.url;
                    });
                } else {
                    // Si no existe, crearla dinámicamente
                    const link = document.createElement('link');
                    link.rel = 'icon';
                    link.href = newConfig.favicon.url;
                    document.head.appendChild(link);
                }
            }
        });
    }, []);
};
