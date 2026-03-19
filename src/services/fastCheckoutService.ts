import { tradeService } from "./tradeService";
import { ADMIN_UIDS } from "@/constants/admin";
import { pushPurchaseSuccess } from "@/utils/analytics";

export const fastCheckoutService = {
    /**
     * Executes a direct purchase for a local inventory item.
     * Bypasses the TradeConstructor and resolves immediately.
     */
    async processPurchase(userId: string, itemId: string, price: number, metadata: any, sellerId: string = ADMIN_UIDS[0]) {
        // 1. Create a Direct Sale Trade
        try {
            const tradeId = await tradeService.createTrade({
                participants: {
                    senderId: userId,
                    receiverId: sellerId
                },
                manifest: {
                    requestedItems: [itemId],
                    items: [metadata],
                    offeredItems: [],
                    cashAdjustment: price,
                    currency: 'ARS'
                },
                type: 'direct_sale',
                tradeOrigin: 'INVENTORY'
            });

            // Tracking DataLayer
            pushPurchaseSuccess(tradeId, price, 1);

            return tradeId;
        } catch (error) {
            console.error("FastCheckout failed:", error);
            throw error;
        }
    }
};
