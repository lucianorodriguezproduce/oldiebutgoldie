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
    PieChart,
    Handshake,
    CheckCircle2,
    X,
    FileText,
    Download
} from "lucide-react";
import { db } from "@/lib/firebase";
import { formatDate, getReadableDate } from "@/utils/date";
import { collection, onSnapshot, query, orderBy, where, doc, deleteDoc, updateDoc, addDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { useState, useEffect } from "react";
import { AlbumCardSkeleton } from "@/components/ui/Skeleton";
import { Link, useSearchParams } from "react-router-dom";
import OrderDetailsDrawer from "@/components/OrderDetailsDrawer";
import { generateWhatsAppLink } from '@/utils/whatsapp';
import type { OrderData } from '@/utils/whatsapp';
import OrderCard from '@/components/OrderCard';
import { pushWhatsAppContactFromOrder } from "@/utils/analytics";
import NegotiationBanner from "@/components/NegotiationBanner";
import { LazyImage } from "@/components/ui/LazyImage";

interface ProfileItem {
    id: string;
    title: string;
    cover_image: string;
    artist?: string;
    addedAt: string;
}

interface OrderItem {
    id: string;
    item_id: number;
    user_id: string;
    order_number?: string;
    status: string;
    timestamp: any;
    createdAt?: any;
    admin_offer_price?: number;
    admin_offer_currency?: string;
    adminPrice?: number;
    adminCurrency?: string;
    negotiationHistory?: {
        price: number;
        currency: string;
        sender: 'admin' | 'user';
        timestamp: any;
        message?: string;
    }[];
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
    totalPrice?: number;
    currency?: string;
    type?: 'buy' | 'sell';
}

export default function Profile() {
    const { user, isAdmin } = useAuth();
    const { showLoading, hideLoading, isLoading } = useLoading();
    const [activeTab, setActiveTab] = useState<"overview" | "orders" | "wantlist">("overview");

    // Firestore Data State
    const [collectionItems, setCollectionItems] = useState<ProfileItem[]>([]);
    const [wantlistItems, setWantlistItems] = useState<ProfileItem[]>([]);
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();

    // Negotiation State
    const [counterOfferPrice, setCounterOfferPrice] = useState("");
    const [isNegotiating, setIsNegotiating] = useState(false);
    const [showCounterInput, setShowCounterInput] = useState(false);

    const handleAcceptOffer = async () => {
        if (!selectedOrder || isLoading) return;
        showLoading("Aceptando propuesta...");
        try {
            const orderRef = doc(db, "orders", selectedOrder.id);
            await updateDoc(orderRef, {
                status: "venta_finalizada",
                acceptedAt: serverTimestamp()
            });
            // Update local state to reflect change immediately
            setSelectedOrder({ ...selectedOrder, status: "venta_finalizada" });
            alert("¡Propuesta aceptada! La venta se ha finalizado.");
        } catch (error) {
            console.error("Error accepting offer:", error);
            alert("Hubo un error al aceptar la propuesta.");
        } finally {
            hideLoading();
        }
    };

    const handleRejectOffer = async () => {
        if (!selectedOrder || isLoading) return;
        if (!confirm("¿Estás seguro de que quieres rechazar esta propuesta?")) return;

        showLoading("Procesando...");
        try {
            const orderRef = doc(db, "orders", selectedOrder.id);
            await updateDoc(orderRef, {
                status: "negotiating", // Revert to negotiation if rejected
                rejectedAt: serverTimestamp()
            });
            setSelectedOrder({ ...selectedOrder, status: "negotiating" });
        } catch (error) {
            console.error("Error rejecting offer:", error);
        } finally {
            hideLoading();
        }
    };

    // Deep-link: auto-open drawer if ?order=ORDER_ID is in the URL
    useEffect(() => {
        const orderId = searchParams.get("order");
        if (orderId && orderItems.length > 0 && !ordersLoading) {
            const found = orderItems.find(o => o.id === orderId);
            if (found) {
                setSelectedOrder(found);
                setActiveTab("orders");
            }
            // Clean URL to prevent re-triggering
            setSearchParams({}, { replace: true });
        }
    }, [orderItems, ordersLoading, searchParams]);

    // Keep selectedOrder in sync with live data
    useEffect(() => {
        if (selectedOrder) {
            const latest = orderItems.find(o => o.id === selectedOrder.id);
            if (latest && JSON.stringify(latest) !== JSON.stringify(selectedOrder)) {
                setSelectedOrder(latest);
            }
        }
    }, [orderItems, selectedOrder?.id]);

    useEffect(() => {
        if (!user) return;

        showLoading("Sincronizando Perfil de Coleccionista...");

        // Fetch Collection
        const qArchive = query(
            collection(db, "users", user.uid, "collection"),
            orderBy("addedAt", "desc")
        );
        const unsubArchive = onSnapshot(qArchive, (snap) => {
            setCollectionItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProfileItem)));
        });

        // Fetch Wantlist
        const qWantlist = query(
            collection(db, "users", user.uid, "wantlist"),
            orderBy("addedAt", "desc")
        );
        const unsubWantlist = onSnapshot(qWantlist, (snap) => {
            setWantlistItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProfileItem)));
            setLoading(false);
        }, (err) => {
            console.error("Wantlist snapshot error:", err);
            setLoading(false);
        });

        // Fetch Orders (from the global orders collection, filtered by user_id)
        const qOrders = query(
            collection(db, "orders"),
            where("user_id", "==", user.uid),
            orderBy("timestamp", "desc")
        );
        const unsubOrders = onSnapshot(qOrders, (snap) => {
            setOrderItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as OrderItem)));
            setOrdersLoading(false);
        }, (err) => {
            console.error("Orders snapshot error:", err);
            setOrdersLoading(false);
        });

        return () => {
            unsubArchive();
            unsubWantlist();
            unsubOrders();
        };
    }, [user]);

    // Unified Global Loader Management for Profile fetching
    useEffect(() => {
        if (!loading && !ordersLoading) {
            hideLoading();
        }
    }, [loading, ordersLoading]);

    const removeItem = async (type: "collection" | "wantlist", id: string) => {
        if (!user) return;
        await deleteDoc(doc(db, "users", user.uid, type, id));
    };

    const handleAcceptProposal = async (order: OrderItem) => {
        if (!user) return;
        showLoading("Confirmando trato...");
        setIsNegotiating(true);
        try {
            await updateDoc(doc(db, "orders", order.id), {
                status: "venta_finalizada"
            });

            // Notify Admin
            await addDoc(collection(db, "notifications"), {
                user_id: "admin", // Special flag for administrative notifications
                title: "Venta Finalizada 🎉",
                message: `${user.displayName || 'Un cliente'} ha ACEPTADO el trato por el pedido ${order.order_number || order.id}.`,
                read: false,
                timestamp: serverTimestamp(),
                order_id: order.id
            });

            setSelectedOrder(prev => prev ? { ...prev, status: "venta_finalizada" } : null);
            alert("¡Felicidades! Has finalizado la venta. Coordina el pago por WhatsApp.");
        } catch (error) {
            console.error("Error accepting proposal:", error);
            alert("Hubo un error al procesar la aceptación.");
        } finally {
            setIsNegotiating(false);
            hideLoading();
        }
    };

    const handleCounterOffer = async (order: OrderItem) => {
        const priceVal = parseFloat(counterOfferPrice);
        if (isNaN(priceVal) || priceVal <= 0) return;

        showLoading("Enviando contraoferta...");
        setIsNegotiating(true);
        try {
            await updateDoc(doc(db, "orders", order.id), {
                totalPrice: priceVal,
                status: "contraoferta_usuario",
                negotiationHistory: arrayUnion({
                    price: priceVal,
                    currency: order.currency || order.details?.currency || "ARS",
                    sender: 'user',
                    timestamp: new Date()
                })
            });

            // Notify Admin
            await addDoc(collection(db, "notifications"), {
                user_id: "admin",
                title: "Nueva Contraoferta del Usuario",
                message: `${user?.displayName || 'Cliente'} propone ${order.currency || '$'} ${priceVal.toLocaleString()} por el pedido ${order.order_number || order.id}.`,
                read: false,
                timestamp: serverTimestamp(),
                order_id: order.id
            });

            setSelectedOrder(prev => prev ? { ...prev, totalPrice: priceVal, status: "contraoferta_usuario" } : null);
            setCounterOfferPrice("");
            setShowCounterInput(false);
            alert("Has enviado una contraoferta. Espera la respuesta de Oldie but Goldie.");
        } catch (error) {
            console.error("Error sending counter-offer:", error);
            alert("Hubo un error al enviar la contraoferta.");
        } finally {
            setIsNegotiating(false);
            hideLoading();
        }
    };

    const downloadReceipt = (order: OrderItem) => {
        const content = `
          OLDIE BUT GOLDIE - COMPROBANTE DE TRATO
          =======================================
          ORDEN ID: ${order.order_number || order.id}
          FECHA: ${formatDate(order.createdAt || order.timestamp)}
          CLIENTE: ${user?.displayName || user?.email}
          
          ITEMS:
          ${order.items?.map(i => `- ${i.title} (${i.format})`).join('\n          ')}
          
          PRECIO FINAL: ${order.currency === 'USD' ? 'US$' : '$'} ${(order.totalPrice || order.adminPrice || 0).toLocaleString()}
          ESTADO: VENTA FINALIZADA
          =======================================
          Gracias por confiar en Oldie but Goldie.
        `.trim();

        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Comprobante_${order.order_number || order.id}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (!user && !isAdmin) return null;

    const displayName = user?.displayName || (isAdmin ? "Master Admin" : "Sonic Collector");
    const photoURL = user?.photoURL;

    const stats = [
        { label: "Pedidos", value: (orderItems || []).length.toString(), icon: ShoppingBag, color: "text-primary" },
        { label: "Deseados", value: (wantlistItems || []).length.toString(), icon: Heart, color: "text-red-500" },
        { label: "Nivel", value: "Elite", icon: Award, color: "text-yellow-500" },
    ];

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
            pending: { label: "Pendiente", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
            quoted: { label: "Cotizado", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
            negotiating: { label: "En Negociación", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
            pending_acceptance: { label: "Esperando tu ok", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
            confirmed: { label: "Confirmado", color: "bg-primary/10 text-primary border-primary/20" },
            completed: { label: "Completado", color: "bg-green-500/10 text-green-500 border-green-500/20" },
            cancelled: { label: "Cancelado", color: "bg-red-500/10 text-red-500 border-red-500/20" },
        };
        const s = map[status] || map.pending;
        return <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${s.color}`}>{s.label}</span>;
    };

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

            {/* Navigation Tabs */}
            <div className="flex items-center justify-center md:justify-start gap-12 border-b border-white/5 pb-0">
                {[
                    { id: "overview", label: "General", icon: Zap },
                    { id: "orders", label: "Pedidos", icon: ShoppingBag },
                    { id: "wantlist", label: "Deseados", icon: Heart },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest pb-6 transition-all relative ${activeTab === tab.id ? "text-primary" : "text-gray-500 hover:text-white"
                            }`}
                    >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                        {activeTab === tab.id && (
                            <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                        )}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === "overview" && (
                        <div className="space-y-12">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {stats.map((stat) => (
                                    <Card key={stat.label} className="bg-white/[0.03] border-white/5 backdrop-blur-3xl rounded-[2.5rem] p-10 hover:border-white/10 transition-all group">
                                        <div className="flex items-center justify-between mb-8">
                                            <div className="p-4 bg-white/5 rounded-2xl group-hover:bg-primary/20 transition-colors">
                                                <stat.icon className={`h-6 w-6 ${stat.color}`} />
                                            </div>
                                            <TrendingUp className="h-5 w-5 text-gray-700 group-hover:text-primary transition-colors" />
                                        </div>
                                        <div className="text-5xl font-black text-white tracking-tighter mb-2">{stat.value}</div>
                                        <div className="text-gray-500 text-xs font-black uppercase tracking-widest">{stat.label}</div>
                                    </Card>
                                ))}
                            </div>

                            {/* Recent Orders in Overview */}
                            <div className="space-y-10">
                                <h3 className="text-2xl font-display font-black text-white uppercase tracking-widest">Pedidos <span className="text-primary">Recientes</span></h3>
                                {ordersLoading ? (
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                        {Array.from({ length: 6 }).map((_, i) => <AlbumCardSkeleton key={i} />)}
                                    </div>
                                ) : (orderItems || []).length === 0 ? (
                                    <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[3rem] space-y-6 text-center">
                                        <ShoppingBag className="h-12 w-12 text-gray-700" />
                                        <div className="space-y-2">
                                            <p className="text-xl font-display font-medium text-gray-500">No tienes pedidos aún.</p>
                                            <Link to="/" className="text-primary font-black uppercase tracking-widest text-[10px] hover:underline underline-offset-8">Buscar tu primer disco</Link>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {(orderItems || []).slice(0, 5).map((order, i) => (
                                            <motion.div
                                                key={order.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                            >
                                                <OrderCard
                                                    order={order}
                                                    context="profile"
                                                    onClick={() => setSelectedOrder(order)}
                                                />
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === "orders" && (
                        <div className="space-y-10">
                            <div className="flex items-end justify-between">
                                <div>
                                    <h2 className="text-4xl font-display font-black text-white tracking-tightest leading-none">
                                        Mis <span className="text-primary">Pedidos</span>
                                    </h2>
                                    <p className="text-gray-500 mt-4 text-lg font-medium">
                                        Historial de intenciones de compra y venta registradas.
                                    </p>
                                </div>
                            </div>

                            {ordersLoading ? (
                                <div className="space-y-4">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div key={i} className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 h-32 animate-pulse" />
                                    ))}
                                </div>
                            ) : (orderItems || []).length === 0 ? (
                                <div className="col-span-full py-40 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[3rem] space-y-6 text-center">
                                    <ShoppingBag className="h-12 w-12 text-gray-700" />
                                    <div className="space-y-2">
                                        <p className="text-xl font-display font-medium text-gray-500">No se detectaron pedidos en este sector.</p>
                                        <Link to="/" className="text-primary font-black uppercase tracking-widest text-[10px] hover:underline underline-offset-8">Iniciar Búsqueda de Disco</Link>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    {(orderItems || []).map((order, i) => (
                                        <motion.div
                                            key={order.id}
                                            initial={{ opacity: 0, y: 15 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.04 }}
                                            className="mb-4"
                                        >
                                            <OrderCard
                                                order={order}
                                                context="profile"
                                                onClick={() => setSelectedOrder(order)}
                                            />
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "wantlist" && (
                        <div className="space-y-10">
                            <div className="flex items-end justify-between">
                                <div>
                                    <h2 className="text-4xl font-display font-black text-white tracking-tightest leading-none">
                                        Lista de <span className="text-primary">Deseados</span>
                                    </h2>
                                    <p className="text-gray-500 mt-4 text-lg font-medium">
                                        Siguiendo adquisiciones de alto valor.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
                                {loading ? (
                                    Array.from({ length: 12 }).map((_, i) => <AlbumCardSkeleton key={i} />)
                                ) : wantlistItems.length === 0 ? (
                                    <div className="col-span-full py-40 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[3rem] space-y-6 text-center">
                                        <Search className="h-12 w-12 text-gray-700" />
                                        <div className="space-y-2">
                                            <p className="text-xl font-display font-medium text-gray-500">No se detectaron entradas en este sector.</p>
                                            <Link to="/" className="text-primary font-black uppercase tracking-widest text-[10px] hover:underline underline-offset-8">Iniciar Descubrimiento de Datos</Link>
                                        </div>
                                    </div>
                                ) : (
                                    wantlistItems.map((item, i) => (
                                        <motion.div
                                            key={item.id}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="group relative"
                                        >
                                            <Link to={`/album/${item.id}`} className="block">
                                                <div className="aspect-square rounded-[2rem] overflow-hidden mb-4 relative ring-1 ring-white/10 group-hover:ring-primary/40 transition-all duration-700 shadow-2xl">
                                                    <img src={item.cover_image} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 grayscale-[0.3] group-hover:grayscale-0" loading="lazy" />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                                                        <span className="text-[9px] font-black text-primary uppercase tracking-widest mb-auto">ID: {item.id}</span>
                                                    </div>
                                                </div>
                                                <h3 className="text-white font-bold text-xs truncate group-hover:text-primary transition-colors">{item.title}</h3>
                                            </Link>
                                            <button
                                                onClick={() => removeItem("wantlist", item.id)}
                                                className="absolute top-4 right-4 p-2 bg-red-500/10 text-red-500 rounded-xl opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all border border-red-500/20 backdrop-blur-xl"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Order Details Drawer */}
            <OrderDetailsDrawer
                isOpen={!!selectedOrder}
                onClose={() => setSelectedOrder(null)}
                title={selectedOrder?.order_number || "Detalle de Pedido"}
                footer={
                    selectedOrder && (
                        <div className="space-y-4">
                            {/* Negotiation History Visualization (User Side) */}
                            {selectedOrder.negotiationHistory && selectedOrder.negotiationHistory.length > 0 && (
                                <div className="space-y-3 pb-4 border-b border-white/5">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
                                        <Clock className="h-3 w-3" /> Historial de Negociación
                                    </span>
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                        {selectedOrder.negotiationHistory.map((h, i) => (
                                            <div key={i} className={`p-2.5 rounded-xl border flex items-center justify-between ${h.sender === 'user'
                                                    ? "bg-orange-500/5 border-orange-500/20"
                                                    : "bg-primary/5 border-primary/20"
                                                }`}>
                                                <div className="flex flex-col">
                                                    <span className={`text-[8px] font-black uppercase tracking-tighter ${h.sender === 'user' ? "text-orange-400" : "text-primary"
                                                        }`}>
                                                        {h.sender === 'user' ? "Tú (Cliente)" : "Oldie but Goldie"}
                                                    </span>
                                                    <span className="text-xs font-black text-white">
                                                        {h.currency === "USD" ? "US$" : "$"} {h.price.toLocaleString()}
                                                    </span>
                                                </div>
                                                <span className="text-[8px] text-gray-600 font-mono">
                                                    {h.timestamp?.seconds
                                                        ? new Date(h.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                        : "Reciente"}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedOrder.status === "venta_finalizada" ? (
                                <div className="space-y-6">
                                    <div id="printable-receipt" className="bg-green-500/10 border border-green-500/20 rounded-[2rem] p-8 space-y-6 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-8 opacity-5">
                                            <FileText size={120} />
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-green-500/20 rounded-full">
                                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                </div>
                                                <h3 className="text-xl font-display font-black text-white uppercase tracking-tighter">Trato Confirmado</h3>
                                            </div>
                                            <p className="text-xs text-gray-500 font-medium">Este documento certifica el acuerdo mutuo de precio y condiciones.</p>
                                        </div>

                                        <div className="border-t border-white/5 pt-6 space-y-4">
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                                <span className="text-gray-500">Precio Acordado</span>
                                                <span className="text-primary text-base">
                                                    {selectedOrder.currency === 'USD' ? 'US$' : '$'} {(selectedOrder.totalPrice || selectedOrder.adminPrice || 0).toLocaleString()}
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
                                                    const msg = encodeURIComponent(`Hola! Acepté el trato por el lote ${selectedOrder.order_number || selectedOrder.id}. Coordinemos el pago y el envío.`);
                                                    window.open(`https://wa.me/5491140411796?text=${msg}`, "_blank");
                                                }}
                                                className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-green-500/20"
                                            >
                                                <MessageCircle className="h-4 w-4" />
                                                Coordinar por WhatsApp
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
                                    {(selectedOrder.adminPrice || selectedOrder.admin_offer_price) && (
                                        <div className="flex flex-col gap-4">
                                            {/* User's Current Offer / Value */}
                                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <DollarSign className="h-3.5 w-3.5 text-gray-500" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Tu oferta actual</span>
                                                </div>
                                                <p className="text-xl font-bold text-gray-400">
                                                    {selectedOrder.currency === "USD" ? "US$" : "$"} {(selectedOrder.totalPrice || selectedOrder.details.price || 0).toLocaleString()}
                                                </p>
                                            </div>

                                            {/* Admin Counter-Offer */}
                                            {(selectedOrder.adminPrice || selectedOrder.admin_offer_price) && (
                                                <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <BadgeDollarSign className="h-4 w-4 text-primary" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Oldie but Goldie te ofrece</span>
                                                    </div>
                                                    <p className="text-3xl font-display font-black text-white tracking-tight">
                                                        {(selectedOrder.adminCurrency || selectedOrder.admin_offer_currency) === "USD" ? "US$" : "$"} {(selectedOrder.adminPrice || selectedOrder.admin_offer_price || 0).toLocaleString()}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Negotiation Buttons (if there's an offer to respond to) */}
                                            {(selectedOrder.adminPrice || selectedOrder.admin_offer_price) && selectedOrder.status !== "contraoferta_usuario" && (
                                                <div className="space-y-3">
                                                    {!showCounterInput ? (
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <button
                                                                onClick={() => handleAcceptProposal(selectedOrder)}
                                                                disabled={isNegotiating}
                                                                className="flex items-center justify-center gap-2 px-4 py-4 bg-primary text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50"
                                                            >
                                                                <CheckCircle2 className="h-4 w-4" /> Aceptar
                                                            </button>
                                                            <button
                                                                onClick={() => setShowCounterInput(true)}
                                                                disabled={isNegotiating}
                                                                className="flex items-center justify-center gap-2 px-4 py-4 bg-white/5 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-50"
                                                            >
                                                                <Handshake className="h-4 w-4" /> Contraoferta
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            className="bg-neutral-900 border border-white/10 p-4 rounded-2xl space-y-3 shadow-2xl"
                                                        >
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
                                                                <button
                                                                    onClick={() => handleCounterOffer(selectedOrder)}
                                                                    disabled={!counterOfferPrice || isNegotiating}
                                                                    className="px-6 bg-primary text-black rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-white transition-all disabled:opacity-20"
                                                                >
                                                                    Enviar
                                                                </button>
                                                            </div>
                                                            <button
                                                                onClick={() => setShowCounterInput(false)}
                                                                className="w-full text-center text-[9px] font-bold text-gray-600 uppercase tracking-widest hover:text-white transition-colors"
                                                            >
                                                                Cancelar
                                                            </button>
                                                        </motion.div>
                                                    )}
                                                </div>
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
                                            window.open(generateWhatsAppLink(selectedOrder), "_blank");
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
                        <div className="flex flex-col gap-1 mb-8">
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

                        {/* Negotiation Banner */}
                        {selectedOrder.adminPrice && selectedOrder.status !== 'venta_finalizada' && selectedOrder.status !== 'completed' && (
                            <NegotiationBanner
                                adminPrice={selectedOrder.adminPrice}
                                currency={selectedOrder.adminCurrency || selectedOrder.currency || 'ARS'}
                                onAccept={handleAcceptOffer}
                                onReject={handleRejectOffer}
                                isSubmitting={isLoading}
                                className="mb-8"
                            />
                        )}

                        {/* Items List */}
                        <div className="space-y-0 mb-8">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 italic mb-4">Detalle del Lote</h4>

                            {selectedOrder.items && selectedOrder.items.length > 0 ? (
                                selectedOrder.items.map((item: any, idx: number) => (
                                    <div key={idx} className="border-b border-white/10 py-5 flex items-start gap-4">
                                        {/* TAREA 2: Imagen de ítem */}
                                        <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0 bg-white/5 border border-white/10">
                                            <LazyImage
                                                src={item.cover_image || item.thumb}
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
                        </div>

                        {/* User Offer Highlight */}
                        <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-5 space-y-2 mb-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">Oferta Inicial</span>
                            <div className="flex items-center gap-3">
                                <DollarSign className="h-5 w-5 text-orange-500" />
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
        </div >
    );
}
