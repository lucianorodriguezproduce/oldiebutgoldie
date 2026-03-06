import { tradeService } from "./tradeService";
import { ADMIN_UID } from "@/constants/admin";

export const fastCheckoutService = {
    /**
     * Executes a direct purchase for a local inventory item.
     * Bypasses the TradeConstructor and resolves immediately.
     */
    async processPurchase(userId: string, itemId: string, price: number) {
        // 1. Create a Direct Sale Trade
        // createTrade already handles the resolveTrade() internally if isDirectSale is true.
        // And isDirectSale is true if origin is INVENTORY and there are no offeredItems.

        try {
            const tradeId = await tradeService.createTrade({
                participants: {
                    senderId: userId,
                    receiverId: ADMIN_UID
                },
                manifest: {
                    requestedItems: [itemId],
                    offeredItems: [],
                    cashAdjustment: price,
                    currency: 'ARS'
                },
                tradeOrigin: 'INVENTORY'
            });

            return tradeId;
        } catch (error) {
            console.error("FastCheckout failed:", error);
            throw error;
        }
    }
};
