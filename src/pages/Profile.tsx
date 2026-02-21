import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
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
    BadgeDollarSign
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, where, doc, deleteDoc } from "firebase/firestore";
import { useState, useEffect } from "react";
import { AlbumCardSkeleton } from "@/components/ui/Skeleton";
import { Link, useSearchParams } from "react-router-dom";
import OrderDetailsDrawer from "@/components/OrderDetailsDrawer";
import { generateWhatsAppLink } from '@/utils/whatsapp';
import type { OrderData } from '@/utils/whatsapp';
import OrderCard from '@/components/OrderCard';
import { pushWhatsAppContactFromOrder } from "@/utils/analytics";

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

export default function Profile() {
    const { user, isAdmin } = useAuth();
    const [activeTab, setActiveTab] = useState<"overview" | "orders" | "wantlist">("overview");

    // Firestore Data State
    const [collectionItems, setCollectionItems] = useState<ProfileItem[]>([]);
    const [wantlistItems, setWantlistItems] = useState<ProfileItem[]>([]);
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();

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

    useEffect(() => {
        if (!user) return;

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
        });

        return () => {
            unsubArchive();
            unsubWantlist();
            unsubOrders();
        };
    }, [user]);

    const removeItem = async (type: "collection" | "wantlist", id: string) => {
        if (!user) return;
        await deleteDoc(doc(db, "users", user.uid, type, id));
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
                                                    <img src={item.cover_image} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 grayscale-[0.3] group-hover:grayscale-0" />
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
                            {selectedOrder.admin_offer_price && (
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <BadgeDollarSign className="h-4 w-4 text-purple-400" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">Cotización Recibida</span>
                                        </div>
                                        <p className="text-3xl font-display font-black text-white tracking-tight">
                                            {selectedOrder.admin_offer_currency === "USD" ? "US$" : "$"} {selectedOrder.admin_offer_price.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            )}
                            <button
                                onClick={() => {
                                    pushWhatsAppContactFromOrder(selectedOrder);
                                    window.open(generateWhatsAppLink(selectedOrder), "_blank");
                                }}
                                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-green-500/20"
                            >
                                <MessageCircle className="h-4 w-4" />
                                Contactar por WhatsApp
                            </button>
                        </div>
                    )
                }
            >
                {selectedOrder && (
                    <>
                        {/* Cover Image */}
                        {selectedOrder.details.cover_image && (
                            <div className="w-full aspect-square max-h-[300px] rounded-2xl overflow-hidden border border-white/10">
                                <img src={selectedOrder.details.cover_image} alt="" className="w-full h-full object-cover" />
                            </div>
                        )}

                        {/* Item Info */}
                        <div className="space-y-2">
                            <h3 className="text-2xl font-display font-black text-white uppercase tracking-tight leading-tight">
                                {selectedOrder.details?.artist || (selectedOrder as any).artist || 'Unknown Artist'}
                            </h3>
                            <p className="text-lg text-gray-400 font-bold">{selectedOrder.details?.album || (selectedOrder as any).title || 'Unknown Album'}</p>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 space-y-1">
                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Intención</p>
                                <p className={`text-sm font-black uppercase ${(selectedOrder.details?.intent || selectedOrder.status) === "COMPRAR" ? "text-green-400" : "text-orange-400"}`}>{selectedOrder.details?.intent || 'COMPRAR'}</p>
                            </div>
                            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 space-y-1">
                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Estado</p>
                                <div>{getStatusBadge(selectedOrder.status)}</div>
                            </div>
                            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 space-y-1">
                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Formato</p>
                                <p className="text-sm font-bold text-white">{selectedOrder.details.format}</p>
                            </div>
                            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 space-y-1">
                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Condición</p>
                                <p className="text-sm font-bold text-white">{selectedOrder.details.condition}</p>
                            </div>
                        </div>

                        {/* Price (for VENDER) */}
                        {selectedOrder.details.price && (
                            <div className="bg-primary/5 border border-primary/10 rounded-xl p-5 flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Tu Precio</span>
                                <span className="text-xl font-display font-black text-primary">
                                    {selectedOrder.details.currency === "USD" ? "US$" : "$"} {selectedOrder.details.price.toLocaleString()}
                                </span>
                            </div>
                        )}

                        {/* Date */}
                        <div className="flex items-center gap-2 text-gray-600 text-xs font-bold">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDate(selectedOrder.timestamp)}
                        </div>

                        <Link
                            to={`/orden/${selectedOrder.id}`}
                            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10 mt-6"
                        >
                            <Search className="h-4 w-4" /> Link Público del Lote
                        </Link>
                    </>
                )}
            </OrderDetailsDrawer>
        </div>
    );
}
