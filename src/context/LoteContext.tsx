import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export interface BatchItem {
    id: number;
    title: string;
    cover_image: string;
    format: string;
    condition: string;
    price?: number;
    currency?: string;
}

interface LoteContextType {
    loteItems: BatchItem[];
    toggleItem: (item: BatchItem) => void;
    addItemToBatch: (item: BatchItem) => void;
    isInLote: (id: number) => boolean;
    clearLote: () => void;
    hardReset: () => void;
    totalCount: number;
}

const LoteContext = createContext<LoteContextType | undefined>(undefined);

export function LoteProvider({ children }: { children: ReactNode }) {
    const [loteItems, setLoteItems] = useState<BatchItem[]>(() => {
        try {
            const saved = sessionStorage.getItem("stitch_lote");
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        sessionStorage.setItem("stitch_lote", JSON.stringify(loteItems));
    }, [loteItems]);

    const toggleItem = (item: BatchItem) => {
        setLoteItems(prev => {
            const exists = prev.some(i => i.id === item.id);
            const nextItems = exists
                ? prev.filter(i => i.id !== item.id)
                : [...prev, item];

            sessionStorage.setItem("stitch_lote", JSON.stringify(nextItems));
            return nextItems;
        });
    };

    const addItemToBatch = (item: BatchItem) => {
        setLoteItems(prev => {
            const existingIndex = prev.findIndex(i => i.id === item.id);
            let nextItems;
            if (existingIndex > -1) {
                nextItems = [...prev];
                nextItems[existingIndex] = item;
            } else {
                nextItems = [...prev, item];
            }
            sessionStorage.setItem("stitch_lote", JSON.stringify(nextItems));
            return nextItems;
        });
    };

    const isInLote = (id: number) => loteItems.some(i => i.id === id);

    const clearLote = () => {
        sessionStorage.removeItem("stitch_lote");
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
