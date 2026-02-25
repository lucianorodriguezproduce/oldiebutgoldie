/**
 * Crawl Watcher Service: Coordina la inspección de URLs críticas.
 */
import { gscService } from "./gscService";

export const crawlWatcherService = {
    /**
     * Ejecuta la inspección de las 20 URLs más populares/críticas.
     */
    async inspectTopUrls() {
        try {
            // 1. Obtener las keywords/páginas top
            const gscResult = await gscService.getKeywords();
            if (gscResult.needs_auth || !gscResult.data) return;

            // 2. Extraer URLs (Simulado: en GSC vendrían como dimensiones de página)
            // Por ahora, asumimos que queremos inspeccionar las URLs que Google reporte.
            const urlsToInspect = gscResult.data.slice(0, 20).map((kw: any) => kw.page).filter(Boolean);

            // Si no vienen páginas, podemos intentar reconstruir URLs de órdenes si el kw es un ID
            // Pero lo ideal es que la consulta a GSC incluya la dimensión 'page'.

            const results = [];
            for (const url of urlsToInspect) {
                const res = await fetch('/api/gsc/inspect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });

                if (res.ok) {
                    results.push(await res.json());
                }
            }

            return results;
        } catch (error) {
            console.error('Crawl Watcher Error:', error);
            return [];
        }
    }
};
