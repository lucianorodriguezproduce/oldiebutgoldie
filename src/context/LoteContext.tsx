import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

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
            const saved = localStorage.getItem("stitch_lote");
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
        localStorage.setItem("stitch_lote", JSON.stringify(loteItems));
    }, [loteItems]);

    const toggleItem = (item: BatchItem) => {
        setLoteItems(prev => {
            const exists = prev.some(i => i.id === item.id);
            const nextItems = exists
                ? prev.filter(i => i.id !== item.id)
                : [...prev, item];

            localStorage.setItem("stitch_lote", JSON.stringify(nextItems));
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
            localStorage.setItem("stitch_lote", JSON.stringify(nextItems));
            return nextItems;
        });
    };

    const addItemFromInventory = (orderData: any) => {
        if (!orderData) return;

        if (['sold', 'venta_finalizada', 'completed'].includes(orderData.status || orderData.logistics?.status)) {
            alert("Atención: Este ítem ya fue vendido y no puede añadirse al lote.");
            return;
        }

        const newItem: BatchItem = {
            id: orderData.id,
            title: orderData.metadata?.title || orderData.album || orderData.title || "Sin Título",
            artist: orderData.metadata?.artist || orderData.artist || "Varios",
            album: orderData.metadata?.title || orderData.album || orderData.title || "Sin Título",
            cover_image: orderData.media?.thumbnail || orderData.thumbnailUrl || orderData.cover_image || orderData.items?.[0]?.cover_image || "",
            format: orderData.metadata?.format_description || orderData.details?.format || orderData.format || "Vinilo",
            condition: orderData.logistics?.condition || orderData.details?.condition || orderData.condition || "Usado",
            price: orderData.logistics?.price || orderData.adminPrice || orderData.totalPrice || 0,
            currency: orderData.adminCurrency || orderData.currency || "ARS",
            source: 'INVENTORY'
        };

        addItemToBatch(newItem);
    };

    const isInLote = (id: number | string) => loteItems.some(i => i.id === id);

    const clearLote = () => {
        localStorage.removeItem("stitch_lote");
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
