export interface OrderData {
    id?: string;
    order_number?: string;
    item_id?: number | string;
    type?: string;
    item_type?: string;
    admin_offer_price?: number;
    admin_offer_currency?: string;
    adminPrice?: number;
    adminCurrency?: string;
    details: {
        intent?: string;
        artist?: string;
        album?: string;
        format?: string;
        condition?: string;
        price?: number;
        currency?: string;
        label?: string;
    };
    isBatch?: boolean;
    is_admin_offer?: boolean;
    items?: any[];
    totalPrice?: number;
    currency?: string;
    artist?: string;
    title?: string;
    format?: string;
    condition?: string;
    label?: string;
}

export const WHATSAPP_CONFIG = {
    phoneNumber: "5492974188914",
    templates: {
        purchase: "¡Hola Oldie But Goldie! 📀\n\nQuiero comprar este lote de discos:\n\n{itemsList}\n\nOrden: #{orderId}\n\nLink: {canonicalUrl}",
        sale: "¡Hola! Quiero ofrecerte estos discos para que los revises:\n\n{itemsList}\n\nPrecio pretendido total: {adminPriceDisplay}\n\nReferencia: #{orderId}\n\nLink: {canonicalUrl}",
        acceptDeal: "Hola! Acepté el trato por el lote {orderId}. Coordinemos el pago y el envío.",
        adminContact: "Hola {name}, te contacto desde la administración de Oldie But Goldie por tu gestión de {intent}. ¿Cómo procedemos con la logística de entrega?"
    }
};

export const generateWhatsAppLink = (order: OrderData): string => {
    const { phoneNumber, templates } = WHATSAPP_CONFIG;
    const orderId = order.order_number || order.id || "";
    // Priority: order.details.intent (used for Lot review) -> order.is_admin_offer (single items)
    const rawIntent = order.details?.intent || (order.is_admin_offer ? "COMPRAR" : order.type);
    const isPurchase = rawIntent?.toUpperCase() === "COMPRAR";
    const canonicalUrl = `https://www.oldiebutgoldie.com.ar/orden/${order.id}`;

    const getItemsList = () => {
        if (order.isBatch && order.items && order.items.length > 0) {
            return order.items.map((item, idx) => {
                const prefix = item.source === 'INVENTORY' ? '🟢 [DISCO EN STOCK] ' : '🔵 [PEDIDO] ';
                const artist = item.artist?.trim() || 'Artista';
                const album = item.album?.trim() || 'Álbum';
                const format = item.format?.trim() || 'N/A';
                const condition = item.condition?.trim() || 'N/A';
                const label = item.label?.trim() ? ` [${item.label.trim()}]` : '';
                return `${idx + 1}. ${prefix}${artist} - ${album} (${format} | ${condition})${label}`;
            }).join('\n');
        } else {
            const prefix = order.is_admin_offer ? '🟢 [DISCO EN STOCK] ' : '🔵 [PEDIDO] ';
            const art = (order.details?.artist || order.artist || "Artista").trim();
            const alb = (order.details?.album || order.title || "Álbum").trim();
            const fmt = (order.details?.format || order.format || "N/A").trim();
            const cnd = (order.details?.condition || order.condition || "N/A").trim();
            const lbl = (order.details?.label || order.label)?.trim();
            const labelStr = lbl ? ` [${lbl}]` : '';
            return `- ${prefix}${art} - ${alb} (${fmt} | ${cnd})${labelStr}`;
        }
    };

    const itemsList = getItemsList();
    let message = "";

    const adminPriceDisplay = order.adminPrice
        ? `${order.adminCurrency === "USD" ? "US$" : "$"} ${order.adminPrice.toLocaleString()}`
        : order.totalPrice
            ? `${order.currency === "USD" ? "US$" : "$"} ${order.totalPrice.toLocaleString()}`
            : "A confirmar";

    if (isPurchase) {
        message = templates.purchase
            .replace("{itemsList}", itemsList)
            .replace("{orderId}", orderId)
            .replace("{canonicalUrl}", canonicalUrl);
    } else {
        message = templates.sale
            .replace("{adminPriceDisplay}", adminPriceDisplay)
            .replace("{itemsList}", itemsList)
            .replace("{orderId}", orderId)
            .replace("{canonicalUrl}", canonicalUrl);
    }

    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
};

export const generateWhatsAppAcceptDealMsg = (order: OrderData): string => {
    const { phoneNumber, templates } = WHATSAPP_CONFIG;
    const orderId = order.order_number || order.id || "";
    const msg = encodeURIComponent(templates.acceptDeal.replace("{orderId}", orderId));
    return `https://wa.me/${phoneNumber}?text=${msg}`;
};

export const generateWhatsAppAdminContactMsg = (order: OrderData, customerName?: string): string => {
    const { phoneNumber, templates } = WHATSAPP_CONFIG;
    const name = customerName || "Cliente";
    const intent = (order.details?.intent || order.type || "COMPRAR").toUpperCase() === "COMPRAR" ? "comprar" : "vender";

    const message = templates.adminContact
        .replace("{name}", name)
        .replace("{intent}", intent);

    return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
};
