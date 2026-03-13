import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useLoading } from "@/context/LoadingContext";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
    MapPin,
    Award,
    Calendar,
    Music,
    Heart,
    Zap,
    Settings,
    Edit3,
    ShoppingBag,
    TrendingUp,
    Trash2,
    Search,
    DollarSign,
    Clock,
    Tag,
    Hash,
    MessageCircle,
    BadgeDollarSign,
    Globe,
    Handshake,
    CheckCircle2,
    ArrowRightLeft,
    X,
    FileText,
    Download,
    ChevronDown
} from "lucide-react";
import { db } from "@/lib/firebase";
import { formatDate, getReadableDate } from "@/utils/date";
import { collection, onSnapshot, query, orderBy, where, doc, deleteDoc, updateDoc, addDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { useState, useEffect } from "react";
import { TEXTS } from "@/constants/texts";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { Link, useSearchParams } from "react-router-dom";
import OrderDetailsDrawer from "@/components/OrderDetailsDrawer";
import { whatsappService } from '@/services/whatsappService';
import type { OrderData } from '@/utils/whatsapp';
import OrderCard from '@/components/OrderCard';
import { pushWhatsAppContactFromOrder } from "@/utils/analytics";
import NegotiationBanner from "@/components/NegotiationBanner";
import { LazyImage } from "@/components/ui/LazyImage";
import { userAssetService } from "@/services/userAssetService";

interface ProfileItem {
    id: string;
    title: string;
    cover_image: string;
    artist?: string;
    addedAt: string;
}

// Cleaned Slate: Using Sovereign Trade engine only.


import { tradeService } from "@/services/tradeService";
import { inventoryService } from "@/services/inventoryService";
import type { Trade, InventoryItem, TradeManifest } from "@/types/inventory";
import ManifestEditor from "@/components/Trade/ManifestEditor";
import UserCollection from "@/components/Profile/UserCollection";

export default function Profile() {
    const { user, isAdmin } = useAuth();
    const { showLoading, hideLoading, isLoading } = useLoading();
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);

    // Trades State
    const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
    const [activeTab, setActiveTab] = useState<"orders" | "trades" | "collection">("orders");
    const [itemDetails, setItemDetails] = useState<Record<string, InventoryItem>>({});

    // Negotiation State
    const [isEditing, setIsEditing] = useState(false);
    const [editedManifest, setEditedManifest] = useState<TradeManifest | null>(null);

    const [searchParams, setSearchParams] = useSearchParams();
    const [counterOfferPrice, setCounterOfferPrice] = useState("");
    const [isNegotiating, setIsNegotiating] = useState(false);
    const [showCounterInput, setShowCounterInput] = useState(false);


    const handleAcceptOffer = async () => {
        if (!selectedOrder || isLoading) return;
        if (confirm(TEXTS.perfil.profile.confirmAcceptProposal)) {
            showLoading(TEXTS.perfil.profile.acceptingProposal);
            try {
                // MOTOR SOBERANO: Usamos resolveTrade para completar la operación
                await tradeService.resolveTrade(selectedOrder.id, selectedOrder.manifest || {
                    requestedItems: selectedOrder.items?.map((i: any) => i.id) || [],
                    offeredItems: [],
                    cashAdjustment: selectedOrder.totalPrice || 0
                });

                setSuccessMessage(TEXTS.perfil.profile.proposalAccepted);
            } catch (error) {
                console.error("Error accepting proposal:", error);
                alert(TEXTS.perfil.profile.acceptError);
            } finally {
                hideLoading();
            }
        }
    };

    const handleRejectOffer = async () => {
        if (!selectedOrder || isLoading) return;
        if (!confirm("¿Estás seguro de que quieres rechazar esta propuesta?")) return;

        showLoading("Procesando...");
        try {
            const orderRef = doc(db, "trades", selectedOrder.id);
            await updateDoc(orderRef, {
                status: "counter_offer", // Revert to negotiation if rejected
                rejectedAt: serverTimestamp()
            });
            setSelectedOrder({ ...selectedOrder, status: "counter_offer" });
        } catch (error) {
            console.error("Error rejecting offer:", error);
        } finally {
            hideLoading();
        }
    };

    // Deep-link: auto-open drawer if ?order=ORDER_ID is in the URL
    useEffect(() => {
        const orderId = searchParams.get("order");
        if (orderId && trades.length > 0 && !ordersLoading) {
            const found = trades.find(o => o.id === orderId);
            if (found) {
                setSelectedOrder(found);
            }
            // Clean URL to prevent re-triggering
            setSearchParams({}, { replace: true });
        }
    }, [trades, ordersLoading, searchParams]);

    // Keep selectedOrder in sync with live data
    useEffect(() => {
        if (selectedOrder) {
            const latest = trades.find(o => o.id === selectedOrder.id);
            if (latest && JSON.stringify(latest) !== JSON.stringify(selectedOrder)) {
                setSelectedOrder(latest);
            }
        }
    }, [trades, selectedOrder?.id]);

    useEffect(() => {
        if (!user) return;

        showLoading("Sincronizando La Batea Personal...");

        // Unificado: Cargar todos los trades (Compras, Ventas e Intercambios)
        const loadEverything = async () => {
            await fetchTrades();
            setOrdersLoading(false);
            hideLoading();
        };

        loadEverything();

        // Optional: Implement matching trades listener if real-time is needed for Profile
        // For now, we use the fetchTrades method which already has the legacy adapter
    }, [user]);

    const fetchTrades = async () => {
        if (!user) return;
        try {
            const fetchedTrades = await tradeService.getUserTrades(user.uid);
            setTrades(fetchedTrades);

            // Resolve item details
            const allItemIds = new Set<string>();
            fetchedTrades.forEach(t => {
                t.manifest.offeredItems.forEach((id: string) => allItemIds.add(id));
                t.manifest.requestedItems.forEach((id: string) => allItemIds.add(id));
            });

            const details: Record<string, any> = { ...itemDetails };

            // Seed from manifest.items embedded data
            fetchedTrades.forEach(t => {
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

            // Resolve remaining from inventory or user_assets
            await Promise.all(Array.from(allItemIds).map(async (id: string) => {
                if (!details[id]) {
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
                }
            }));
            setItemDetails(details);
        } catch (error) {
            console.error("Error fetching user trades:", error);
        }
    };

    const handleAcceptProposal = async (order: any) => {
        if (!user) return;
        showLoading("Confirmando trato...");
        setIsNegotiating(true);
        try {
            const historyAdminOffer = order.negotiationHistory?.filter((h: any) => h.sender === 'admin').pop();
            const actualAdminPrice = historyAdminOffer?.price ?? order.adminPrice ?? order.admin_offer_price;
            const finalPrice = actualAdminPrice ?? (order.totalPrice || 0);

            // MOTOR SOBERANO: Resolvemos el trade atómicamente
            await tradeService.resolveTrade(order.id, order.manifest || {
                requestedItems: order.items?.map((i: any) => i.id) || [],
                offeredItems: [],
                cashAdjustment: finalPrice
            });

            await addDoc(collection(db, "notifications"), {
                user_id: "admin",
                title: "Venta Finalizada 🎉",
                message: `${user.displayName || 'Un cliente'} ha ACEPTADO el trato por la operación #${order.id?.slice(-6).toUpperCase()}.`,
                read: false,
                timestamp: serverTimestamp(),
                order_id: order.id
            });

            setSelectedOrder((prev: any) => prev ? { ...prev, status: "venta_finalizada" } : null);
            alert("¡Felicidades! Has finalizado la venta. Coordina el pago por WhatsApp.");
        } catch (error) {
            console.error("Error accepting proposal:", error);
            alert("Hubo un error al procesar la aceptación.");
        } finally {
            setIsNegotiating(false);
            hideLoading();
        }
    };

    const handleCounterOffer = async (order: any) => {
        const priceVal = parseFloat(counterOfferPrice);
        if (isNaN(priceVal) || priceVal <= 0) return;

        showLoading(TEXTS.perfil.profile.sendingCounterOffer);
        setIsNegotiating(true);
        try {
            await updateDoc(doc(db, "trades", order.id), {
                totalPrice: priceVal,
                status: "contraoferta_usuario",
                negotiationHistory: arrayUnion({
                    price: priceVal,
                    currency: order.currency || order.details?.currency || "ARS",
                    sender: 'user',
                    timestamp: new Date(),
                    message: TEXTS.perfil.profile.userCounterOffer,
                })
            });

            await addDoc(collection(db, "notifications"), {
                user_id: "admin",
                title: "Nueva Contraoferta del Usuario",
                message: `${user?.displayName || 'Cliente'} propone ${order.currency || '$'} ${priceVal.toLocaleString()} por el pedido ${order.order_number || order.id}.`,
                read: false,
                timestamp: serverTimestamp(),
                order_id: order.id
            });

            setSelectedOrder((prev: any) => prev ? { ...prev, totalPrice: priceVal, status: "contraoferta_usuario" } : null);
            setCounterOfferPrice("");
            setShowCounterInput(false);
            setSuccessMessage(TEXTS.perfil.profile.counterOfferSent);
        } catch (error) {
            console.error("Error sending counter-offer:", error);
            alert(TEXTS.perfil.profile.genericError);
        } finally {
            setIsNegotiating(false);
            hideLoading();
        }
    };

    const handleAcceptTrade = async (trade: any) => {
        if (!trade.id || !user) return;
        // Validamos turnos pero no bloqueamos de forma dura si el estado lo permite
        if (trade.currentTurn && trade.currentTurn !== user.uid && !['counter_offer', 'counteroffered'].includes(trade.status)) {
            console.warn("No es tu turno para aceptar este intercambio.");
        }

        if (confirm("¿Aceptás esta propuesta de intercambio? Se completará la transacción.")) {
            showLoading("Finalizando negociación...");
            try {
                await tradeService.resolveTrade(trade.id, trade.manifest);
                alert("¡Trato hecho! El intercambio ha sido aceptado.");
                fetchTrades();
                setSelectedOrder((prev: any) => prev ? { ...prev, status: "completed" } : null);
                setSelectedTrade(null);
            } catch (error: any) {
                console.error("Error accepting trade:", error);
                alert(error.message?.includes('TRADE_ALREADY_PROCESSED')
                    ? 'Este intercambio ya fue procesado.'
                    : `Error al aceptar el intercambio: ${error.message || 'Intenta nuevamente'}`);
            } finally {
                hideLoading();
            }
        }
    };

    const handleCounterOfferTrade = async () => {
        if (!selectedTrade?.id || !editedManifest || !user) return;

        showLoading("Enviando contraoferta...");
        try {
            await tradeService.counterTrade(selectedTrade.id, editedManifest, user.uid);
            alert("Contraoferta enviada con éxito.");
            setIsEditing(false);
            fetchTrades();
            setSelectedTrade(null);
        } catch (error: any) {
            console.error("Error counter offering trade:", error);
            alert(`Error: ${error.message}`);
        } finally {
            hideLoading();
        }
    };


    const downloadReceipt = (trade: any) => {
        const content = `
          OLDIE BUT GOLDIE - COMPROBANTE DE TRATO
          =======================================
          OPERACIÓN ID: #${trade.id?.slice(-8).toUpperCase()}
          FECHA: ${formatDate(trade.timestamp)}
          CLIENTE: ${user?.displayName || user?.email}
          
          ITEMS:
          ${trade.items?.map((i: any) => `- ${i.title} (${i.format})`).join('\n          ')}
          
          PRECIO FINAL: ${trade.currency === 'USD' ? 'US$' : '$'} ${(trade.manifest?.cashAdjustment || 0).toLocaleString()}
          ESTADO: OPERACIÓN FINALIZADA
          =======================================
          Gracias por confiar en Oldie but Goldie.
        `.trim();

        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Comprobante_${trade.id}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (!user && !isAdmin) return null;

    const displayName = user?.displayName || (isAdmin ? "Master Admin" : "Sonic Collector");
    const photoURL = user?.photoURL;

    const formatDate = (timestamp: any) => {
        if (!timestamp) return "Reciente";
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
        } catch {
            return "Reciente";
        }
    };

    const getStatusBadge = (status: string) => {
        const map: Record<string, { label: string; color: string }> = {
            pending: { label: "Pendiente", color: "bg-primary/10 text-primary border-primary/20" },
            quoted: { label: "Cotizado", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
            negotiating: { label: "En Negociación", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
            pending_acceptance: { label: "Esperando tu ok", color: "bg-secondary/10 text-secondary border-secondary/20" },
            counter_offer: { label: "Contraoferta Recibida", color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
            counteroffered: { label: "Esperando tu ok", color: "bg-secondary/10 text-secondary border-secondary/20" },
            contraoferta_usuario: { label: "En Revisión", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
            confirmed: { label: "Confirmado", color: "bg-primary/10 text-primary border-primary/20" },
            venta_finalizada: { label: "Trato Cerrado", color: "bg-primary/10 text-primary border-primary/20" },
            completed: { label: "Completado", color: "bg-green-500/10 text-green-500 border-green-500/20" },
            cancelled: { label: "Cancelado", color: "bg-red-500/10 text-red-500 border-red-500/20" },
        };
        const s = map[status] || map.pending;
        return <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${s.color}`}>{s.label}</span>;
    };

    // --- Derived Negotiation Values for the Drawer ---
    const historyAdminOffer = selectedOrder?.negotiationHistory?.filter((h: any) => h.sender === 'admin').pop();
    // CRITICAL FIX: No fallback to manifest.cashAdjustment here because that represents the current state (often the user's initial proposal),
    // not an explicit intervention from the admin.
    const derivedAdminPrice = historyAdminOffer?.price ?? selectedOrder?.adminPrice ?? selectedOrder?.admin_offer_price;
    const hasAdminOffer = derivedAdminPrice !== undefined && derivedAdminPrice !== null;

    // Statuses that represent an active OBG response waiting for user action
    const isWaitingUserAction = ['counteroffered', 'counter_offer', 'quoted'].includes(selectedOrder?.status);

    // User should only see "Accept/Counter" if OBG has actually moved or the status is explicitly waiting for them.
    // If the status is 'pending' or 'contraoferta_usuario', the user is the one who moved last.
    const shouldShowActions = isWaitingUserAction || (hasAdminOffer && !['pending', 'contraoferta_usuario'].includes(selectedOrder?.status));
    const derivedAdminCurrency = historyAdminOffer?.currency || selectedOrder?.adminCurrency || selectedOrder?.admin_offer_currency || selectedOrder?.manifest?.currency || "ARS";

    return (
        <div className="space-y-16 py-10">
            {/* Header */}
            <header className="relative">
                <div className="absolute inset-0 bg-primary/10 blur-[120px] -z-10 rounded-full opacity-50" />
                <div className="flex flex-col md:flex-row items-center md:items-end gap-10">
                    <div className="relative group">
                        <div className="h-40 w-40 rounded-[2.5rem] bg-gradient-to-br from-primary to-primary-dark p-1 shadow-2xl overflow-hidden ring-4 ring-white/5">
                            <div className="w-full h-full rounded-[2.3rem] bg-black flex items-center justify-center overflow-hidden">
                                {photoURL ? (
                                    <img src={photoURL} alt={displayName} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-5xl font-black text-primary">{displayName.charAt(0)}</span>
                                )}
                            </div>
                        </div>
                        <button className="absolute bottom-1 right-1 p-2.5 bg-white text-black rounded-2xl shadow-xl hover:scale-110 hover:bg-primary transition-all">
                            <Edit3 className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="flex-1 space-y-4 text-center md:text-left">
                        <div className="flex flex-wrap justify-center md:justify-start items-center gap-4">
                            <h1 className="text-5xl font-display font-black text-white tracking-tightest leading-none">{displayName}</h1>
                            <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-1 rounded-full font-black tracking-widest uppercase text-[10px]">
                                {isAdmin ? "Arquitecto Maestro" : "Coleccionista Pro"}
                            </Badge>
                        </div>
                        <div className="flex flex-wrap justify-center md:justify-start items-center gap-6 text-gray-500 font-bold uppercase tracking-widest text-[10px]">
                            <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Buenos Aires, AR</div>
                            <div className="flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Nivel Elite</div>
                            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Est. 2024</div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button className="p-4 bg-white/5 border border-white/10 rounded-2xl text-white hover:bg-white/10 transition-all">
                            <Settings className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Content Area - Tabbed View */}
            <div className="max-w-4xl mx-auto w-full py-12 md:py-20">
                <div className="space-y-10">
                    <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-white/5 pb-8 gap-6">
                        <div className="space-y-4">
                            <h2 className="text-4xl font-display font-black text-white tracking-tightest leading-none uppercase">
                                Actividad de <span className="text-primary">Coleccionista</span>
                            </h2>
                            <div className="flex bg-white/5 p-1 rounded-2xl w-fit">
                                <button
                                    onClick={() => setActiveTab("trades")}
                                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "trades" ? "bg-primary text-black" : "text-gray-500 hover:text-white"}`}
                                >
                                    Actividad
                                </button>
                                <Link
                                    to="/mensajes"
                                    className="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-gray-500 hover:text-white"
                                >
                                    Mensajes
                                </Link>
                                <button
                                    onClick={() => setActiveTab("collection")}
                                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "collection" ? "bg-primary text-black" : "text-gray-500 hover:text-white"}`}
                                >
                                    Mi Colección
                                </button>
                            </div>
                        </div>
                        <Badge className="bg-white/5 text-gray-500 border-white/10 px-4 py-2 rounded-xl font-bold">
                            {activeTab === "trades" ? trades.length : "ACTIVOS"}
                        </Badge>
                    </div>

                    {activeTab === "trades" ? (
                        <div className="space-y-5">
                            {ordersLoading ? (
                                <div className="space-y-4">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div key={i} className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 h-32 animate-pulse" />
                                    ))}
                                </div>
                            ) : trades.length === 0 ? (
                                <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[3rem] space-y-6 text-center">
                                    <ShoppingBag className="h-12 w-12 text-gray-700" />
                                    <div className="space-y-2">
                                        <p className="text-white font-black uppercase tracking-widest">{TEXTS.perfil.profile.noActivity}</p>
                                        <p className="text-gray-600 text-xs font-bold uppercase tracking-widest max-w-xs">{TEXTS.perfil.profile.noActivitySub}</p>
                                    </div>
                                    <Link to="/tienda" className="bg-primary text-black px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-all">
                                        Explorar La Batea
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    {trades.map((trade, i) => (
                                        <motion.div
                                            key={trade.id}
                                            initial={{ opacity: 0, y: 15 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.04 }}
                                        >
                                            <OrderCard
                                                key={`${trade.id}-${trade.status}`}
                                                order={trade as any}
                                                context="profile"
                                                onClick={() => setSelectedOrder(trade as any)}
                                            />
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex justify-end">
                                <Link
                                    to="/trade/new"
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/30 text-violet-400 hover:from-violet-500/20 hover:to-purple-500/20 hover:text-violet-300 text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    <Handshake className="w-4 h-4" /> Iniciar Intercambio
                                </Link>
                            </div>
                            <UserCollection userId={user?.uid || ""} />
                        </div>
                    )}
                </div>
            </div>


            {/* Order Details Drawer */}
            <OrderDetailsDrawer
                isOpen={!!selectedOrder}
                onClose={() => setSelectedOrder(null)}
                title={selectedOrder ? (() => {
                    const items = selectedOrder.items || [];
                    const isBatch = (items.length > 1);
                    const rawArtist = (items[0]?.artist || selectedOrder.details?.artist || "Artista Desconocido");
                    const rawAlbum = (selectedOrder.details?.album || items[0]?.title || "Detalle de Pedido");

                    if (isBatch) return `LOTE DE ${items.length} DISCOS`;

                    const displayArtist = (rawArtist.toLowerCase() === rawAlbum.toLowerCase())
                        ? (user?.displayName || "Varios Artistas")
                        : rawArtist;

                    return `${displayArtist} - ${rawAlbum}`;
                })() : "Detalle de Pedido"}
                footer={
                    selectedOrder && (
                        <div className="space-y-4">
                            {/* Negotiation Actions Footer */}
                            {!isNegotiating && selectedOrder.status !== "completed" && selectedOrder.status !== "venta_finalizada" && selectedOrder.status !== "cancelled" && (
                                <>
                                    {/* Negotiation Buttons (if there's an offer to respond to) */}
                                    {shouldShowActions && selectedOrder.status !== "contraoferta_usuario" && (
                                        <div className="space-y-3">
                                            {!showCounterInput ? (
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                    <button
                                                        onClick={() => {
                                                            if (selectedOrder.type === 'exchange') {
                                                                handleAcceptTrade(selectedOrder);
                                                            } else {
                                                                handleAcceptProposal(selectedOrder);
                                                            }
                                                        }}
                                                        disabled={isNegotiating}
                                                        className="flex items-center justify-center gap-2 px-3 py-3 bg-primary text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50"
                                                    >
                                                        <CheckCircle2 className="h-4 w-4" /> Aceptar
                                                    </button>
                                                    <button
                                                        onClick={() => setShowCounterInput(true)}
                                                        disabled={isNegotiating}
                                                        className="flex items-center justify-center gap-2 px-3 py-3 bg-white/5 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-50"
                                                    >
                                                        <Handshake className="h-4 w-4" /> Contraofertar
                                                    </button>
                                                    <button
                                                        onClick={() => handleRejectOffer()}
                                                        disabled={isNegotiating}
                                                        className="col-span-2 md:col-span-1 flex items-center justify-center gap-2 px-3 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all disabled:opacity-50"
                                                    >
                                                        <X className="h-4 w-4" /> Rechazar
                                                    </button>
                                                </div>
                                            ) : (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="bg-neutral-900 border border-white/10 p-4 rounded-2xl space-y-3 shadow-2xl"
                                                >
                                                    {selectedOrder.type === 'exchange' ? (
                                                        <>
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Ajustar diferencia en efectivo:</p>
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <div className="relative flex-1">
                                                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
                                                                    <input
                                                                        type="number"
                                                                        value={counterOfferPrice}
                                                                        onChange={e => setCounterOfferPrice(e.target.value)}
                                                                        placeholder="Ej: 50000"
                                                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-9 py-3 text-white font-bold text-sm focus:border-primary focus:outline-none transition-all"
                                                                    />
                                                                </div>
                                                                <div className="flex flex-col gap-1 shrink-0">
                                                                    <label className="text-[9px] text-gray-500 uppercase font-black flex items-center gap-1 cursor-pointer">
                                                                        <input type="radio" name="counterDirectionProfile" value="pay" defaultChecked /> Pago extra
                                                                    </label>
                                                                    <label className="text-[9px] text-gray-500 uppercase font-black flex items-center gap-1 cursor-pointer">
                                                                        <input type="radio" name="counterDirectionProfile" value="receive" /> Solicito extra
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">¿Cuánto pides por el lote?</p>
                                                            <div className="flex gap-2">
                                                                <div className="relative flex-1">
                                                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
                                                                    <input
                                                                        type="number"
                                                                        value={counterOfferPrice}
                                                                        onChange={e => setCounterOfferPrice(e.target.value)}
                                                                        placeholder="Ej: 50000"
                                                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-9 py-3 text-white font-bold text-sm focus:border-primary focus:outline-none transition-all"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                    <div className="flex gap-2 pt-2">
                                                        <button
                                                            onClick={async () => {
                                                                if (selectedOrder.type === 'exchange') {
                                                                    setIsNegotiating(true);
                                                                    showLoading('Enviando contraoferta...');
                                                                    try {
                                                                        const val = parseFloat(counterOfferPrice) || 0;
                                                                        const isPay = (document.querySelector('input[name="counterDirectionProfile"]:checked') as HTMLInputElement).value === 'pay';
                                                                        const amount = isPay ? val : -val;
                                                                        const newManifest = {
                                                                            ...selectedOrder.manifest,
                                                                            cashAdjustment: amount
                                                                        };
                                                                        await tradeService.counterTrade(selectedOrder.id, newManifest, user!.uid);
                                                                        setSelectedOrder((prev: any) => ({ ...prev, status: 'contraoferta_usuario', manifest: newManifest }));
                                                                        fetchTrades();
                                                                    } catch (err: any) {
                                                                        console.error(err);
                                                                        alert('Error al enviar la contraoferta');
                                                                    } finally {
                                                                        setIsNegotiating(false);
                                                                        hideLoading();
                                                                        setShowCounterInput(false);
                                                                        setCounterOfferPrice("");
                                                                    }
                                                                } else {
                                                                    handleCounterOffer(selectedOrder);
                                                                }
                                                            }}
                                                            disabled={!counterOfferPrice || isNegotiating}
                                                            className="flex-1 px-6 bg-primary text-black rounded-xl font-black uppercase text-[10px] py-3 tracking-widest hover:bg-white transition-all disabled:opacity-20"
                                                        >
                                                            Enviar Propuesta
                                                        </button>
                                                        <button
                                                            onClick={() => setShowCounterInput(false)}
                                                            className="flex-1 py-3 bg-white/5 border border-white/10 text-center text-[10px] rounded-xl font-bold text-gray-400 uppercase tracking-widest hover:text-white transition-colors"
                                                        >
                                                            Cancelar
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    )}

                                    {selectedOrder.status === "contraoferta_usuario" && (
                                        <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 text-center">
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Esperando respuesta de OBG</p>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => {
                                            pushWhatsAppContactFromOrder(selectedOrder);
                                            window.open(whatsappService.generateTradeLink(selectedOrder.id), "_blank");
                                        }}
                                        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600/20 hover:bg-green-600/30 text-green-500 border border-green-500/20 rounded-xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all"
                                    >
                                        <MessageCircle className="h-4 w-4" />
                                        Dudas o Consultas
                                    </button>
                                </>
                            )}
                        </div>
                    )
                }
            >
                {selectedOrder && (
                    <div className="px-4 py-8 relative">
                        {/* TAREA 1: Botón de Cierre (X) */}
                        <button
                            onClick={() => setSelectedOrder(null)}
                            style={{
                                position: 'absolute',
                                top: '1rem',
                                right: '1rem',
                                width: '32px',
                                height: '32px',
                                background: '#000',
                                color: '#fff',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 50,
                                cursor: 'pointer'
                            }}
                            className="shadow-xl active:scale-95 transition-transform"
                        >
                            <X className="h-4 w-4" />
                        </button>
                        {/* Header — TAREA 2 & 4 */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                            <div className="space-y-1">
                                <h4 className="text-xl md:text-3xl font-display font-black text-white uppercase tracking-tighter">{TEXTS.perfil.profile.recentOrders}</h4>
                            </div>
                            <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-gray-500 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">ID: {selectedOrder.id}</p>
                                <p className="text-sm text-gray-400 font-bold uppercase">
                                    Fecha: <span className="text-gray-200">
                                        {selectedOrder?.createdAt?.seconds
                                            ? new Date(selectedOrder.createdAt.seconds * 1000).toLocaleString()
                                            : (selectedOrder?.timestamp?.seconds
                                                ? new Date(selectedOrder.timestamp.seconds * 1000).toLocaleString()
                                                : "Sincronizando...")}
                                    </span>
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                    {getStatusBadge(selectedOrder.status)}
                                </div>

                                <span className="text-[10px] text-gray-600 uppercase tracking-widest font-bold mt-2">
                                    Operación: <span className={selectedOrder.type === 'exchange' ? 'text-violet-400' : selectedOrder.type === 'buy' ? 'text-emerald-400' : 'text-orange-400'}>
                                        {selectedOrder.type === 'exchange' ? 'Intercambio' : selectedOrder.type === 'buy' ? 'Compra' : 'Venta'}
                                    </span>
                                </span>
                            </div>
                        </div>

                        {/* Negotiation Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                            {/* Initial Offer / Latest User Offer */}
                            {(() => {
                                const historyUserOffer = selectedOrder.negotiationHistory?.filter((h: any) => h.sender === 'user').pop();
                                const userPrice = historyUserOffer?.price || selectedOrder.totalPrice || selectedOrder.details?.price || (selectedOrder.type === 'exchange' ? selectedOrder.manifest?.cashAdjustment : 0);
                                const userCurrency = historyUserOffer?.currency || selectedOrder.currency || selectedOrder.details?.currency || selectedOrder.manifest?.currency || "ARS";

                                if (userPrice === undefined || userPrice === null || (selectedOrder.type === 'exchange' && !selectedOrder.manifest?.cashAdjustment)) return null;

                                return (
                                    <div className="p-6 rounded-3xl bg-secondary/5 border border-secondary/10 flex flex-col justify-between group hover:bg-secondary/10 transition-all">
                                        <p className="text-[9px] uppercase tracking-[0.2em] font-black text-secondary/70 mb-3">
                                            {selectedOrder.type === 'exchange' ? 'Ajuste Propuesto' : (historyUserOffer ? 'Tu Última Contraoferta' : 'Tu Oferta Inicial')}
                                        </p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-display font-black text-white">
                                                {userCurrency === "USD" ? "US$" : "$"} {Math.abs(userPrice).toLocaleString()}
                                            </span>
                                            {selectedOrder.type === 'exchange' && (
                                                <span className="text-[10px] font-bold text-gray-500 uppercase">
                                                    {userPrice > 0 ? '(Pagas)' : '(Recibes)'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Admin Counter-Offer */}
                            {(() => {
                                const historyAdminOffer = selectedOrder.negotiationHistory?.filter((h: any) => h.sender === 'admin').pop();
                                const adminPrice = historyAdminOffer?.price || selectedOrder.adminPrice;
                                const adminCurrency = historyAdminOffer?.currency || selectedOrder.adminCurrency || "ARS";

                                if (!adminPrice) return null;

                                return (
                                    <div className="p-6 rounded-3xl bg-primary/10 border border-primary/20 flex flex-col justify-between shadow-2xl shadow-primary/5 group hover:bg-primary/20 transition-all">
                                        <p className="text-[9px] uppercase tracking-[0.2em] font-black text-primary mb-3">
                                            {historyAdminOffer ? 'Última Propuesta OBG' : 'Contraoferta de OBG'}
                                        </p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-display font-black text-white">
                                                {adminCurrency === "USD" ? "US$" : "$"} {Math.abs(adminPrice).toLocaleString()}
                                            </span>
                                            {selectedOrder.type === 'exchange' && (
                                                <span className="text-[10px] font-bold text-gray-500 uppercase">
                                                    {adminPrice > 0 ? '(Pagas)' : '(Recibes)'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Items List */}
                        <div className="space-y-0 mb-8 mt-2">
                            {selectedOrder.type === 'exchange' ? (
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400 italic flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-orange-500" /> Discos Ofrecidos
                                        </h4>
                                        <div className="space-y-2">
                                            {selectedOrder.manifest?.offeredItems?.map((id: string) => {
                                                const item = itemDetails[id];
                                                return (
                                                    <div key={id} className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-3 flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-orange-500/20">
                                                            <LazyImage src={item?.media.thumbnail || '/default-album.png'} alt="" className="w-full h-full object-cover" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-bold text-white truncate">{item?.metadata.title || "Cargando..."}</p>
                                                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter truncate">{item?.metadata.artist || ""}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {(!selectedOrder.manifest?.offeredItems || selectedOrder.manifest.offeredItems.length === 0) && (
                                                <p className="text-[10px] text-gray-600 italic pl-4">Sin discos ofrecidos. (Ajuste en efectivo)</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-3 border-t border-white/5 pt-4">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 italic flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" /> Discos Solicitados
                                        </h4>
                                        <div className="space-y-2">
                                            {selectedOrder.manifest?.requestedItems?.map((id: string) => {
                                                const item = itemDetails[id];
                                                return (
                                                    <div key={id} className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-emerald-500/20">
                                                            <LazyImage src={item?.media.thumbnail || '/default-album.png'} alt="" className="w-full h-full object-cover" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-bold text-white truncate">{item?.metadata.title || "Cargando..."}</p>
                                                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter truncate">{item?.metadata.artist || ""}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {(!selectedOrder.manifest?.requestedItems || selectedOrder.manifest.requestedItems.length === 0) && (
                                                <p className="text-[10px] text-gray-600 italic pl-4">Sin discos solicitados</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 italic mb-4">Detalle del Lote</h4>
                                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                                        selectedOrder.items.map((item: any, idx: number) => (
                                            <div key={idx} className="border-b border-white/10 py-5 flex items-start gap-4">
                                                {/* TAREA 2: Imagen de ítem con fallbacks robustos */}
                                                <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0 bg-white/5 border border-white/10">
                                                    <LazyImage
                                                        src={item.cover_image || item.thumb || item.image || item.cover || '/default-album.png'}
                                                        alt={item.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0 space-y-2">
                                                    <div className="space-y-1">
                                                        <h4 className="font-bold text-white uppercase text-base leading-tight truncate">{item.title}</h4>
                                                        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest truncate">{item.artist}</p>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                        <span className="bg-gray-800 text-gray-300 px-2 py-1 text-[9px] font-black uppercase rounded">{item.format}</span>
                                                        <span className="bg-blue-900/30 text-blue-400 px-2 py-1 text-[9px] font-black uppercase rounded border border-blue-500/20">{item.condition}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : !selectedOrder.isBatch ? (
                                        <div className="border-b border-white/10 py-5 flex items-start gap-4">
                                            <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0 bg-white/5 border border-white/10">
                                                <LazyImage
                                                    src={selectedOrder.details?.cover_image || (selectedOrder.details as any)?.thumb}
                                                    alt={selectedOrder.details?.album}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0 space-y-2">
                                                <div className="space-y-1">
                                                    <h4 className="font-bold text-white uppercase text-base leading-tight truncate">
                                                        {selectedOrder.details?.album}
                                                    </h4>
                                                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest truncate">
                                                        {selectedOrder.details?.artist}
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    <span className="bg-gray-800 text-gray-300 px-2 py-1 text-[9px] font-black uppercase rounded">{selectedOrder.details?.format}</span>
                                                    <span className="bg-blue-900/30 text-blue-400 px-2 py-1 text-[9px] font-black uppercase rounded border border-blue-500/20">{selectedOrder.details?.condition}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
                                            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Sin ítems registrados</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Static Blocks (Moved from Footer) */}
                        <div className="space-y-6 mb-8 mt-2">
                            {/* Negotiation History Timeline (Profile Side) - Hidden on Completion */}
                            {selectedOrder.status !== "completed" && selectedOrder.status !== "venta_finalizada" && selectedOrder.negotiationHistory && selectedOrder.negotiationHistory.length > 0 && (
                                <details className="group cursor-pointer border-b border-white/5 pb-4">
                                    <summary className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors outline-none flex items-center justify-between">
                                        <span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> Ver Línea de Tiempo de Negociación</span>
                                        <ChevronDown className="h-3.5 w-3.5 group-open:rotate-180 transition-transform" />
                                    </summary>

                                    <div className="relative space-y-4 max-h-[300px] overflow-y-auto pr-4 custom-scrollbar mt-6">
                                        {/* Central vertical line */}
                                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/5 -translate-x-1/2" />

                                        {selectedOrder.negotiationHistory.map((h: any, i: number) => (
                                            <div key={i} className={`flex w-full items-center ${h.sender === 'admin' ? "justify-start" : "justify-end"}`}>
                                                <div className={`relative w-[45%] p-3 rounded-xl border ${h.sender === 'admin'
                                                    ? "bg-primary/5 border-primary/20 text-left"
                                                    : "bg-secondary/5 border-secondary/20 text-right"
                                                    }`}>
                                                    {/* Connector Dot */}
                                                    <div className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 bg-black z-10 ${h.sender === 'admin'
                                                        ? "left-[calc(100%+11px)] border-primary"
                                                        : "right-[calc(100%+11px)] border-secondary"
                                                        }`} />

                                                    <div className="flex flex-col gap-0.5">
                                                        <span className={`text-[8px] font-black uppercase tracking-tighter ${h.sender === 'admin' ? "text-primary" : "text-secondary"
                                                            }`}>
                                                            {h.sender === 'admin' ? "Oldie but Goldie" : "Tú (Cliente)"}
                                                        </span>
                                                        <span className="text-sm font-black text-white">
                                                            {h.currency === "USD" ? "US$" : "$"} {(h.price || 0).toLocaleString()}
                                                        </span>
                                                        <span className="text-[8px] text-gray-600 font-mono mt-1">
                                                            {h.timestamp?.seconds
                                                                ? new Date(h.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                                : "Reciente"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            )}

                            {isNegotiating ? (
                                <div className="space-y-4">
                                    <div className="h-48 bg-white/5 rounded-[2rem] animate-pulse" />
                                    <div className="h-12 bg-white/5 rounded-2xl animate-pulse" />
                                </div>
                            ) : (selectedOrder.status === "completed" || selectedOrder.status === "venta_finalizada") ? (
                                <div className="space-y-6">
                                    <div id="printable-receipt" className="bg-green-500/10 border border-green-500/20 rounded-[2rem] p-8 space-y-6 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-8 opacity-5">
                                            <FileText size={120} />
                                        </div>

                                        <div className="flex flex-col items-center justify-center p-8 text-center space-y-6">
                                            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/20">
                                                <CheckCircle2 className="w-8 h-8 text-black" />
                                            </div>
                                            <div className="space-y-2">
                                                <h3 className="text-2xl font-display font-black text-white uppercase tracking-tighter">{TEXTS.perfil.profile.saleFinished}</h3>
                                                <p className="text-gray-400 text-sm font-medium leading-relaxed">
                                                    {TEXTS.perfil.profile.saleSuccess}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="border-t border-white/5 pt-6 space-y-4">
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                                <span className="text-gray-500">Precio Acordado</span>
                                                <span className="text-primary text-base">
                                                    {selectedOrder.currency === 'USD' ? 'US$' : '$'} ${(selectedOrder.totalPrice || selectedOrder.adminPrice || 0).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-500">
                                                <span>Items Aceptados</span>
                                                <span className="text-white">{selectedOrder.items?.length || 0}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <button
                                                onClick={() => {
                                                    pushWhatsAppContactFromOrder(selectedOrder);
                                                    window.open(whatsappService.generateAcceptDealLink(selectedOrder.id), "_blank");
                                                }}
                                                className="w-full flex items-center justify-center gap-3 bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-green-500/20"
                                            >
                                                <MessageCircle className="h-5 w-5" />
                                                {TEXTS.global.success.contactWhatsApp}
                                            </button>
                                            <button
                                                onClick={() => window.print()}
                                                className="flex-none flex items-center justify-center gap-3 px-6 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                            >
                                                <Download className="h-4 w-4" />
                                                Imprimir / PDF
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 text-center">
                                        <p className="text-[9px] text-gray-700 font-black uppercase tracking-[0.3em]">Registro de Transacción: {selectedOrder.id}</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {shouldShowActions && (
                                        <div className="flex flex-col gap-4">
                                            {/* Admin Counter-Offer */}
                                            {hasAdminOffer && (
                                                <div className="bg-primary/5 rounded-2xl p-6 border border-primary/20">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <BadgeDollarSign className="h-5 w-5 text-primary" />
                                                        <span className="text-xs font-black uppercase tracking-widest text-primary">Oldie but Goldie te ofrece</span>
                                                    </div>
                                                    <p className="text-4xl font-display font-black text-white tracking-tight">
                                                        {derivedAdminCurrency === "USD" ? "US$" : "$"} {derivedAdminPrice.toLocaleString()}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* User Offer Highlight */}
                        <div className="bg-secondary/5 border border-secondary/20 rounded-2xl p-5 space-y-2 mb-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-secondary">Oferta Inicial</span>
                            <div className="flex items-center gap-3">
                                <DollarSign className="h-5 w-5 text-secondary" />
                                <span className="text-3xl font-display font-black text-white">
                                    {selectedOrder.totalPrice
                                        ? `${selectedOrder.currency === 'USD' ? 'US$' : '$'} ${selectedOrder.totalPrice.toLocaleString()}`
                                        : (selectedOrder.details?.price
                                            ? `${selectedOrder.details.currency === 'USD' ? 'US$' : '$'} ${selectedOrder.details.price.toLocaleString()}`
                                            : "Precio no especificado")}
                                </span>
                            </div>
                        </div>

                        <Link
                            to={`/orden/${selectedOrder.id}`}
                            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10 mt-6"
                        >
                            <Search className="h-4 w-4" /> Link Público del Lote
                        </Link>
                    </div>
                )}
            </OrderDetailsDrawer>
            {/* Trade Details Modal */}
            <AnimatePresence>
                {selectedTrade && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => { setSelectedTrade(null); setIsEditing(false); }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-4xl bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
                        >
                            <div className="p-8 space-y-8 overflow-y-auto flex-1">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                                            {isEditing ? "Editando Propuesta" : "Detalle de Canje"}
                                        </h3>
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${selectedTrade.status === 'accepted' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                            'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                            }`}>
                                            {selectedTrade.status}
                                        </span>
                                    </div>
                                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-xl">
                                        Turno: {selectedTrade.currentTurn === user?.uid ? <span className="text-primary">Tu Turno</span> : "Oldie but Goldie"}
                                    </div>
                                </div>

                                <ManifestEditor
                                    manifest={isEditing ? (editedManifest as TradeManifest) : selectedTrade.manifest}
                                    onChange={(m) => setEditedManifest(m)}
                                    isLocked={!isEditing}
                                    myItems={[]} // TBD in Phase Delta
                                    theirItems={[]}
                                />

                                {selectedTrade.status !== 'accepted' && selectedTrade.status !== 'cancelled' && (
                                    <div className="flex gap-4 pt-8">
                                        {isEditing ? (
                                            <>
                                                <button
                                                    onClick={handleCounterOfferTrade}
                                                    className="flex-1 flex items-center justify-center gap-3 py-4 bg-primary text-black rounded-2xl font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg shadow-primary/20"
                                                >
                                                    <ArrowRightLeft className="h-5 w-5" /> Enviar Contraoferta
                                                </button>
                                                <button
                                                    onClick={() => setIsEditing(false)}
                                                    className="px-8 py-4 bg-white/5 text-gray-400 rounded-2xl font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                                                >
                                                    Cancelar
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                {selectedTrade.currentTurn === user?.uid && (
                                                    <button
                                                        onClick={() => handleAcceptTrade(selectedTrade)}
                                                        className="flex-1 flex items-center justify-center gap-3 py-4 bg-primary text-black rounded-2xl font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg shadow-primary/20"
                                                    >
                                                        <CheckCircle2 className="h-5 w-5" /> Aceptar Canje
                                                    </button>
                                                )}
                                                {selectedTrade.currentTurn === user?.uid && (
                                                    <button
                                                        onClick={() => {
                                                            setEditedManifest(selectedTrade.manifest);
                                                            setIsEditing(true);
                                                        }}
                                                        className="flex-1 flex items-center justify-center gap-3 py-4 bg-white/5 text-white border border-white/10 rounded-2xl font-black uppercase tracking-widest hover:bg-primary hover:text-black transition-all"
                                                    >
                                                        <Edit3 className="h-5 w-5" /> Mejorar Oferta
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setSelectedTrade(null)}
                                                    className="flex-1 flex items-center justify-center gap-3 py-4 bg-white/5 text-gray-500 border border-white/10 rounded-2xl font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                                                >
                                                    Cerrar
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}

                                {selectedTrade.status === 'accepted' && (
                                    <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-[2rem] flex items-center gap-4">
                                        <div className="p-3 bg-green-500 rounded-2xl">
                                            <CheckCircle2 className="h-6 w-6 text-black" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Canje Realizado</p>
                                            <p className="text-sm font-bold text-white">El intercambio ha sido confirmado. Coordina la entrega por WhatsApp.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
}
