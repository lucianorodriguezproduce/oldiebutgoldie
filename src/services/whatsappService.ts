export interface WhatsAppProduct {
    title: string;
    artist: string;
    id: string | number;
}

export const WHATSAPP_CONFIG = {
    phoneNumber: "5492974188914",
    baseUrl: "https://www.oldiebutgoldie.com.ar"
};

export const whatsappService = {
    generatePurchaseLink: (product: WhatsAppProduct) => {
        const url = `${WHATSAPP_CONFIG.baseUrl}/archivo/${product.id}?ref=wa`;
        const message = `¡Hola OBG! Me interesa comprar el vinilo *${product.artist} - ${product.title}*. Link: ${url}`;
        return `https://wa.me/${WHATSAPP_CONFIG.phoneNumber}?text=${encodeURIComponent(message)}`;
    },

    generateRequestLink: (product: WhatsAppProduct, username: string = "Usuario") => {
        const url = `${WHATSAPP_CONFIG.baseUrl}/archivo/${product.id}?ref=wa`;
        const message = `Consulta de Pedido: Busco conseguir *${product.artist} - ${product.title}*. Mi usuario: @${username}. Link: ${url}`;
        return `https://wa.me/${WHATSAPP_CONFIG.phoneNumber}?text=${encodeURIComponent(message)}`;
    },

    generateTradeLink: (orderId: string) => {
        const url = `${WHATSAPP_CONFIG.baseUrl}/orden/${orderId}?ref=wa`;
        const message = `Propuesta de intercambio para la Orden ${orderId}. Link: ${url}`;
        return `https://wa.me/${WHATSAPP_CONFIG.phoneNumber}?text=${encodeURIComponent(message)}`;
    },

    generateAcceptDealLink: (orderId: string) => {
        const message = `Hola! Acepté el trato por el lote ${orderId}. Coordinemos el pago y el envío. Link: ${WHATSAPP_CONFIG.baseUrl}/orden/${orderId}?ref=wa`;
        return `https://wa.me/${WHATSAPP_CONFIG.phoneNumber}?text=${encodeURIComponent(message)}`;
    },

    shareSummary: (item: any) => {
        const url = `${WHATSAPP_CONFIG.baseUrl}/archivo/${item.id}?ref=social_wa`;
        const artist = item.artist || item.metadata?.artist || 'Unknown';
        const title = item.title || item.metadata?.title || 'Unknown';

        return `*FICHA TÉCNICA - OLDIE BUT GOLDIE*\n\n` +
            `💿 *${title}*\n` +
            `👤 *${artist}*\n` +
            `📅 Año: ${item.year || item.metadata?.year || 'N/A'}\n` +
            `✨ Condición: ${item.condition || item.logistics?.condition || 'N/A'}\n` +
            `📦 Formato: ${item.format || item.metadata?.format_description || 'Vinilo'}\n\n` +
            `🔗 Ver más detalles:\n${url}`;
    }
};
