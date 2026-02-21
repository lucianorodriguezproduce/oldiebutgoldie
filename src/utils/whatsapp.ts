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
    };
    isBatch?: boolean;
    items?: any[];
    totalPrice?: number;
    currency?: string;
}

export const generateWhatsAppLink = (order: OrderData): string => {
    const phoneNumber = "5492974188914";
    const safeAlbum = (order.details?.album || "").trim();
    const safeArtist = (order.details?.artist || "").trim();
    const itemTitle = `${safeAlbum} - ${safeArtist}`;

    const intentStr = order.details?.intent ? order.details.intent.toUpperCase().trim() : "";
    let actionText = "Me interesa este disco";

    if (intentStr === "COMPRAR" || intentStr === "EN COMPRA") {
        actionText = "Quiero vender este disco";
    } else if (intentStr === "VENDER" || intentStr === "EN VENTA") {
        actionText = "Quiero comprar este disco";
    }

    const typeStr = order.type || order.item_type || "release";
    const idStr = order.item_id || "";

    let message = `Hola Oldie but Goldie! ${actionText}: ${itemTitle}.`;

    if (order.isBatch && order.items && order.items.length > 0) {
        if (intentStr === "COMPRAR" || intentStr === "EN COMPRA") {
            message = `Hola Oldie but Goldie! Quiero comprar este lote de ${order.items.length} ítems:\n`;
        } else if (intentStr === "VENDER" || intentStr === "EN VENTA") {
            const priceStr = order.totalPrice ? ` por ${order.currency === 'USD' ? 'US$' : '$'}${order.totalPrice.toLocaleString()}` : '';
            message = `Hola Oldie but Goldie! Quiero venderte este lote${priceStr}. Detalle (${order.items.length} ítems):\n`;
        } else {
            message = `Hola Oldie but Goldie! Me interesa este lote de ${order.items.length} ítems:\n`;
        }
        order.items.forEach((item, idx) => {
            const itemPrice = item.price ? ` | ${item.currency === 'USD' ? 'US$' : '$'}${item.price.toLocaleString()}` : '';
            message += `\n${idx + 1}. ${item.artist} - ${item.album} (${item.format} | ${item.condition}) [${item.intent}]${itemPrice}`;
        });
    } else if (idStr) {
        message += ` Aquí puedes ver los detalles: https://buscadordiscogs-mslb.vercel.app/item/${typeStr}/${idStr}`;
    }

    if (order.order_number) {
        message += `\n\nOrden de referencia: ${(order.order_number || "").trim()}`;
    }

    if (!order.isBatch && order.details) {
        const format = (order.details?.format || "").trim();
        const condition = (order.details?.condition || "").trim();
        message += `\nFormato: ${format} | Estado: ${condition}`;
    }

    if (order.adminPrice) {
        const currency = order.adminCurrency === "USD" ? "US$" : "$";
        message += `\n\n✅ Acepto la contraoferta de ${currency} ${order.adminPrice.toLocaleString()} por mi lote.`;
    } else if (order.admin_offer_price) {
        const currency = order.admin_offer_currency === "USD" ? "US$" : "$";
        message += `\nCotización Admin Lote/Disco: ${currency} ${order.admin_offer_price.toLocaleString()}`;
    } else if (order.totalPrice || (order as any).price) {
        const currency = order.currency || order.details.currency === "USD" ? "US$" : "$";
        const price = order.totalPrice || (order as any).price;
        message += `\nTu oferta original: ${currency} ${price.toLocaleString()}`;
    } else if (!order.isBatch && order.details.price) {
        const currency = order.details.currency === "USD" ? "US$" : "$";
        message += `\nPrecio Sugerido: ${currency} ${order.details.price.toLocaleString()}`;
    }

    if (order.id) {
        message += `\n\nLink de mi lote: https://buscadordiscogs-mslb.vercel.app/orden/${order.id}`;
    }

    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
};
