import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ADMIN_UIDS } from "@/constants/admin";

export interface BatchItem {
    id: number | string;
    title: string;
    artist?: string;
    album?: string;
    cover_image: string;
    format: string;
    condition: string;
    price?: number;
    currency?: string;
    source: 'DISCOGS' | 'INVENTORY';
    sellerId?: string;
    type?: string;
    // Metadata Enriquecido (V21.4)
    genre?: string[];
    styles?: string[];
    year?: string | number;
    thumb?: string;
}

interface LoteContextType {
    loteItems: BatchItem[];
    toggleItem: (item: BatchItem) => void;
    addItemToBatch: (item: BatchItem) => void;
    addItemFromInventory: (orderData: any) => void;
    isInLote: (id: number | string) => boolean;
    clearLote: () => void;
    hardReset: () => void;
    totalCount: number;
}

const LoteContext = createContext<LoteContextType | undefined>(undefined);

export function LoteProvider({ children }: { children: ReactNode }) {
    const [loteItems, setLoteItems] = useState<BatchItem[]>(() => {
        try {
            const saved = localStorage.getItem("OBG_lote");
            // Migration: Ensure existing items have a source
            const items = saved ? JSON.parse(saved) : [];
            return items.map((item: any) => ({
                ...item,
                source: item.source || 'DISCOGS'
            }));
        } catch {
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem("OBG_lote", JSON.stringify(loteItems));
    }, [loteItems]);

    const toggleItem = (item: BatchItem) => {
        setLoteItems(prev => {
            const exists = prev.some(i => i.id === item.id);
            const nextItems = exists
                ? prev.filter(i => i.id !== item.id)
                : [...prev, item];

            localStorage.setItem("OBG_lote", JSON.stringify(nextItems));
            return nextItems;
        });
    };

    const addItemToBatch = (item: BatchItem) => {
        setLoteItems(prev => {
            const existingIndex = prev.findIndex(i => i.id === item.id);
            let nextItems;
            if (existingIndex > -1) {
                nextItems = [...prev];
                nextItems[existingIndex] = { ...item, source: item.source || 'DISCOGS' };
            } else {
                nextItems = [...prev, { ...item, source: item.source || 'DISCOGS' }];
            }
            localStorage.setItem("OBG_lote", JSON.stringify(nextItems));
            return nextItems;
        });
    };

    const addItemFromInventory = (orderData: any) => {
        const { validateLoteAddition, mapToBatchItem } = require("@/utils/loteHelpers");
        const { valid, error, resolvedSellerId } = validateLoteAddition(orderData, loteItems);
        
        if (!valid) {
            if (error) alert(error);
            return;
        }

        const newItem = mapToBatchItem(orderData, resolvedSellerId);
        addItemToBatch(newItem);
    };

    const isInLote = (id: number | string) => loteItems.some(i => i.id === id);

    const clearLote = () => {
        localStorage.removeItem("OBG_lote");
        setLoteItems([]);
    };

    const hardReset = () => {
        sessionStorage.clear();
        localStorage.clear();
        setLoteItems([]);
        window.location.reload();
    };

    return (
        <LoteContext.Provider value={{
            loteItems,
            toggleItem,
            addItemToBatch,
            addItemFromInventory,
            isInLote,
            clearLote,
            hardReset,
            totalCount: loteItems.length
        }}>
            {children}
        </LoteContext.Provider>
    );
}

export function useLote() {
    const context = useContext(LoteContext);
    if (context === undefined) {
        throw new Error("useLote must be used within a LoteProvider");
    }
    return context;
}
