import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/lib/firebase";
import {
    collection,
    onSnapshot,
    query,
    orderBy,
    doc,
    updateDoc,
    addDoc,
    serverTimestamp
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
    Hash
} from "lucide-react";

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
    market_reference?: number | null;
    admin_offer_price?: number;
    admin_offer_currency?: string;
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
}

type StatusFilter = "all" | "pending" | "negotiating" | "completed" | "cancelled" | "quoted";

const STATUS_OPTIONS = [
    { value: "pending", label: "Pendiente", icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20" },
    { value: "quoted", label: "Cotizado", icon: BadgeDollarSign, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
    { value: "negotiating", label: "En Negociación", icon: Handshake, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    { value: "completed", label: "Completado", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10 border-green-500/20" },
    { value: "cancelled", label: "Cancelado", icon: XCircle, color: "text-red-500", bg: "bg-red-500/10 border-red-500/20" },
];

export default function AdminOrders() {
    const [orders, setOrders] = useState<OrderDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // Quote form state (keyed by order ID)
    const [quotePrice, setQuotePrice] = useState<Record<string, string>>({});
    const [quoteCurrency, setQuoteCurrency] = useState<Record<string, string>>({});
    const [quotingId, setQuotingId] = useState<string | null>(null);

    useEffect(() => {
        const q = query(collection(db, "orders"), orderBy("timestamp", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            const docs = snap.docs.map(d => ({
                id: d.id,
                user_email: "Sin email",
                user_name: "Usuario Registrado",
                user_photo: "",
                ...d.data()
            } as OrderDoc));
            setOrders(docs);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleStatusChange = async (orderId: string, newStatus: string) => {
        setUpdatingId(orderId);
        try {
            await updateDoc(doc(db, "orders", orderId), { status: newStatus });
            const order = orders.find(o => o.id === orderId);
            if (order) {
                const statusLabel = STATUS_OPTIONS.find(s => s.value === newStatus)?.label || newStatus;
                const itemTitle = `${order.details.artist} - ${order.details.album}`;
                await addDoc(collection(db, "notifications"), {
                    user_id: order.user_id,
                    title: "Actualización de Pedido",
                    message: `Tu pedido de ${itemTitle} ha cambiado a: ${statusLabel}`,
                    read: false,
                    timestamp: serverTimestamp(),
                    order_id: order.id
                });
            }
        } catch (error) {
            console.error("Error updating order status:", error);
        } finally {
            setUpdatingId(null);
            setActiveDropdown(null);
        }
    };

    const handleSendQuote = async (order: OrderDoc) => {
        const priceVal = parseFloat(quotePrice[order.id] || "0");
        const currencyVal = quoteCurrency[order.id] || "ARS";
        if (!priceVal || priceVal <= 0) return;

        setQuotingId(order.id);
        try {
            await updateDoc(doc(db, "orders", order.id), {
                admin_offer_price: priceVal,
                admin_offer_currency: currencyVal,
                status: "quoted"
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

            // Clear the form
            setQuotePrice(prev => ({ ...prev, [order.id]: "" }));
        } catch (error) {
            console.error("Error sending quote:", error);
        } finally {
            setQuotingId(null);
        }
    };

    const handleWhatsAppContact = (order: OrderDoc) => {
        const name = order.user_name || "Cliente";
        const item = `${order.details.artist} - ${order.details.album}`;
        const intent = order.details.intent === "COMPRAR" ? "comprar" : "vender";
        const priceText = order.details.price
            ? ` por ${order.details.currency === "USD" ? "US$" : "$"}${order.details.price.toLocaleString()}`
            : "";
        const message = encodeURIComponent(
            `Hola ${name}! Te contactamos desde Oldie but Goldie por tu pedido de ${intent}: ${item}${priceText}. ¿Seguimos coordinando?`
        );
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

    const pendingCount = orders.filter(o => o.status === "pending").length;
    const negotiatingCount = orders.filter(o => o.status === "negotiating").length;
    const completedCount = orders.filter(o => o.status === "completed").length;
    const quotedCount = orders.filter(o => o.status === "quoted").length;

    return (
        <div className="space-y-10">
            <header>
                <h1 className="text-5xl font-display font-black text-white tracking-tightest">
                    Gestión de <span className="text-primary">Pedidos</span>
                </h1>
                <p className="text-gray-500 mt-2 font-medium">
                    Panel de control para administrar todas las intenciones de compra y venta.
                </p>
            </header>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-2xl p-5 hover:border-yellow-500/20 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 bg-yellow-500/10 rounded-xl"><Clock className="h-4 w-4 text-yellow-500" /></div>
                    </div>
                    <div className="text-3xl font-black text-yellow-500 tracking-tighter">{pendingCount}</div>
                    <div className="text-gray-600 text-[9px] font-bold uppercase tracking-widest mt-1">Pendientes</div>
                </div>
                <div className="bg-purple-500/5 border border-purple-500/10 rounded-2xl p-5 hover:border-purple-500/20 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 bg-purple-500/10 rounded-xl"><BadgeDollarSign className="h-4 w-4 text-purple-400" /></div>
                    </div>
                    <div className="text-3xl font-black text-purple-400 tracking-tighter">{quotedCount}</div>
                    <div className="text-gray-600 text-[9px] font-bold uppercase tracking-widest mt-1">Cotizados</div>
                </div>
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-5 hover:border-blue-500/20 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 bg-blue-500/10 rounded-xl"><Handshake className="h-4 w-4 text-blue-400" /></div>
                    </div>
                    <div className="text-3xl font-black text-blue-400 tracking-tighter">{negotiatingCount}</div>
                    <div className="text-gray-600 text-[9px] font-bold uppercase tracking-widest mt-1">Negociando</div>
                </div>
                <div className="bg-green-500/5 border border-green-500/10 rounded-2xl p-5 hover:border-green-500/20 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 bg-green-500/10 rounded-xl"><CheckCircle2 className="h-4 w-4 text-green-500" /></div>
                    </div>
                    <div className="text-3xl font-black text-green-500 tracking-tighter">{completedCount}</div>
                    <div className="text-gray-600 text-[9px] font-bold uppercase tracking-widest mt-1">Completados</div>
                </div>
                <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 hover:border-primary/20 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 bg-primary/10 rounded-xl"><ShoppingBag className="h-4 w-4 text-primary" /></div>
                    </div>
                    <div className="text-3xl font-black text-primary tracking-tighter">{orders.length}</div>
                    <div className="text-gray-600 text-[9px] font-bold uppercase tracking-widest mt-1">Total</div>
                </div>
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
                        {f.value !== "all" && (
                            <span className="ml-2 opacity-60">
                                ({orders.filter(o => f.value === "all" || o.status === f.value).length})
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Orders List */}
            <div className="space-y-4">
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 h-28 animate-pulse" />
                    ))
                ) : filteredOrders.length === 0 ? (
                    <div className="py-32 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2rem] space-y-4 text-center">
                        <ShoppingBag className="h-12 w-12 text-gray-700" />
                        <p className="text-xl font-display font-medium text-gray-500">
                            {statusFilter === "all" ? "No hay pedidos registrados." : `No hay pedidos con estado "${STATUS_OPTIONS.find(s => s.value === statusFilter)?.label}".`}
                        </p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {filteredOrders.map((order, i) => {
                            const statusConfig = getStatusConfig(order.status);
                            const StatusIcon = statusConfig.icon;

                            return (
                                <motion.div
                                    key={order.id}
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ delay: i * 0.03 }}
                                    className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-all group"
                                >
                                    {/* Main Row */}
                                    <div className="p-6 md:p-8 flex flex-col lg:flex-row items-start lg:items-center gap-6">
                                        {/* Cover Image */}
                                        {order.details.cover_image ? (
                                            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/5 flex-shrink-0 border border-white/10 group-hover:border-primary/30 transition-all">
                                                <img src={order.details.cover_image} alt="" className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="w-20 h-20 rounded-2xl bg-white/5 flex-shrink-0 border border-white/10 flex items-center justify-center">
                                                <Music className="h-8 w-8 text-gray-700" />
                                            </div>
                                        )}

                                        {/* Item Info */}
                                        <div className="flex-1 min-w-0 space-y-2">
                                            {/* Order Number */}
                                            {order.order_number && (
                                                <span className="inline-flex items-center gap-1.5 text-[9px] font-mono font-bold text-gray-600 uppercase tracking-wider">
                                                    <Hash className="h-3 w-3" />
                                                    {order.order_number}
                                                </span>
                                            )}
                                            <div className="flex flex-wrap items-center gap-3">
                                                <h3 className="text-lg font-display font-black text-white uppercase tracking-tight truncate">
                                                    {order.details.artist} — {order.details.album}
                                                </h3>
                                                <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${order.details.intent === "COMPRAR"
                                                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                                                        : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                                    }`}>
                                                    {order.details.intent}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                                <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> {order.details.format}</span>
                                                <span>{order.details.condition}</span>
                                                {order.details.price && (
                                                    <span className="text-primary font-black text-xs normal-case">
                                                        {order.details.currency === "USD" ? "US$" : "$"}{order.details.price.toLocaleString()}
                                                    </span>
                                                )}
                                                {order.details.intent === "VENDER" && order.market_reference && (
                                                    <span className="flex items-center gap-1 text-yellow-500/70 font-mono text-[10px] normal-case">
                                                        <TrendingUp className="h-3 w-3" />
                                                        Ref: US${order.market_reference.toFixed(2)}
                                                    </span>
                                                )}
                                                {order.admin_offer_price && (
                                                    <span className="flex items-center gap-1 text-purple-400 font-black text-xs normal-case">
                                                        <BadgeDollarSign className="h-3.5 w-3.5" />
                                                        Cotizado: {order.admin_offer_currency === "USD" ? "US$" : "$"}{order.admin_offer_price.toLocaleString()}
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1 text-gray-700">
                                                    <Clock className="h-3 w-3" /> {formatDate(order.timestamp)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* User Info */}
                                        <div className="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 flex-shrink-0">
                                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
                                                {order.user_photo ? (
                                                    <img src={order.user_photo} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <UserIcon className="h-4 w-4 text-primary" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-white text-xs font-bold truncate max-w-[140px]">{order.user_name}</p>
                                                <p className="text-gray-600 text-[9px] truncate max-w-[140px]">{order.user_email}</p>
                                            </div>
                                        </div>

                                        {/* Status Dropdown */}
                                        <div className="relative flex-shrink-0">
                                            <button
                                                onClick={() => setActiveDropdown(activeDropdown === order.id ? null : order.id)}
                                                disabled={updatingId === order.id}
                                                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${statusConfig.bg} ${statusConfig.color} ${updatingId === order.id ? "opacity-50" : "hover:scale-105"
                                                    }`}
                                            >
                                                <StatusIcon className="h-3.5 w-3.5" />
                                                {updatingId === order.id ? "..." : statusConfig.label}
                                                <ChevronDown className={`h-3 w-3 transition-transform ${activeDropdown === order.id ? "rotate-180" : ""}`} />
                                            </button>

                                            <AnimatePresence>
                                                {activeDropdown === order.id && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -5, scale: 0.95 }}
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        exit={{ opacity: 0, y: -5, scale: 0.95 }}
                                                        className="absolute right-0 top-full mt-2 bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl min-w-[200px]"
                                                    >
                                                        {STATUS_OPTIONS.map(option => {
                                                            const OptionIcon = option.icon;
                                                            return (
                                                                <button
                                                                    key={option.value}
                                                                    onClick={() => handleStatusChange(order.id, option.value)}
                                                                    className={`w-full flex items-center gap-3 px-5 py-3.5 transition-all text-left ${order.status === option.value ? "bg-white/5" : "hover:bg-white/5"
                                                                        }`}
                                                                >
                                                                    <OptionIcon className={`h-4 w-4 ${option.color}`} />
                                                                    <span className={`text-xs font-bold ${order.status === option.value ? option.color : "text-gray-400"}`}>
                                                                        {option.label}
                                                                    </span>
                                                                    {order.status === option.value && (
                                                                        <CheckCircle2 className="h-3 w-3 text-primary ml-auto" />
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        {/* WhatsApp Contact */}
                                        <button
                                            onClick={() => handleWhatsAppContact(order)}
                                            className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl hover:bg-green-500 hover:text-white hover:scale-105 transition-all flex-shrink-0"
                                            title="Contactar por WhatsApp"
                                        >
                                            <MessageCircle className="h-5 w-5" />
                                        </button>
                                    </div>

                                    {/* Quote Form — only for COMPRAR orders without an existing quote */}
                                    {order.details.intent === "COMPRAR" && !order.admin_offer_price && (
                                        <div className="px-6 md:px-8 pb-6 pt-2 border-t border-white/[0.03]">
                                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-purple-400/70 flex items-center gap-1.5 flex-shrink-0">
                                                    <BadgeDollarSign className="h-3.5 w-3.5" />
                                                    Cotizar:
                                                </span>
                                                <select
                                                    value={quoteCurrency[order.id] || "ARS"}
                                                    onChange={e => setQuoteCurrency(prev => ({ ...prev, [order.id]: e.target.value }))}
                                                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-xs font-bold focus:border-purple-400/40 focus:outline-none"
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
                                                        placeholder="Precio..."
                                                        value={quotePrice[order.id] || ""}
                                                        onChange={e => setQuotePrice(prev => ({ ...prev, [order.id]: e.target.value }))}
                                                        className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-9 pr-4 text-white text-sm font-bold focus:border-purple-400/40 focus:outline-none"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => handleSendQuote(order)}
                                                    disabled={quotingId === order.id || !quotePrice[order.id]}
                                                    className="flex items-center gap-2 px-5 py-2.5 bg-purple-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-purple-400 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100"
                                                >
                                                    <Send className="h-3.5 w-3.5" />
                                                    {quotingId === order.id ? "..." : "Enviar"}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>

            {activeDropdown && (
                <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
            )}
        </div>
    );
}
