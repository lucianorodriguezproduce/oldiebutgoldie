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

export const generateWhatsAppLink = (order: OrderData): string => {
    const phoneNumber = "5492974188914";
    const orderId = order.order_number || order.id || "";
    const isPurchase = order.is_admin_offer || order.details?.intent?.toUpperCase() === "COMPRAR" || order.type?.toUpperCase() === "COMPRAR";
    const canonicalUrl = `https://www.oldiebutgoldie.com.ar/orden/${order.id}`;

    const getItemsList = () => {
        if (order.isBatch && order.items && order.items.length > 0) {
            return order.items.map((item, idx) => {
                const artist = item.artist?.trim() || 'Artista';
                const album = item.album?.trim() || 'Álbum';
                const format = item.format?.trim() || 'N/A';
                const condition = item.condition?.trim() || 'N/A';
                const label = item.label?.trim() ? ` [${item.label.trim()}]` : '';
                return `${idx + 1}. ${artist} - ${album} (${format} | ${condition})${label}`;
            }).join('\n');
        } else {
            const art = (order.details?.artist || order.artist || "Artista").trim();
            const alb = (order.details?.album || order.title || "Álbum").trim();
            const fmt = (order.details?.format || order.format || "N/A").trim();
            const cnd = (order.details?.condition || order.condition || "N/A").trim();
            const lbl = (order.details?.label || order.label)?.trim();
            const labelStr = lbl ? ` [${lbl}]` : '';
            return `- ${art} - ${alb} (${fmt} | ${cnd})${labelStr}`;
        }
    };

    const itemsList = getItemsList();
    const count = order.isBatch ? (order.items?.length || 0) : 1;
    let message = "";

    if (isPurchase) {
        message = `¡Hola Oldie But Goldie! 📀\n\nQuiero comprar este lote de ${count} ítems:\n\n${itemsList}\n\nOrden de referencia: #${orderId}\n\nLink de mi lote: ${canonicalUrl}`;
    } else {
        const adminPriceDisplay = order.adminPrice
            ? `${order.adminCurrency === "USD" ? "US$" : "$"} ${order.adminPrice.toLocaleString()}`
            : order.totalPrice
                ? `${order.currency === "USD" ? "US$" : "$"} ${order.totalPrice.toLocaleString()}`
                : "A confirmar";

        const originalPrice = order.details?.price
            ? `${order.details.currency === "USD" ? "US$" : "$"}${order.details.price.toLocaleString()}`
            : "A confirmar";

        message = `¡Hola Oldie But Goldie! 👋\n\nQuiero venderte este lote por ${adminPriceDisplay}. Detalle (${count} ítems):\n\n${itemsList}\n\nOrden de referencia: #${orderId}\nTu oferta original: ${originalPrice}\n\nLink de mi lote: ${canonicalUrl}`;
    }

    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
};

export const generateWhatsAppAcceptDealMsg = (order: OrderData): string => {
    const phoneNumber = "5492974188914";
    const orderId = order.order_number || order.id || "";
    const msg = encodeURIComponent(`Hola! Acepté el trato por el lote ${orderId}. Coordinemos el pago y el envío.`);
    return `https://wa.me/${phoneNumber}?text=${msg}`;
};

export const generateWhatsAppAdminContactMsg = (order: OrderData, customerName?: string): string => {
    const phoneNumber = "5492974188914";
    const name = customerName || "Cliente";
    let message = "";

    if (order.isBatch) {
        message = encodeURIComponent(
            `Hola ${name}! Te contactamos desde Oldie but Goldie por tu Lote de ${(order.items || []).length} ítems. ¿Seguimos coordinando?`
        );
    } else {
        const artist = (order.details?.artist || order.artist || "Unknown Artist").trim();
        const album = (order.details?.album || order.title || "Unknown Album").trim();
        const item = `${artist} - ${album}`;
        const intent = (order.details?.intent || order.type || "COMPRAR").toUpperCase() === "COMPRAR" ? "comprar" : "vender";
        const priceText = order.details?.price
            ? ` por ${order.details.currency === "USD" ? "US$" : "$"}${order.details.price.toLocaleString()}`
            : "";
        message = encodeURIComponent(
            `Hola ${name}! Te contactamos desde Oldie but Goldie por tu pedido de ${intent}: ${item}${priceText}. ¿Seguimos coordinando?`
        );
    }

    return `https://wa.me/${phoneNumber}?text=${message}`;
};
