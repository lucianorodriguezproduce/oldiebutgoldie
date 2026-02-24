import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TEXTS } from "@/constants/texts";
import { db } from "@/lib/firebase";
import { LazyImage } from "@/components/ui/LazyImage";
import {
    collection,
    onSnapshot,
    query,
    orderBy,
    doc,
    updateDoc,
    addDoc,
    serverTimestamp,
    arrayUnion
} from "firebase/firestore";
import {
    ShoppingBag,
    Clock,
    DollarSign,
    Tag,
    Music,
    MessageCircle,
    ChevronDown,
    CheckCircle2,
    XCircle,
    Handshake,
    Filter,
    User as UserIcon,
    TrendingUp,
    Send,
    BadgeDollarSign,
    Hash,
    ChevronRight,
    Disc
} from "lucide-react";
import { SEO } from '@/components/SEO';
import OrderCard from '@/components/OrderCard';
import OrderDetailsDrawer from "@/components/OrderDetailsDrawer";
import { useLoading } from "@/context/LoadingContext";
import { useAuth } from "@/context/AuthContext";
import { trackEvent } from "@/components/AnalyticsProvider";

interface OrderDoc {
    id: string;
    user_id: string;
    user_email: string;
    user_name: string;
    user_photo: string;
    order_number?: string;
    item_id: number;
    status: string;
    timestamp: any;
    createdAt?: any;
    negotiationHistory?: {
        price: number;
        currency: string;
        sender: 'admin' | 'user';
        timestamp: any;
        message?: string;
    }[];
    market_reference?: number | null;
    admin_offer_price?: number;
    admin_offer_currency?: string;
    adminPrice?: number;
    adminCurrency?: string;
    totalPrice?: number;
    currency?: string;
    details: {
        format: string;
        condition: string;
        intent: string;
        artist: string;
        album: string;
        cover_image?: string;
        price?: number;
        currency?: string;
    };
    isBatch?: boolean;
    items?: any[];
    type?: 'buy' | 'sell';
    intent?: string;
    view_count?: number;
    last_viewed_at?: any;
    unique_visitors?: string[];
}

type StatusFilter = "all" | "pending" | "negotiating" | "completed" | "cancelled" | "quoted";
type SortOption = "default" | "popularity";

const STATUS_OPTIONS = [
    { value: "pending", label: "Pendiente", icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20" },
    { value: "quoted", label: "Cotizado", icon: BadgeDollarSign, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
    { value: "negotiating", label: "En Negociación", icon: Handshake, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    { value: "counteroffered", label: "Precio Definido", icon: Send, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
    { value: "pending_acceptance", label: "Esperando Cliente", icon: Clock, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
    { value: "offer_sent", label: "Oferta Enviada", icon: Send, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
    { value: "venta_finalizada", label: "Venta Finalizada", icon: CheckCircle2, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
    { value: "completed", label: "Completado", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10 border-green-500/20" },
    { value: "cancelled", label: "Cancelado", icon: XCircle, color: "text-red-500", bg: "bg-red-500/10 border-red-500/20" },
];

import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { formatDate, getReadableDate } from "@/utils/date";

export default function AdminOrders() {
    const { showLoading, hideLoading } = useLoading();
    const [orders, setOrders] = useState<OrderDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [sortBy, setSortBy] = useState<SortOption>("default");

    // Drawer state
    const [selectedOrder, setSelectedOrder] = useState<OrderDoc | null>(null);
    const [showCelebration, setShowCelebration] = useState(false);
    const prevOrdersRef = useRef<OrderDoc[]>([]);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // Quote form state
    const [quotePrice, setQuotePrice] = useState("");
    const [quoteCurrency, setQuoteCurrency] = useState("ARS");
    const [quotingId, setQuotingId] = useState<string | null>(null);

    useEffect(() => {
        showLoading("Sincronizando Base de Pedidos...");
        const q = query(collection(db, "orders"), orderBy("timestamp", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            try {
                const docs = snap.docs.map(d => ({
                    id: d.id,
                    user_email: "Sin email",
                    user_name: "Usuario Registrado",
                    user_photo: "",
                    ...d.data()
                } as OrderDoc));
                setOrders(docs);
            } catch (processError) {
                console.error("Error processing orders snapshot:", processError);
            } finally {
                setLoading(false);
                hideLoading();
            }
        }, (err) => {
            console.error("Orders snapshot error:", err);
            setLoading(false);
            hideLoading();
        });
        return () => unsub();
    }, []);

    // Keep selectedOrder in sync with orders list (TAREA 5 - DIRECTIVA 7)
    useEffect(() => {
        if (selectedOrder) {
            const latest = orders.find(o => o.id === selectedOrder.id);
            if (latest && JSON.stringify(latest) !== JSON.stringify(selectedOrder)) {
                setSelectedOrder(latest);
            }
        }
    }, [orders, selectedOrder?.id]);

    // Reverting incorrect block from previous tool call
    // (This was accidentally applied to AdminOrders.tsx instead of AnalyticsDashboard.tsx)
    // I will remove it if it was added. Let me check the file content first.

    const handleStatusChange = async (orderId: string, newStatus: string) => {
        showLoading(TEXTS.admin.updatingStatus);
        setUpdatingId(orderId);
        try {
            await updateDoc(doc(db, "orders", orderId), { status: newStatus });
            const order = orders.find(o => o.id === orderId);
            if (order) {
                const statusLabel = STATUS_OPTIONS.find(s => s.value === newStatus)?.label || newStatus;
                const artist = (order.details?.artist || (order as any).artist || 'Unknown Artist').trim();
                const album = (order.details?.album || (order as any).title || 'Unknown Album').trim();
                const itemTitle = `${artist} - ${album}`;
                await addDoc(collection(db, "notifications"), {
                    user_id: order.user_id,
                    title: "Actualización de Pedido",
                    message: `Tu pedido de ${itemTitle} ha cambiado a: ${statusLabel}`,
                    read: false,
                    timestamp: serverTimestamp(),
                    order_id: order.id
                });
            }
            // Update selectedOrder if same
            if (selectedOrder?.id === orderId) {
                setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
            }
        } catch (error) {
            console.error("Error updating order status:", error);
        } finally {
            setUpdatingId(null);
            setActiveDropdown(null);
            hideLoading();
        }
    };

    const handleSetAdminPrice = async (order: OrderDoc) => {
        const priceVal = parseFloat(quotePrice || "0");
        const currencyVal = quoteCurrency || "ARS";
        if (!priceVal || priceVal <= 0) return;

        const confirm = window.confirm(TEXTS.admin.confirmSetPrice(priceVal, currencyVal));
        if (confirm) {
            trackEvent('send_counter_offer', {
                order_id: order.id,
                price: priceVal,
                currency: currencyVal
            });
            showLoading(TEXTS.admin.settingPrice);
            setQuotingId(order.id);
            try {
                await updateDoc(doc(db, "orders", order.id), {
                    adminPrice: priceVal,
                    adminCurrency: currencyVal,
                    status: "counteroffered",
                    negotiationHistory: arrayUnion({
                        price: priceVal,
                        currency: currencyVal,
                        sender: 'admin',
                        timestamp: new Date()
                    })
                });

                const currSymbol = currencyVal === "USD" ? "US$" : "$";
                await addDoc(collection(db, "notifications"), {
                    user_id: order.user_id,
                    title: "Contraoferta Recibida",
                    message: `Oldie but Goldie ha definido un precio de ${currSymbol} ${priceVal.toLocaleString()} para tu lote/disco.`,
                    read: false,
                    timestamp: serverTimestamp(),
                    order_id: order.id
                });

                setSelectedOrder(prev => prev ? {
                    ...prev,
                    adminPrice: priceVal,
                    adminCurrency: currencyVal,
                    status: "counteroffered"
                } : null);

                setQuotePrice("");
                // Add success message and error alert as per diff
                // Assuming setSuccessMessage and alert are available or need to be added.
                // For now, I'll just add the console.log for success and alert for error.
                console.log(`${TEXTS.admin.orderUpdate}: ${TEXTS.admin.priceSaved}`);
            } catch (error) {
                console.error("Error setting admin price:", error);
                alert(TEXTS.profile.genericError);
            } finally {
                setQuotingId(null);
                hideLoading();
            }
        }
    };

    const handleSendQuote = async (order: OrderDoc) => {
        const priceVal = parseFloat(quotePrice || "0");
        const currencyVal = quoteCurrency || "ARS";
        if (!priceVal || priceVal <= 0) return;

        showLoading("Enviando cotización...");
        setQuotingId(order.id);
        try {
            await updateDoc(doc(db, "orders", order.id), {
                admin_offer_price: priceVal,
                admin_offer_currency: currencyVal,
                status: "quoted",
                negotiationHistory: arrayUnion({
                    price: priceVal,
                    currency: currencyVal,
                    sender: 'admin',
                    timestamp: new Date()
                })
            });

            const currSymbol = currencyVal === "USD" ? "US$" : "$";
            await addDoc(collection(db, "notifications"), {
                user_id: order.user_id,
                title: "Oferta Recibida",
                message: `Oldie but Goldie ha cotizado tu pedido ${order.order_number || ""} por ${currSymbol} ${priceVal.toLocaleString()}`,
                read: false,
                timestamp: serverTimestamp(),
                order_id: order.id
            });

            // Update selectedOrder to reflect change
            setSelectedOrder(prev => prev ? {
                ...prev,
                admin_offer_price: priceVal,
                admin_offer_currency: currencyVal,
                status: "quoted"
            } : null);

            setQuotePrice("");
        } catch (error) {
            console.error("Error sending quote:", error);
        } finally {
            setQuotingId(null);
            hideLoading();
        }
    };

    const handleWhatsAppContact = (order: OrderDoc) => {
        const name = order.user_name || "Cliente";
        let message;
        if (order.isBatch) {
            message = encodeURIComponent(
                `Hola ${name}! Te contactamos desde Oldie but Goldie por tu Lote de ${(order.items || []).length} ítems. ¿Seguimos coordinando?`
            );
        } else {
            const artist = (order.details?.artist || (order as any).artist || "Unknown Artist").trim();
            const album = (order.details?.album || (order as any).title || "Unknown Album").trim();
            const item = `${artist} - ${album}`;
            const intent = (order.details?.intent || order.status || "COMPRAR") === "COMPRAR" ? "comprar" : "vender";
            const priceText = order.details?.price
                ? ` por ${order.details.currency === "USD" ? "US$" : "$"}${order.details.price.toLocaleString()}`
                : "";
            message = encodeURIComponent(
                `Hola ${name}! Te contactamos desde Oldie but Goldie por tu pedido de ${intent}: ${item}${priceText}. ¿Seguimos coordinando?`
            );
        }
        window.open(`https://wa.me/?text=${message}`, "_blank");
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return "Reciente";
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleDateString("es-AR", {
                day: "2-digit", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit"
            });
        } catch { return "Reciente"; }
    };

    const getStatusConfig = (status: string) =>
        STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];

    const filteredOrders = statusFilter === "all"
        ? orders
        : orders.filter(o => o.status === statusFilter);

    const sortedOrders = [...filteredOrders].sort((a, b) => {
        if (sortBy === "popularity") {
            const aViews = a.view_count || 0;
            const bViews = b.view_count || 0;
            if (aViews !== bViews) return bViews - aViews;
        }

        const aLast = a.negotiationHistory?.[a.negotiationHistory.length - 1];
        const bLast = b.negotiationHistory?.[b.negotiationHistory.length - 1];
        const aRequiresAction = aLast?.sender === 'user' ? 1 : 0;
        const bRequiresAction = bLast?.sender === 'user' ? 1 : 0;

        if (aRequiresAction !== bRequiresAction) {
            return bRequiresAction - aRequiresAction; // User sender first
        }

        // Secondary sort by timestamp if available
        const aTime = a.timestamp?.seconds || 0;
        const bTime = b.timestamp?.seconds || 0;
        return bTime - aTime;
    });

    const pendingCount = orders.filter(o => o.status === "pending").length;
    const negotiatingCount = orders.filter(o => o.status === "negotiating").length;
    const completedCount = orders.filter(o => o.status === "completed").length;
    const itemsCount = orders.filter(o => o.status === "venta_finalizada").length;
    const quotedCount = orders.filter(o => o.status === "quoted").length;

    const openOrder = (order: OrderDoc) => {
        setSelectedOrder(order);
        setQuotePrice("");
        setQuoteCurrency("ARS");
    };

    return (
        <div className="space-y-10">
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <h2 className="text-4xl md:text-6xl font-display font-black text-white uppercase tracking-tighter">{TEXTS.admin.managementTitle}</h2>
                        <p className="text-gray-500 font-medium text-lg">{TEXTS.admin.managementDesc}</p>
                    </div>
                    <Link to="/admin/purge" className="text-[10px] font-black uppercase tracking-widest text-gray-700 hover:text-red-500 transition-colors flex items-center gap-2 group">
                        <Trash2 className="h-3 w-3" />
                        {TEXTS.admin.purgeData}
                    </Link>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-5 gap-4">
                {[
                    { label: "Pendientes", count: pendingCount, color: "yellow-500", icon: Clock },
                    { label: "Cotizados", count: quotedCount, color: "purple-400", icon: BadgeDollarSign },
                    { label: "Negociando", count: negotiatingCount, color: "blue-400", icon: Handshake },
                    { label: "Finalizados", count: itemsCount, color: "primary", icon: CheckCircle2 },
                    { label: "Completados", count: completedCount, color: "green-500", icon: CheckCircle2 },
                    { label: "Total", count: orders.length, color: "primary", icon: ShoppingBag },
                ].map(stat => (
                    <div key={stat.label} className={`bg-${stat.color}/5 border border-${stat.color}/10 rounded-2xl p-5 hover:border-${stat.color}/20 transition-all`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className={`p-2.5 bg-${stat.color}/10 rounded-xl`}>
                                <stat.icon className={`h-4 w-4 text-${stat.color}`} />
                            </div>
                        </div>
                        <div className={`text-3xl font-black text-${stat.color} tracking-tighter`}>{stat.count}</div>
                        <div className="text-gray-600 text-[9px] font-bold uppercase tracking-widest mt-1">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-gray-600 mr-2">
                    <Filter className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Filtrar:</span>
                </div>
                {[
                    { value: "all", label: "Todos" },
                    { value: "pending", label: "Pendientes" },
                    { value: "quoted", label: "Cotizados" },
                    { value: "negotiating", label: "Negociando" },
                    { value: "venta_finalizada", label: "Finalizados" },
                    { value: "completed", label: "Completados" },
                    { value: "cancelled", label: "Cancelados" },
                ].map(f => (
                    <button
                        key={f.value}
                        onClick={() => setStatusFilter(f.value as StatusFilter)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${statusFilter === f.value
                            ? "bg-primary text-black border-primary"
                            : "bg-white/5 text-gray-500 border-white/5 hover:border-white/10"
                            }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Orders — Scannable List */}
            <div className="space-y-2">
                {loading ? (
                    <div className="flex flex-col items-center gap-4 py-20">
                        <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <span className="text-xs font-black uppercase tracking-[0.3em] text-gray-500">{TEXTS.admin.syncingOrders}</span>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="py-32 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2rem] space-y-4 text-center">
                        <ShoppingBag className="h-12 w-12 text-gray-700" />
                        <p className="text-xl font-display font-medium text-gray-500">
                            {statusFilter === "all" ? "No hay pedidos registrados." : `Sin pedidos "${STATUS_OPTIONS.find(s => s.value === statusFilter)?.label}".`}
                        </p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {sortedOrders.map(order => (
                            <OrderCard
                                key={order.id}
                                order={order}
                                context="admin"
                                onClick={() => setSelectedOrder(order)}
                            />
                        ))}
                    </AnimatePresence>
                )}
            </div>

            {/* ====== Admin Order Detail Drawer ====== */}
            {/* Debugging (TAREA 1 - DIRECTIVA 7) */}
            {selectedOrder && (console.log("DEBUG_ORDER:", selectedOrder), null)}

            < OrderDetailsDrawer
                isOpen={!!selectedOrder}
                onClose={() => { setSelectedOrder(null); setActiveDropdown(null); }}
                title={selectedOrder?.order_number || "Detalle de Pedido"}
                footer={
                    selectedOrder && (
                        <div className="space-y-4">
                            {/* Negotiation History Timeline - Hidden on Completion */}
                            {selectedOrder.status !== 'completed' && selectedOrder.status !== 'venta_finalizada' && selectedOrder.negotiationHistory && selectedOrder.negotiationHistory.length > 0 && (
                                <div className="space-y-4 pb-6 border-b border-white/5">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">{TEXTS.admin.timeline}</h4>
                                    <div className="space-y-3">
                                        {selectedOrder.negotiationHistory.map((h, i) => (
                                            <div key={i} className="flex gap-4 items-start relative pb-4 last:pb-0">
                                                {i !== (selectedOrder.negotiationHistory || []).length - 1 && (
                                                    <div className="absolute left-1 top-4 bottom-0 w-px bg-white/5" />
                                                )}
                                                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${h.sender === 'admin' ? 'bg-primary' : 'bg-blue-500'}`} />
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-white">
                                                            {h.sender === 'admin' ? TEXTS.admin.obgLabel : (h.sender === 'user' ? TEXTS.admin.clientLabel : h.sender)}
                                                        </span>
                                                        <span className="text-[9px] text-gray-600 font-mono italic">{formatDate(h.timestamp)}</span>
                                                    </div>
                                                    <p className="text-sm font-black text-white">
                                                        {h.currency === "USD" ? "US$" : "$"} {(h.price || 0).toLocaleString()}
                                                    </p>
                                                    {h.message && <p className="text-[10px] text-gray-500">{h.message}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedOrder.status === 'completed' || selectedOrder.status === 'venta_finalizada' ? (
                                <div className="p-6 bg-primary/10 border border-primary/20 rounded-3xl text-center space-y-2">
                                    <CheckCircle2 className="h-8 w-8 text-primary mx-auto" />
                                    <h5 className="font-black text-white uppercase tracking-tighter text-lg">Trato Cerrado</h5>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">La negociación ha concluido con éxito.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Status Changer */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setActiveDropdown(activeDropdown ? null : selectedOrder.id)}
                                            disabled={updatingId === selectedOrder.id || selectedOrder.status === "venta_finalizada"}
                                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${getStatusConfig(selectedOrder.status).bg
                                                } ${getStatusConfig(selectedOrder.status).color} ${updatingId === selectedOrder.id ? "opacity-50" : ""} ${selectedOrder.status === "venta_finalizada" ? "cursor-not-allowed" : ""
                                                }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                {(() => { const Icon = getStatusConfig(selectedOrder.status).icon; return <Icon className="h-3.5 w-3.5" />; })()}
                                                {updatingId === selectedOrder.id ? "Actualizando..." : getStatusConfig(selectedOrder.status).label}
                                            </span>
                                            {selectedOrder.status !== "venta_finalizada" && <ChevronDown className={`h-3.5 w-3.5 transition-transform ${activeDropdown ? "rotate-180" : ""}`} />}
                                        </button>

                                        <AnimatePresence>
                                            {activeDropdown && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 5 }}
                                                    className="absolute bottom-full mb-2 left-0 right-0 bg-neutral-900 border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl"
                                                >
                                                    {STATUS_OPTIONS.map(option => {
                                                        const OptionIcon = option.icon;
                                                        return (
                                                            <button
                                                                key={option.value}
                                                                onClick={() => handleStatusChange(selectedOrder.id, option.value)}
                                                                className={`w-full flex items-center gap-3 px-5 py-3 transition-all text-left ${selectedOrder.status === option.value ? "bg-white/5" : "hover:bg-white/5"
                                                                    }`}
                                                            >
                                                                <OptionIcon className={`h-4 w-4 ${option.color}`} />
                                                                <span className={`text-xs font-bold ${selectedOrder.status === option.value ? option.color : "text-gray-400"}`}>
                                                                    {option.label}
                                                                </span>
                                                                {selectedOrder.status === option.value && (
                                                                    <CheckCircle2 className="h-3 w-3 text-primary ml-auto" />
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Counter-offer Form (VENDER orders) */}
                                    {(selectedOrder.details?.intent === "VENDER" || selectedOrder.intent === "VENDER" || selectedOrder.adminPrice) && selectedOrder.status !== "venta_finalizada" && (
                                        <div className="space-y-3 pt-2 border-t border-white/5">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-orange-400/70 flex items-center gap-1.5">
                                                <BadgeDollarSign className="h-3.5 w-3.5" />
                                                Definir Precio de Venta/Lote
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={quoteCurrency}
                                                    onChange={e => setQuoteCurrency(e.target.value)}
                                                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-xs font-bold focus:border-orange-400/40 focus:outline-none"
                                                >
                                                    <option value="ARS">ARS $</option>
                                                    <option value="USD">USD US$</option>
                                                </select>
                                                <div className="relative flex-1">
                                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600" />
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        placeholder="Precio contraoferta..."
                                                        value={quotePrice}
                                                        onChange={e => setQuotePrice(e.target.value)}
                                                        className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-9 pr-4 text-white text-sm font-bold focus:border-orange-400/40 focus:outline-none"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => handleSetAdminPrice(selectedOrder)}
                                                    disabled={quotingId === selectedOrder.id || !quotePrice || selectedOrder.adminPrice === parseFloat(quotePrice)}
                                                    className={`px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40 ${selectedOrder.adminPrice && selectedOrder.adminPrice === parseFloat(quotePrice)
                                                        ? "bg-green-600 text-white"
                                                        : "bg-orange-600 text-white hover:bg-orange-500"
                                                        }`}
                                                >
                                                    {selectedOrder.adminPrice && selectedOrder.adminPrice === parseFloat(quotePrice) ? (
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <Send className="h-3.5 w-3.5" />
                                                    )}
                                                </button>
                                                {selectedOrder.adminPrice && selectedOrder.adminPrice === parseFloat(quotePrice) && (
                                                    <span className="absolute -top-6 right-0 text-[8px] font-black text-green-500 uppercase tracking-widest animate-pulse">
                                                        Precio Guardado ✓
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Quote Form (COMPRAR orders without existing quote) */}
                                    {(selectedOrder.details?.intent === "COMPRAR" || (!selectedOrder.details?.intent && !selectedOrder.intent && !selectedOrder.adminPrice)) && !selectedOrder.admin_offer_price && (
                                        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-4">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">{TEXTS.admin.definePrice}</h4>
                                            <div className="flex gap-3">
                                                <div className="relative flex-1">
                                                    <input
                                                        type="number"
                                                        value={quotePrice}
                                                        onChange={(e) => setQuotePrice(e.target.value)}
                                                        placeholder={TEXTS.admin.pricePlaceholder}
                                                        className="w-full bg-white/5 border border-white/5 rounded-xl py-3 pl-4 pr-4 text-white text-sm focus:border-primary/40 focus:outline-none"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => handleSendQuote(selectedOrder)}
                                                    className="bg-primary text-black px-6 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg shadow-primary/10"
                                                >
                                                    {TEXTS.common.save}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* WhatsApp */}
                                    <button
                                        onClick={() => handleWhatsAppContact(selectedOrder)}
                                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-500 hover:text-white transition-all"
                                    >
                                        <MessageCircle className="h-4 w-4" />
                                        Contactar por WhatsApp
                                    </button>
                                </>
                            )}
                        </div>
                    )
                }
            >
                {selectedOrder && (
                    <div className="px-4 py-8">
                        {/* Header — TAREA 2 & 4 */}
                        <div className="flex flex-col gap-1 mb-8">
                            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">ID: {selectedOrder.id}</p>
                            <p className="text-sm text-gray-400 font-bold uppercase">
                                Fecha: {selectedOrder?.createdAt?.seconds
                                    ? new Date(selectedOrder.createdAt.seconds * 1000).toLocaleString('es-AR')
                                    : (selectedOrder?.timestamp?.seconds
                                        ? new Date(selectedOrder.timestamp.seconds * 1000).toLocaleString('es-AR')
                                        : "Cargando...")}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">
                                    {selectedOrder.status}
                                </span>
                            </div>

                            <span className="text-[10px] text-gray-600 uppercase tracking-widest font-bold mt-2">
                                Operación: <span className={selectedOrder.type === 'buy' ? 'text-green-400' : 'text-orange-400'}>
                                    {selectedOrder.type === 'buy' ? 'Compra' : 'Venta'}
                                </span>
                            </span>
                        </div>

                        {/* Item Mapping — TAREA 3 */}
                        <div className="space-y-0 mb-8">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 italic mb-4">Detalle del Lote</h4>

                            {selectedOrder.items && selectedOrder.items.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                                        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">{TEXTS.admin.stats.total}</p>
                                            <p className="text-2xl font-display font-black text-white">{selectedOrder.items.length}</p>
                                        </div>
                                        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">{TEXTS.admin.stats.pending}</p>
                                            <p className="text-2xl font-display font-black text-amber-500">{selectedOrder.items.filter(o => o.status === 'pending').length}</p>
                                        </div>
                                        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">{TEXTS.admin.stats.quoted}</p>
                                            <p className="text-2xl font-display font-black text-blue-400">{selectedOrder.items.filter(o => o.status === 'quoted').length}</p>
                                        </div>
                                        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">{TEXTS.admin.stats.negotiating}</p>
                                            <p className="text-2xl font-display font-black text-indigo-400">{selectedOrder.items.filter(o => o.status === 'negotiating').length}</p>
                                        </div>
                                        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">{TEXTS.admin.stats.finished}</p>
                                            <p className="text-2xl font-display font-black text-primary">{selectedOrder.items.filter(o => o.status === 'venta_finalizada').length}</p>
                                        </div>
                                        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">{TEXTS.admin.stats.completed}</p>
                                            <p className="text-2xl font-display font-black text-gray-500">{selectedOrder.items.filter(o => o.status === 'completed').length}</p>
                                        </div>
                                    </div>
                                    {selectedOrder.items.map((item: any, idx: number) => (
                                        <div key={idx} className="border-b border-white/10 py-5 flex items-center justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-white uppercase text-base leading-tight truncate">{item.title}</h4>
                                                {item.artist && (
                                                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest truncate">{item.artist}</p>
                                                )}
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    <span className="bg-gray-800 text-gray-300 px-2 py-1 text-[9px] font-black uppercase rounded">{item.format}</span>
                                                    <span className="bg-blue-900/30 text-blue-400 px-2 py-1 text-[9px] font-black uppercase rounded border border-blue-500/20">{item.condition}</span>
                                                </div>
                                            </div>
                                            <div className="w-14 h-14 rounded-md overflow-hidden bg-white/5 border border-white/10 flex-shrink-0 shadow-sm">
                                                <img
                                                    src={item.cover_image || item.image || item.thumb || "https://raw.githubusercontent.com/lucianorodriguezproduce/buscadordiscogs2/refs/heads/main/public/obg.png"}
                                                    alt={item.title || "Item"}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </>
                            ) : !selectedOrder.isBatch ? (
                                <div className="border-b border-white/10 py-5 flex flex-col gap-2">
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-white uppercase text-base leading-tight">
                                            {selectedOrder.details?.album}
                                        </h4>
                                        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">
                                            {selectedOrder.details?.artist}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        <span className="bg-gray-800 text-gray-300 px-2 py-1 text-[9px] font-black uppercase rounded">{selectedOrder.details?.format}</span>
                                        <span className="bg-blue-900/30 text-blue-400 px-2 py-1 text-[9px] font-black uppercase rounded border border-blue-500/20">{selectedOrder.details?.condition}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
                                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Sin ítems registrados</p>
                                </div>
                            )}
                        </div>

                        {/* User Offer Highlight */}
                        <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-6 space-y-2 mb-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">Oferta Inicial del Usuario</span>
                            <div className="flex items-center gap-3">
                                <DollarSign className="h-6 w-6 text-orange-500" />
                                <span className="text-4xl font-display font-black text-white">
                                    {selectedOrder.totalPrice
                                        ? `${selectedOrder.currency === 'USD' ? 'US$' : '$'} ${selectedOrder.totalPrice.toLocaleString()}`
                                        : (selectedOrder.details?.price
                                            ? `${selectedOrder.details.currency === 'USD' ? 'US$' : '$'} ${selectedOrder.details.price.toLocaleString()}`
                                            : "Precio no especificado")}
                                </span>
                            </div>
                        </div>

                        {/* User Section */}
                        <div className="flex items-center gap-4 bg-white/[0.03] border border-white/5 rounded-xl p-4 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {selectedOrder.user_photo ? (
                                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-white/5 border border-white/10">
                                        <LazyImage
                                            src={selectedOrder.user_photo}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <UserIcon className="h-5 w-5 text-primary" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="text-white text-sm font-bold truncate">{selectedOrder.user_name}</p>
                                <p className="text-gray-600 text-xs truncate">{selectedOrder.user_email}</p>
                            </div>
                        </div>
                    </div>
                )}
            </OrderDetailsDrawer>

            {/* Deal Closure Celebration Overlay */}
            <AnimatePresence>
                {showCelebration && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[2000] flex items-center justify-center pointer-events-none"
                    >
                        <motion.div
                            initial={{ scale: 0.5, rotate: -20, y: 50 }}
                            animate={{ scale: 1.2, rotate: 0, y: 0 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="bg-black/80 backdrop-blur-xl border-4 border-primary p-12 rounded-[3rem] shadow-[0_0_100px_rgba(255,215,0,0.3)] flex flex-col items-center gap-6"
                        >
                            <motion.div
                                animate={{
                                    scale: [1, 1.2, 1],
                                    rotate: [0, 10, -10, 0]
                                }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="w-24 h-24 bg-primary rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,215,0,0.5)]"
                            >
                                <CheckCircle2 className="h-16 w-16 text-black stroke-[3]" />
                            </motion.div>
                            <div className="text-center">
                                <h2 className="text-3xl font-display font-black text-white uppercase tracking-tighter">¡Trato Cerrado!</h2>
                                <p className="text-primary font-black uppercase tracking-widest text-xs mt-2">Venta confirmada por el cliente</p>
                            </div>

                            {/* Visual Sparkles */}
                            {[...Array(8)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    className="absolute w-2 h-2 bg-primary rounded-full"
                                    animate={{
                                        x: [0, (i % 2 ? 100 : -100) * Math.random()],
                                        y: [0, (i < 4 ? 100 : -100) * Math.random()],
                                        opacity: [1, 0],
                                        scale: [1, 0]
                                    }}
                                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
                                />
                            ))}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
