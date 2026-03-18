import { ADMIN_UIDS } from "@/constants/admin";
import type { BatchItem } from "@/context/LoteContext";

/**
 * Valida si un ítem puede ser añadido al lote.
 * Protocolo V72.1: Lógica de guardias centralizada.
 */
export const validateLoteAddition = (orderData: any, currentLote: BatchItem[]) => {
    if (!orderData) return { valid: false };

    // Validar estado de venta
    const status = orderData.status || orderData.logistics?.status;
    if (['sold', 'venta_finalizada', 'completed', 'pending_payment'].includes(status)) {
        return { 
            valid: false, 
            error: "Atención: Este ítem ya no está disponible (vendido o reservado)." 
        };
    }

    // Resolver Vendedor (Standardized)
    const resolvedSellerId = orderData.participants?.receiverId || 
                            orderData.sellerId || 
                            orderData.ownerId || 
                            orderData.user_id || 
                            ADMIN_UIDS[0];

    // V51.0 CART GUARD: Bloquear mezcla de vendedores
    if (currentLote.length > 0) {
        const activeSellerId = currentLote[0].sellerId;
        if (resolvedSellerId !== activeSellerId) {
            const sellerName = ADMIN_UIDS.includes(activeSellerId as string) ? "la Tienda Oficial" : "otro usuario";
            return {
                valid: false,
                error: `Tu lote actual pertenece a ${sellerName}. No podés mezclar discos de distintos vendedores en un mismo lote.`
            };
        }
    }

    return { valid: true, resolvedSellerId };
};

/**
 * Mapea datos heterogéneos a la interfaz BatchItem estándar.
 */
export const mapToBatchItem = (orderData: any, resolvedSellerId: string): BatchItem => {
    return {
        id: orderData.id,
        title: orderData.metadata?.title || orderData.album || orderData.title || "Sin Título",
        artist: orderData.metadata?.artist || orderData.artist || "Varios",
        album: orderData.metadata?.title || orderData.album || orderData.title || "Sin Título",
        cover_image: orderData.media?.thumbnail || orderData.thumbnailUrl || orderData.cover_image || orderData.items?.[0]?.cover_image || "",
        format: orderData.metadata?.format_description || orderData.details?.format || orderData.format || "Vinilo",
        condition: orderData.logistics?.condition || orderData.details?.condition || orderData.condition || "Usado",
        price: orderData.logistics?.price || orderData.adminPrice || orderData.totalPrice || 0,
        currency: orderData.adminCurrency || orderData.currency || "ARS",
        source: orderData.source === 'user_assets' || orderData.source === 'user_asset' ? 'DISCOGS' : 'INVENTORY',
        sellerId: resolvedSellerId
    };
};
