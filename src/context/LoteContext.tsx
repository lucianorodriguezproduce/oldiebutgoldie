import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export interface BatchItem {
    id: number;
    title: string;
    cover_image: string;
    format: string;
    condition: string;
    intent: "COMPRAR" | "VENDER";
    price?: number;
    currency?: string;
}

interface LoteContextType {
    loteItems: BatchItem[];
    toggleItem: (item: BatchItem) => void;
    isInLote: (id: number) => boolean;
    clearLote: () => void;
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
            if (exists) {
                return prev.filter(i => i.id !== item.id);
            } else {
                return [...prev, item];
            }
        });
    };

    const isInLote = (id: number) => loteItems.some(i => i.id === id);

    const clearLote = () => setLoteItems([]);

    return (
        <LoteContext.Provider value={{
            loteItems,
            toggleItem,
            isInLote,
            clearLote,
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
