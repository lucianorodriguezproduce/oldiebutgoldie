import { useState, useEffect, useCallback } from "react";
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
    Search,
    Trash2,
    ChevronDown,
    Loader2
} from "lucide-react";

import { tradeService } from "@/services/tradeService";
import { inventoryService } from "@/services/inventoryService";
import { userAssetService } from "@/services/userAssetService";
import type { Trade, InventoryItem, TradeManifest } from "@/types/inventory";
import { useLoading } from "@/context/LoadingContext";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import ManifestEditor from "@/components/Trade/ManifestEditor";
import TradeConsole from "@/components/Trade/TradeConsole";

const PAGE_SIZE = 15;

export default function AdminTrades() {
    const { showLoading, hideLoading } = useLoading();
    const { user } = useAuth();
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
    const [itemDetails, setItemDetails] = useState<Record<string, InventoryItem>>({});
    const [activeView, setActiveView] = useState<'exchange' | 'direct_sale'>('exchange');

    // Wizard State
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [wizardStep, setWizardStep] = useState<1 | 2>(1);
    const [targetUserEmail, setTargetUserEmail] = useState("");
    const [autoApprove, setAutoApprove] = useState(false);
    const [wizardManifest, setWizardManifest] = useState<TradeManifest>({
        offeredItems: [],
        requestedItems: [],
        cashAdjustment: 0
    });

    // Protocol V77.0: Admin Center States
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<Trade['status'] | 'all'>('all');

    const filteredTrades = trades.filter(t => {
        const type = t.type || 'exchange';
        const matchesType = activeView === 'exchange' ? type === 'exchange' : (type === 'direct_sale' || type === 'admin_negotiation');
        const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
        const matchesSearch = !searchTerm || 
            t.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.participants.senderName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.participants.senderId.toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesType && matchesStatus && matchesSearch;
    });

    // KPI Calculations
    const kpis = {
        pendingShipment: trades.filter(t => t.status === 'completed' && t.logistics?.shipping_status !== 'delivered').length,
        openDisputes: trades.filter(t => t.status === 'disputed').length,
        monthlySales: trades
            .filter(t => t.status === 'completed' && t.timestamp?.toDate().getMonth() === new Date().getMonth())
            .reduce((acc, t) => acc + (t.manifest?.cashAdjustment || 0), 0)
    };

    useEffect(() => {
        initialLoad();
    }, []);

    const initialLoad = async () => {
        setLoading(true);
        showLoading("Sincronizando Dashboard de Trading...");
        try {
            const pagedRes = await tradeService.getTradesPaged(PAGE_SIZE);
            setTrades(pagedRes.items as Trade[]);
            setLastDoc(pagedRes.lastDoc);
            setHasMore(pagedRes.items.length === PAGE_SIZE);

            // Defer details resolution to avoid blocking UI
            resolveItemDetails(pagedRes.items as Trade[]);
        } catch (error) {
            console.error("Error in initial load trades:", error);
        } finally {
            setLoading(false);
            hideLoading();
        }
    };

    const fetchNextPage = async () => {
        if (!hasMore || loadingMore) return;
        setLoadingMore(true);
        try {
            const pagedRes = await tradeService.getTradesPaged(PAGE_SIZE, lastDoc);
            setTrades(prev => [...prev, ...pagedRes.items as Trade[]]);
            setLastDoc(pagedRes.lastDoc);
            setHasMore(pagedRes.items.length === PAGE_SIZE);
            resolveItemDetails(pagedRes.items as Trade[]);
        } catch (error) {
            console.error("Error fetching next page trades:", error);
        } finally {
            setLoadingMore(false);
        }
    };

    const resolveItemDetails = async (newTrades: Trade[]) => {
        const allItemIds = new Set<string>();
        newTrades.forEach(t => {
            if (t.manifest) {
                t.manifest.offeredItems.forEach((id: string) => allItemIds.add(id));
                t.manifest.requestedItems.forEach((id: string) => allItemIds.add(id));
            }
        });

        const details: Record<string, any> = { ...itemDetails };

        // Seed from manifest if possible
        newTrades.forEach(t => {
            if (t.manifest?.items && Array.isArray(t.manifest.items)) {
                t.manifest.items.forEach((item: any) => {
                    const itemId = item.userAssetId || item.id;
                    if (itemId && !details[itemId]) {
                        details[itemId] = {
                            id: itemId,
                            metadata: { title: item.title || 'Sin Título', artist: item.artist || 'Sin Artista' },
                            media: { thumbnail: item.cover_image || '' },
                            logistics: { price: item.price || 0 }
                        };
                    }
                });
            }
        });

        // Resolve missing IDs
        const missingIds = Array.from(allItemIds).filter(id => !details[id]);
        if (missingIds.length > 0) {
            await Promise.all(missingIds.map(async (id: string) => {
                const item = await inventoryService.getItemById(id);
                if (item) {
                    details[id] = item;
                } else {
                    const asset = await userAssetService.getAssetById(id);
                    if (asset) {
                        details[id] = {
                            id: asset.id,
                            metadata: asset.metadata,
                            media: asset.media,
                            logistics: { price: asset.valuation || 0 }
                        };
                    }
                }
            }));
            setItemDetails(prev => ({ ...prev, ...details }));
        }
    };

    const fetchTrades = initialLoad;


    const handleCreateTrade = async () => {
        if (!targetUserEmail) return alert("Debes ingresar el email/ID del usuario.");
        showLoading("Generando propuesta...");
        try {
            const tradeId = await tradeService.createTrade({
                participants: {
                    senderId: user?.uid || "admin",
                    receiverId: targetUserEmail // For now using email as proxy for ID if not found, or ideally a real ID
                },
                manifest: wizardManifest,
                type: activeView
            });

            if (autoApprove) {
                showLoading("Cerrando trato automáticamente...");
                await tradeService.resolveTrade(tradeId, wizardManifest);
            }

            setIsWizardOpen(false);
            setWizardStep(1);
            setWizardManifest({ offeredItems: [], requestedItems: [], cashAdjustment: 0 });
            setTargetUserEmail("");
            setAutoApprove(false);
            fetchTrades();
        } catch (error) {
            console.error("Error creating trade:", error);
            alert("Error al crear la propuesta.");
        } finally {
            hideLoading();
        }
    };

    const handleDeleteTrade = async (e: React.MouseEvent, tradeId: string) => {
        e.stopPropagation();
        if (!confirm("¿Estás seguro de que deseas eliminar este trade? Esta acción es irreversible.")) return;

        showLoading("Eliminando registro de trade...");
        try {
            await tradeService.deleteTrade(tradeId);
            fetchTrades();
        } catch (error) {
            console.error("Error deleting trade:", error);
            alert("Error al eliminar el trade.");
        } finally {
            hideLoading();
        }
    };

    const getStatusBadge = (status: Trade['status']) => {
        switch (status) {
            case 'pending':
                return <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse"><Clock className="h-3 w-3" /> PENDING_INIT</span>;
            case 'completed_unpaid':
                return <span className="bg-orange-500/10 text-orange-500 border border-orange-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse"><DollarSign className="h-3 w-3" /> POR PAGAR</span>;
            case 'in_process':
                return <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse"><Disc className="h-3 w-3" /> EN PROCESO</span>;
            case 'completed':
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
                    <h2 className="text-4xl md:text-6xl font-display font-black text-white uppercase tracking-tighter">
                        {activeView === 'exchange' ? 'Intercambios' : 'Ventas / Pedidos'}
                    </h2>
                    <p className="text-gray-500 font-medium text-lg">
                        {activeView === 'exchange'
                            ? 'Resolución de intercambios y conflictos de stock.'
                            : 'Gestión de pedidos directos y entregas inmediatas.'}
                    </p>
                </div>
                <button
                    onClick={() => setIsWizardOpen(true)}
                    className="flex items-center gap-3 px-8 py-4 bg-primary text-black rounded-2xl font-black uppercase tracking-widest hover:bg-white transition-all shadow-xl shadow-primary/20"
                >
                    <PlusCircle className="h-5 w-5" /> 
                    {activeView === 'exchange' ? 'Iniciar Propuesta' : 'Crear Pedido B2C Manual'}
                </button>
            </div>

            {/* Protocol V77.0: Command Center KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] space-y-2">
                    <div className="flex items-center gap-3 text-orange-400">
                        <ShoppingBag className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Envíos Pendientes</span>
                    </div>
                    <p className="text-4xl font-display font-black text-white">{kpis.pendingShipment}</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] space-y-2">
                    <div className="flex items-center gap-3 text-red-500">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Disputas Abiertas</span>
                    </div>
                    <p className="text-4xl font-display font-black text-white">{kpis.openDisputes}</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] space-y-2">
                    <div className="flex items-center gap-3 text-emerald-400">
                        <DollarSign className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Ventas del Mes</span>
                    </div>
                    <p className="text-4xl font-display font-black text-white">${kpis.monthlySales.toLocaleString()}</p>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-primary transition-colors" />
                    <input 
                        type="text"
                        placeholder="Buscar por ID, Nombre o Cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-3xl py-4 pl-14 pr-6 text-sm text-white outline-none focus:border-primary/50 transition-all font-bold"
                    />
                </div>
                
                <div className="flex items-center gap-2 p-1.5 bg-white/5 border border-white/10 rounded-2xl">
                    {['all', 'pending', 'accepted', 'completed', 'cancelled'].map((val) => (
                        <button
                            key={val}
                            onClick={() => setStatusFilter(val as any)}
                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                                statusFilter === val 
                                ? 'bg-primary text-black' 
                                : 'text-gray-500 hover:text-white'
                            }`}
                        >
                            {val}
                        </button>
                    ))}
                </div>
            </div>

            {/* View Selector Tabs */}
            <div className="flex items-center gap-2 p-1.5 bg-white/5 border border-white/10 rounded-2xl w-fit">
                <button
                    onClick={() => setActiveView('exchange')}
                    className={`px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeView === 'exchange'
                        ? 'bg-primary text-black shadow-lg shadow-primary/20'
                        : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                >
                    <div className="flex items-center gap-2">
                        <ArrowRightLeft className="h-3 w-3" />
                        Intercambios
                    </div>
                </button>
                <button
                    onClick={() => setActiveView('direct_sale')}
                    className={`px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeView === 'direct_sale'
                        ? 'bg-primary text-black shadow-lg shadow-primary/20'
                        : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                >
                    <div className="flex items-center gap-2">
                        <ShoppingBag className="h-3 w-3" />
                        Ventas / Pedidos
                    </div>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
                {loading ? (
                    <div className="py-32 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2rem] gap-4">
                        <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <span className="text-xs font-black uppercase tracking-[0.3em] text-gray-500">Sincronizando Trades...</span>
                    </div>
                ) : filteredTrades.length === 0 ? (
                    <div className="py-32 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2rem] space-y-4 text-center">
                        {activeView === 'exchange' ? <ArrowRightLeft className="h-12 w-12 text-gray-700" /> : <ShoppingBag className="h-12 w-12 text-gray-700" />}
                        <p className="text-xl font-display font-medium text-gray-500">
                            No se encontraron resultados para los filtros aplicados.
                        </p>
                    </div>
                ) : activeView === 'exchange' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredTrades.map(trade => (
                            <motion.div
                                key={trade.id}
                                layoutId={trade.id}
                                onClick={() => setSelectedTrade(trade)}
                                className={`group relative bg-white/[0.02] border rounded-[2rem] overflow-hidden transition-all cursor-pointer p-6 space-y-6 ${selectedTrade?.id === trade.id ? 'border-primary border-2 shadow-lg shadow-primary/10' : 'border-white/5 hover:border-primary/30'}`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-white/5 rounded-xl">
                                            <ArrowRightLeft className="h-4 w-4 text-blue-400" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest leading-none">Intercambio</span>
                                            <span className="text-xs font-bold text-white truncate max-w-[120px]">
                                                {trade.id?.slice(-8).toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                    {getStatusBadge(trade.status)}
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                        <span className="text-[8px] font-black text-gray-500 uppercase block mb-1">Ofrece</span>
                                        <span className="text-sm font-black text-white">{trade.manifest.offeredItems.length} Discos</span>
                                    </div>
                                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                        <span className="text-[8px] font-black text-gray-500 uppercase block mb-1">Pide</span>
                                        <span className="text-sm font-black text-white">{trade.manifest.requestedItems.length} Discos</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                    <span className="text-[9px] font-black text-gray-600 uppercase">Turno: {trade.currentTurn === user?.uid ? "TUYO" : "Suyo"}</span>
                                    <ChevronRight className="h-4 w-4 text-primary" />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    /* Protocol V77.0: Dynamic Data Table for Sales */
                    <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/[0.03] border-b border-white/5">
                                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">ID Pedido</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Ítem Principal</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cliente</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Monto</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredTrades.map(trade => {
                                    const firstItemId = trade.manifest.offeredItems[0] || trade.manifest.requestedItems[0];
                                    const item = itemDetails[firstItemId];
                                    
                                    return (
                                        <tr 
                                            key={trade.id} 
                                            onClick={() => setSelectedTrade(trade)}
                                            className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
                                        >
                                            <td className="px-8 py-6">
                                                <span className="text-xs font-mono font-bold text-gray-400 group-hover:text-primary transition-colors uppercase">
                                                    #{trade.id?.slice(-6)}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-white/5 rounded-xl border border-white/10 overflow-hidden shrink-0">
                                                        {item?.media.thumbnail && <img src={item.media.thumbnail} className="w-full h-full object-cover" alt="" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-black text-white truncate max-w-[150px] uppercase tracking-tighter">
                                                            {item?.metadata.title || "Varios Ítems"}
                                                        </p>
                                                        <p className="text-[9px] font-bold text-gray-600 truncate max-w-[150px] uppercase">
                                                            {item?.metadata.artist || "Multi-pack"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20">
                                                        <User className="h-3 w-3 text-primary" />
                                                    </div>
                                                    <p className="text-xs font-bold text-white uppercase tracking-tighter">
                                                        {trade.participants.senderName || trade.participants.senderId.slice(-6)}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <p className="text-xs font-bold text-gray-400">
                                                    {trade.timestamp?.toDate ? trade.timestamp.toDate().toLocaleDateString() : 'Pendiente'}
                                                </p>
                                            </td>
                                            <td className="px-8 py-6">
                                                <p className="text-xs font-black text-white">
                                                    ${(trade.manifest.cashAdjustment || 0).toLocaleString()}
                                                </p>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex flex-col items-end gap-1">
                                                    {getStatusBadge(trade.status)}
                                                    {trade.logistics?.shipping_status && (
                                                        <span className="text-[7px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-sm">
                                                            {trade.logistics.shipping_status}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {hasMore && (
                    <div className="p-8 flex justify-center">
                        <button
                            onClick={fetchNextPage}
                            disabled={loadingMore}
                            className="flex items-center gap-2 px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all disabled:opacity-50"
                        >
                            {loadingMore ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                    Cargando...
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="h-4 w-4" />
                                    Cargar más registros
                                </>
                            )}
                        </button>
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

                                        <div className="pt-4 flex items-center gap-4 bg-primary/5 border border-primary/20 p-6 rounded-[2rem]">
                                            <div className="flex items-center gap-3 flex-1">
                                                <div className="p-2 bg-primary/10 rounded-lg">
                                                    <CheckCircle2 className="h-4 w-4 text-primary" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Aprobación Automática</span>
                                                    <span className="text-[9px] text-gray-500 font-bold uppercase">Cerrar trato y descontar stock ahora.</span>
                                                </div>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={autoApprove}
                                                onChange={(e) => setAutoApprove(e.target.checked)}
                                                className="w-6 h-6 rounded-lg border-white/10 bg-black text-primary focus:ring-primary"
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
