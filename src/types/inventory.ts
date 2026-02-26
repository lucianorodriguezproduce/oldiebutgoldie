export interface InventoryItem {
    id: string; // Internal UUID
    metadata: {
        title: string;
        artist: string;
        year: number;
        country: string;
        genres: string[];
        styles: string[];
        format_description: string;
    };
    media: {
        thumbnail: string;
        full_res_image_url: string; // Now in Firebase Storage
    };
    reference: {
        originalDiscogsId: number;
        originalDiscogsUrl: string;
    };
    logistics: {
        stock: number;
        price: number;
        condition: string;
        status: "active" | "sold_out" | "archived";
    };
}

export interface Trade {
    id?: string;
    participants: {
        senderId: string;
        receiverId: string; // Default to Admin
    };
    manifest: {
        offeredItems: string[]; // Inventory IDs
        requestedItems: string[]; // Inventory IDs
        cashAdjustment: number;
    };
    status: "pending" | "accepted" | "counter_offer" | "completed" | "cancelled";
    timestamp: any;
}
