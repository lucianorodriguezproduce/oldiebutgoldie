import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Handshake,
    ArrowRightLeft,
    CheckCircle2,
    XCircle,
    Clock,
    MessageCircle,
    User,
    ShoppingBag,
    DollarSign,
    AlertCircle,
    Package,
    Disc
} from "lucide-react";

import { tradeService } from "@/services/tradeService";
import { inventoryService } from "@/services/inventoryService";
import type { Trade, InventoryItem } from "@/types/inventory";
import { useLoading } from "@/context/LoadingContext";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function AdminTrades() {
    const { showLoading, hideLoading } = useLoading();
    const { user } = useAuth();
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
    const [itemDetails, setItemDetails] = useState<Record<string, InventoryItem>>({});

    useEffect(() => {
        fetchTrades();
    }, []);

    const fetchTrades = async () => {
        setLoading(true);
        showLoading("Sincronizando Dashboard de Trading...");
        try {
            const fetchedTrades = await tradeService.getTrades();
            setTrades(fetchedTrades);

            // Resolve item details for all trades
            const allItemIds = new Set<string>();
            fetchedTrades.forEach(t => {
                t.manifest.offeredItems.forEach(id => allItemIds.add(id));
                t.manifest.requestedItems.forEach(id => allItemIds.add(id));
            });

            const details: Record<string, InventoryItem> = {};
            await Promise.all(Array.from(allItemIds).map(async id => {
                const item = await inventoryService.getItemById(id);
                if (item) details[id] = item;
            }));
            setItemDetails(details);
        } catch (error) {
            console.error("Error fetching trades:", error);
        } finally {
            setLoading(false);
            hideLoading();
        }
    };

    const handleAcceptTrade = async (trade: Trade) => {
        if (!trade.id) return;
        const confirm = window.confirm("¿Confirmar resolución de Trade? Esto descontará stock automáticamente.");
        if (!confirm) return;

        showLoading("Resolviendo conflicto de stock...");
        try {
            // 1. Discount stock for requested items (Admin's items being sent)
            for (const itemId of trade.manifest.requestedItems) {
                const response = await fetch('/api/inventory/reserve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ itemId, quantity: 1 })
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(`Error en reserva de ítem ${itemId}: ${err.error}`);
                }
            }

            // 2. Update trade status
            await tradeService.updateTradeStatus(trade.id, 'accepted');

            // 3. Optional: Logic to register offered items into admin inventory? 
            // For now, only the stock reduction is automated as per mission.

            alert("Trade aceptado y stock actualizado correctamente.");
            fetchTrades();
            setSelectedTrade(null);
        } catch (error: any) {
            console.error("Error accepting trade:", error);
            alert(`Error crítico: ${error.message}`);
        } finally {
            hideLoading();
        }
    };

    const handleDeclineTrade = async (trade: Trade) => {
        if (!trade.id) return;
        if (!window.confirm("¿Rechazar esta propuesta de intercambio?")) return;

        showLoading("Cancelando trade...");
        try {
            await tradeService.updateTradeStatus(trade.id, 'cancelled');
            fetchTrades();
            setSelectedTrade(null);
        } catch (error) {
            console.error("Error declining trade:", error);
        } finally {
            hideLoading();
        }
    };

    const getStatusBadge = (status: Trade['status']) => {
        switch (status) {
            case 'pending':
                return <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse"><Clock className="h-3 w-3" /> PENDING_ACTION</span>;
            case 'accepted':
                return <span className="bg-green-500/10 text-green-500 border border-green-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> COMPLETED</span>;
            case 'cancelled':
                return <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5"><XCircle className="h-3 w-3" /> CANCELLED</span>;
            case 'counter_offer':
                return <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5"><ArrowRightLeft className="h-3 w-3" /> COUNTER_OFFER</span>;
            default:
                return status;
        }
    };

    const renderTradeItems = (ids: string[], title: string, color: string) => (
        <div className="space-y-3">
            <h4 className={`text-[10px] font-black uppercase tracking-widest ${color}`}>{title}</h4>
            <div className="space-y-2">
                {ids.map(id => {
                    const item = itemDetails[id];
                    return (
                        <div key={id} className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/10">
                                {item?.media.thumbnail && <img src={item.media.thumbnail} alt="" className="w-full h-full object-cover" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-white truncate">{item?.metadata.title || "Unknown Item"}</p>
                                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter truncate">{item?.metadata.artist || "Unknown Artist"}</p>
                            </div>
                            <div className="text-[10px] font-black text-white shrink-0">
                                ${item?.logistics.price.toLocaleString() || "0"}
                            </div>
                        </div>
                    );
                })}
                {ids.length === 0 && <p className="text-[10px] text-gray-600 italic">Sin discos involucrados</p>}
            </div>
        </div>
    );

    return (
        <div className="space-y-10">
            <div className="space-y-1">
                <h2 className="text-4xl md:text-6xl font-display font-black text-white uppercase tracking-tighter">Dashboard de Trading</h2>
                <p className="text-gray-500 font-medium text-lg">Resolución de intercambios y conflictos de stock.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
                {loading ? (
                    <div className="py-32 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2rem] gap-4">
                        <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <span className="text-xs font-black uppercase tracking-[0.3em] text-gray-500">Sincronizando Trades...</span>
                    </div>
                ) : trades.length === 0 ? (
                    <div className="py-32 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2rem] space-y-4 text-center">
                        <ArrowRightLeft className="h-12 w-12 text-gray-700" />
                        <p className="text-xl font-display font-medium text-gray-500">No hay propuestas de intercambio activas.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {trades.map(trade => (
                            <motion.div
                                key={trade.id}
                                layoutId={trade.id}
                                onClick={() => setSelectedTrade(trade)}
                                className="group relative bg-white/[0.02] border border-white/5 rounded-[2rem] overflow-hidden hover:border-primary/30 transition-all cursor-pointer p-6 space-y-6"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-white/5 rounded-xl">
                                            <User className="h-4 w-4 text-gray-400" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest leading-none">Proponente</span>
                                            <span className="text-xs font-bold text-white truncate max-w-[120px]">{trade.participants.senderId.slice(-8)}</span>
                                        </div>
                                    </div>
                                    {getStatusBadge(trade.status)}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Ofrece</span>
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                            <Disc className="h-3 w-3 text-blue-400" />
                                            <span className="text-xs font-black text-white">{trade.manifest.offeredItems.length}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Solicita</span>
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                                            <ShoppingBag className="h-3 w-3 text-orange-400" />
                                            <span className="text-xs font-black text-white">{trade.manifest.requestedItems.length}</span>
                                        </div>
                                    </div>
                                </div>

                                {trade.manifest.cashAdjustment !== 0 && (
                                    <div className={`p-4 rounded-2xl flex items-center justify-between ${trade.manifest.cashAdjustment > 0 ? 'bg-green-500/5 border border-green-500/10 text-green-400' : 'bg-red-500/5 border border-red-500/10 text-red-500'}`}>
                                        <span className="text-[9px] font-black uppercase tracking-widest">Ajuste de Efectivo</span>
                                        <span className="text-sm font-black whitespace-nowrap">
                                            {trade.manifest.cashAdjustment > 0 ? `+ $${trade.manifest.cashAdjustment}` : `- $${Math.abs(trade.manifest.cashAdjustment)}`}
                                        </span>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal de Detalle de Trade */}
            <AnimatePresence>
                {selectedTrade && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedTrade(null)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
                        >
                            <div className="p-8 space-y-8">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Detalle de Propuesta</h3>
                                    {getStatusBadge(selectedTrade.status)}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {renderTradeItems(selectedTrade.manifest.offeredItems, "El Cliente Ofrece", "text-blue-400")}
                                    {renderTradeItems(selectedTrade.manifest.requestedItems, "El Cliente Solicita", "text-orange-400")}
                                </div>

                                {selectedTrade.manifest.cashAdjustment !== 0 && (
                                    <div className="bg-white/5 border border-white/5 p-6 rounded-[2rem] flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-green-500/10 rounded-2xl">
                                                <DollarSign className="h-5 w-5 text-green-500" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Compensación Económica</p>
                                                <p className="text-lg font-black text-white">
                                                    {selectedTrade.manifest.cashAdjustment > 0 ? "A tu favor: " : "A pagar: "}
                                                    ${Math.abs(selectedTrade.manifest.cashAdjustment).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {selectedTrade.status === 'pending' && (
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => handleAcceptTrade(selectedTrade)}
                                            className="flex-1 flex items-center justify-center gap-3 py-4 bg-primary text-black rounded-2xl font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg shadow-primary/20"
                                        >
                                            <CheckCircle2 className="h-5 w-5" /> Aceptar Propuesta
                                        </button>
                                        <button
                                            onClick={() => handleDeclineTrade(selectedTrade)}
                                            className="flex-1 flex items-center justify-center gap-3 py-4 bg-white/5 text-red-500 border border-red-500/20 rounded-2xl font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                                        >
                                            <XCircle className="h-5 w-5" /> Rechazar
                                        </button>
                                    </div>
                                )}

                                {selectedTrade.status === 'accepted' && (
                                    <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-[2rem] flex items-center gap-4">
                                        <div className="p-3 bg-green-500 rounded-2xl">
                                            <CheckCircle2 className="h-6 w-6 text-black" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Trato Cerrado</p>
                                            <p className="text-sm font-bold text-white">El stock ha sido descontado atómicamente y la operación está completa.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
