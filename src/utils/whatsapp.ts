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

    const getItemsList = () => {
        if (order.isBatch && order.items && order.items.length > 0) {
            return order.items.map((item, idx) => {
                const labelStr = item.label ? ` [${item.label}]` : '';
                return `${idx + 1}. ${item.artist || 'Artista'} - ${item.album || 'Álbum'} (${item.format || 'N/A'} | ${item.condition || 'N/A'})${labelStr}`;
            }).join('\n');
        } else {
            const art = order.details?.artist || order.artist || "Artista";
            const alb = order.details?.album || order.title || "Álbum";
            const fmt = order.details?.format || order.format || "N/A";
            const cnd = order.details?.condition || order.condition || "N/A";
            const lbl = order.details?.label || order.label;
            const labelStr = lbl ? ` [${lbl}]` : '';
            return `- ${art} - ${alb} (${fmt} | ${cnd})${labelStr}`;
        }
    };

    const itemsList = getItemsList();
    let message = "";

    if (isPurchase) {
        message = `¡Hola Oldie But Goldie! 📀\n\nHe decidido sumar estas piezas a mi colección desde la tienda oficial.\n\nDetalle del Pedido:\n${itemsList}\n\nID de Transacción: #${orderId}\nEnlace de Referencia: https://www.oldiebutgoldie.com.ar/orden/${order.id}\n\nQuedo a la espera para coordinar el pago y el envío de mis discos. ✨`;
    } else {
        const adminPriceDisplay = order.adminPrice
            ? `${order.adminCurrency === "USD" ? "US$" : "$"} ${order.adminPrice.toLocaleString()}`
            : order.totalPrice
                ? `${order.currency === "USD" ? "US$" : "$"} ${order.totalPrice.toLocaleString()}`
                : "A confirmar";

        message = `¡Hola Oldie But Goldie! 👋\n\nMe interesa concretar la negociación por mi lote de discos. Aquí tienes el resumen:\n\nMi Lote:\n${itemsList}\n\nValor Acordado: ${adminPriceDisplay}\nReferencia: #${orderId}\n\nLink de Seguimiento: https://www.oldiebutgoldie.com.ar/orden/${order.id}\n\n¿Cómo procedemos con la entrega?`;
    }

    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
};

export const generateWhatsAppAcceptDealMsg = (order: OrderData): string => {
    const phoneNumber = "5491140411796"; // Profile.tsx hardcoded number
    const orderId = order.order_number || order.id || "";
    const msg = encodeURIComponent(`Hola! Acepté el trato por el lote ${orderId}. Coordinemos el pago y el envío.`);
    return `https://wa.me/${phoneNumber}?text=${msg}`;
};

export const generateWhatsAppAdminContactMsg = (order: OrderData, customerName?: string): string => {
    const phoneNumber = ""; // AdminOrders uses wa.me/?text= (user selects contact on web whatsapp)
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
