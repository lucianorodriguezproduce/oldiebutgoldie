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
    Disc,
    Edit2,
    ChevronRight,
    Plus,
    PlusCircle,
    Search
} from "lucide-react";

import { tradeService } from "@/services/tradeService";
import { inventoryService } from "@/services/inventoryService";
import type { Trade, InventoryItem, TradeManifest } from "@/types/inventory";
import { useLoading } from "@/context/LoadingContext";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import ManifestEditor from "@/components/Trade/ManifestEditor";
import TradeConsole from "@/components/Trade/TradeConsole";

export default function AdminTrades() {
    const { showLoading, hideLoading } = useLoading();
    const { user } = useAuth();
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
    const [itemDetails, setItemDetails] = useState<Record<string, InventoryItem>>({});

    // Wizard State
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [wizardStep, setWizardStep] = useState<1 | 2>(1);
    const [targetUserEmail, setTargetUserEmail] = useState("");
    const [wizardManifest, setWizardManifest] = useState<TradeManifest>({
        offeredItems: [],
        requestedItems: [],
        cashAdjustment: 0
    });

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
                if (t.manifest) {
                    t.manifest.offeredItems.forEach((id: string) => allItemIds.add(id));
                    t.manifest.requestedItems.forEach((id: string) => allItemIds.add(id));
                }
            });

            const details: Record<string, InventoryItem> = { ...itemDetails };
            await Promise.all(Array.from(allItemIds).map(async (id: string) => {
                if (!details[id]) {
                    const item = await inventoryService.getItemById(id);
                    if (item) details[id] = item;
                }
            }));
            setItemDetails(details);
        } catch (error) {
            console.error("Error fetching trades:", error);
        } finally {
            setLoading(false);
            hideLoading();
        }
    };


    const handleCreateTrade = async () => {
        if (!targetUserEmail) return alert("Debes ingresar el email/ID del usuario.");
        showLoading("Generando propuesta...");
        try {
            await tradeService.createTrade({
                participants: {
                    senderId: user?.uid || "admin",
                    receiverId: targetUserEmail // For now using email as proxy for ID if not found, or ideally a real ID
                },
                manifest: wizardManifest,
            });
            setIsWizardOpen(false);
            setWizardStep(1);
            setWizardManifest({ offeredItems: [], requestedItems: [], cashAdjustment: 0 });
            setTargetUserEmail("");
            fetchTrades();
        } catch (error) {
            console.error("Error creating trade:", error);
            alert("Error al crear la propuesta.");
        } finally {
            hideLoading();
        }
    };

    const getStatusBadge = (status: Trade['status']) => {
        switch (status) {
            case 'pending':
                return <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse"><Clock className="h-3 w-3" /> PENDING_INIT</span>;
            case 'accepted':
                return <span className="bg-green-500/10 text-green-500 border border-green-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> COMPLETED</span>;
            case 'cancelled':
                return <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5"><XCircle className="h-3 w-3" /> CANCELLED</span>;
            case 'counter_offer':
                return <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5"><ArrowRightLeft className="h-3 w-3" /> NEGOTIATING</span>;
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
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h2 className="text-4xl md:text-6xl font-display font-black text-white uppercase tracking-tighter">Intercambios</h2>
                    <p className="text-gray-500 font-medium text-lg">Resolución de intercambios y conflictos de stock.</p>
                </div>
                <button
                    onClick={() => setIsWizardOpen(true)}
                    className="flex items-center gap-3 px-8 py-4 bg-primary text-black rounded-2xl font-black uppercase tracking-widest hover:bg-white transition-all shadow-xl shadow-primary/20"
                >
                    <Handshake className="h-5 w-5" /> Iniciar Propuesta
                </button>
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
                                className={`group relative bg-white/[0.02] border rounded-[2rem] overflow-hidden transition-all cursor-pointer p-6 space-y-6 ${selectedTrade?.id === trade.id ? 'border-primary border-2 shadow-lg shadow-primary/10' : 'border-white/5 hover:border-primary/30'
                                    }`}
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

                                <div className="flex items-center justify-between pt-2">
                                    <div className="text-[9px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-1">
                                        {trade.currentTurn === user?.uid ? (
                                            <span className="text-primary flex items-center gap-1"><AlertCircle className="h-3 w-3" /> TU TURNO</span>
                                        ) : (
                                            <span>TURNO DEL CLIENTE</span>
                                        )}
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-gray-700 group-hover:text-primary transition-colors" />
                                </div>
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
                            className="relative w-full max-w-4xl bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
                        >
                            <TradeConsole
                                trade={selectedTrade}
                                onUpdate={fetchTrades}
                                onClose={() => setSelectedTrade(null)}
                            />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {/* Wizard de Nueva Propuesta */}
            <AnimatePresence>
                {isWizardOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsWizardOpen(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-5xl bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
                        >
                            <div className="p-8 border-b border-white/10 flex items-center justify-between shrink-0">
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                                        Paso {wizardStep}: {wizardStep === 1 ? "Destinatario y Mis Discos" : "Discos Solicitados y Ajuste"}
                                    </h3>
                                    <div className="flex gap-2">
                                        <div className={`h-1 w-12 rounded-full transition-all ${wizardStep === 1 ? 'bg-primary' : 'bg-white/10'}`} />
                                        <div className={`h-1 w-12 rounded-full transition-all ${wizardStep === 2 ? 'bg-primary' : 'bg-white/10'}`} />
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsWizardOpen(false)}
                                    className="p-3 bg-white/5 text-gray-400 rounded-2xl hover:bg-white/10 transition-all"
                                >
                                    <XCircle className="h-6 w-6" />
                                </button>
                            </div>

                            <div className="p-8 overflow-y-auto flex-1 space-y-8">
                                {wizardStep === 1 ? (
                                    <div className="space-y-8">
                                        <div className="space-y-4">
                                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-2">
                                                <User className="h-3 w-3" /> Email o ID del Cliente
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ej: coleccionista@gmail.com"
                                                value={targetUserEmail}
                                                onChange={e => setTargetUserEmail(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary/40 focus:outline-none transition-all font-bold"
                                            />
                                        </div>

                                        <div className="space-y-4">
                                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Discos que Ofreces (Mis Discos)</label>
                                            <ManifestEditor
                                                manifest={wizardManifest}
                                                onChange={(m) => setWizardManifest(m)}
                                                isLocked={false}
                                                // En este paso solo mostramos el lado de ofrecidos
                                                myItems={[]}
                                                theirItems={[]}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        <div className="space-y-4">
                                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Discos que Pides (Sus Discos)</label>
                                            <ManifestEditor
                                                manifest={wizardManifest}
                                                onChange={(m) => setWizardManifest(m)}
                                                isLocked={false}
                                                myItems={[]}
                                                theirItems={[]}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-8 border-t border-white/10 bg-white/[0.01] flex gap-4 shrink-0">
                                {wizardStep === 2 && (
                                    <button
                                        onClick={() => setWizardStep(1)}
                                        className="px-8 py-4 bg-white/5 text-gray-400 rounded-2xl font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                                    >
                                        Atrás
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        if (wizardStep === 1) setWizardStep(2);
                                        else handleCreateTrade();
                                    }}
                                    className="flex-1 py-4 bg-primary text-black rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:brightness-110 transition-all"
                                >
                                    {wizardStep === 1 ? "Siguiente: Elegir Pedidos" : "Lanzar Propuesta Unilateral"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
