/**
 * URL Normalizer: Sanea y estandariza URLs de GSC para matching interno.
 */

const MAIN_DOMAIN = 'oldiebutgoldie.com.ar';

export const normalizeGscUrl = (url: string): string => {
    try {
        const parsed = new URL(url);

        // 1. Forzar dominio oficial si es un subdominio de Vercel
        if (parsed.hostname.includes('vercel.app')) {
            parsed.hostname = MAIN_DOMAIN;
        }

        // 2. Eliminar todos los parámetros de búsqueda (fbclid, gclid, utm_*, etc.)
        parsed.search = '';

        // 3. Eliminar hash
        parsed.hash = '';

        // 4. Asegurar que terminen sin slash (opcional, pero consistente con react-router)
        let path = parsed.pathname;
        if (path.length > 1 && path.endsWith('/')) {
            path = path.slice(0, -1);
        }

        // 5. Normalizar rutas de ítems antiguos a nuevo formato /orden/:id si aplica
        // (A futuro si hubo cambios de estructura, aquí se mapearían)

        return path;
    } catch (e) {
        console.error("Failed to normalize URL:", url, e);
        return url;
    }
};
