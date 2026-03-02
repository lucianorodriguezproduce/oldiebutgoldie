export interface InventoryItem {
    id: string; // Internal UUID
    metadata: {
        title: string;
        artist: string;
        year: number;
        original_year?: number; // Premiere release year
        country: string;
        genres: string[];
        styles: string[];
        format_description: string;
        isBatch?: boolean;
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
    items?: {
        id: string | number;
        title: string;
        artist: string;
        price: number;
        condition: string;
        format: string;
        thumb: string;
    }[];
    tracklist?: {
        position: string;
        title: string;
        duration: string;
    }[];
    labels?: {
        name: string;
        catno: string;
    }[];
}

export interface TradeManifest {
    offeredItems: string[]; // Inventory IDs
    requestedItems: string[]; // Inventory IDs
    cashAdjustment: number;
}

export interface Trade {
    id?: string;
    participants: {
        senderId: string;
        receiverId: string; // Default to Admin
    };
    manifest: TradeManifest;
    status: "pending" | "accepted" | "counter_offer" | "completed" | "cancelled";
    currentTurn: string; // UID of the user who must decide
    negotiationHistory: TradeManifest[]; // Previous versions of the manifest
    timestamp: any;
}

