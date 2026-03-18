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
    ChevronDown,
    Truck,
    Copy,
    ExternalLink
} from "lucide-react";
import { db } from "@/lib/firebase";
import { formatDate, getReadableDate } from "@/utils/date";
import { collection, onSnapshot, query, orderBy, where, doc, deleteDoc, updateDoc, addDoc, serverTimestamp, arrayUnion, getDocs } from "firebase/firestore";
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
import { ADMIN_UIDS } from "@/constants/admin";
import type { Trade, InventoryItem, TradeManifest } from "@/types/inventory";
import ManifestEditor from "@/components/Trade/ManifestEditor";
import TradeChat from "@/components/Trade/TradeChat";
import UserCollection from "@/components/Profile/UserCollection";
import UsernameClaimModal from "@/components/Profile/UsernameClaimModal";
import PaymentMethodModal from "@/components/Trades/PaymentMethodModal";

export default function Profile() {
    const { user, dbUser, isAdmin } = useAuth();
    const { showLoading, hideLoading, isLoading } = useLoading();
    const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
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
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);


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
            const newParams = new URLSearchParams(searchParams);
            newParams.delete("order");
            newParams.delete("chat");
            setSearchParams(newParams, { replace: true });
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
        setOrdersLoading(true);

        // REAL-TIME SYNC (Protocol V68.0)
        const qSender = query(collection(db, "trades"), where("participants.senderId", "==", user.uid));
        const qReceiver = query(collection(db, "trades"), where("participants.receiverId", "==", user.uid));

        const updateTrades = async (snaps: any[]) => {
            const rawTradesMap = new Map<string, Trade>();
            snaps.forEach(snap => {
                snap.docs.forEach((doc: any) => {
                    rawTradesMap.set(doc.id, { id: doc.id, ...doc.data() } as Trade);
                });
            });

            const uniqueTrades = Array.from(rawTradesMap.values());
            const sorted = uniqueTrades.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            
            setTrades(sorted);
            setOrdersLoading(false);
            hideLoading();

            // Resolve item details (cached)
            const allItemIds = new Set<string>();
            sorted.forEach((t: Trade) => {
                t.manifest.offeredItems.forEach((id: string) => allItemIds.add(id));
                t.manifest.requestedItems.forEach((id: string) => allItemIds.add(id));
            });

            const details: Record<string, any> = { ...itemDetails };
            
            // Seed from manifestItems
            sorted.forEach(t => {
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

            setItemDetails(details);
        };

        const unsubSender = onSnapshot(qSender, () => {
            getDocs(qSender).then(s => getDocs(qReceiver).then(r => updateTrades([s, r])));
        });
        const unsubReceiver = onSnapshot(qReceiver, () => {
            getDocs(qSender).then(s => getDocs(qReceiver).then(r => updateTrades([s, r])));
        });

        return () => {
            unsubSender();
            unsubReceiver();
        };
    }, [user]);

    const fetchTrades = async () => {
        // Obsolete but kept for compatibility if needed elsewhere
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

            // Determinamos el destinatario (si soy el comprador, notifico al vendedor y viceversa)
            const recipientId = (user.uid === (order.user_id || order.participants?.senderId))
                ? (order.participants?.receiverId || ADMIN_UIDS[0])
                : (order.user_id || order.participants?.senderId || ADMIN_UIDS[0]);

            console.log(`[NotifV2] Profile Success Response: sender=${user.uid} | recipient=${recipientId}`);

            await addDoc(collection(db, "notifications"), {
                uid: recipientId,
                user_id: recipientId,
                title: "Venta Finalizada 🎉",
                message: `${user.displayName || 'Un cliente'} ha ACEPTADO el trato por la operación #${order.id?.slice(-6).toUpperCase()}.`,
                read: false,
                timestamp: serverTimestamp(),
                order_id: order.id,
                type: "order",
                link: `/mensajes?chat=${order.id}`
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
        if (!user) return;
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

            // Determinamos el destinatario
            const recipientId = (user.uid === (order.user_id || order.participants?.senderId))
                ? (order.participants?.receiverId || ADMIN_UIDS[0])
                : (order.user_id || order.participants?.senderId || ADMIN_UIDS[0]);

            console.log(`[NotifV2] Profile Counter Response: sender=${user.uid} | recipient=${recipientId}`);

            await addDoc(collection(db, "notifications"), {
                uid: recipientId,
                user_id: recipientId,
                title: "Nueva Contraoferta del Usuario",
                message: `${user?.displayName || 'Cliente'} propone ${order.currency || '$'} ${priceVal.toLocaleString()} por el pedido ${order.order_number || order.id}.`,
                read: false,
                timestamp: serverTimestamp(),
                order_id: order.id,
                type: "negotiation",
                link: `/mensajes?chat=${order.id}`
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

                // Notificamos al otro participante (V43.1 Dual-Write)
                const isStoreTrade = ADMIN_UIDS.includes(trade.participants.senderId) || ADMIN_UIDS.includes(trade.participants.receiverId);
                const role = ADMIN_UIDS.includes(trade.participants.senderId) ? 'seller' : 'buyer';
                const recipientId = (user.uid === trade.participants?.senderId)
                    ? trade.participants?.receiverId
                    : trade.participants?.senderId;

                if (recipientId) {
                    await addDoc(collection(db, "notifications"), {
                        uid: recipientId,
                        user_id: recipientId,
                        title: "¡Trato Aceptado! 🤝",
                        message: `${user.displayName || 'Tu contraparte'} ha aceptado los términos del intercambio.`,
                        read: false,
                        timestamp: serverTimestamp(),
                        order_id: trade.id,
                        type: "order",
                        link: `/mensajes?chat=${trade.id}`
                    });
                }

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

            // Notificamos a la contraparte (V43.1 Dual-Write)
            const recipientId = (user.uid === selectedTrade.participants?.senderId)
                ? selectedTrade.participants?.receiverId
                : selectedTrade.participants?.senderId;

            if (recipientId) {
                await addDoc(collection(db, "notifications"), {
                    uid: recipientId,
                    user_id: recipientId,
                    title: "Nueva Contraoferta Recibida 🔄",
                    message: `${user.displayName || 'Tu contraparte'} ha modificado los términos del intercambio.`,
                    read: false,
                    timestamp: serverTimestamp(),
                    order_id: selectedTrade.id,
                    type: "negotiation",
                    link: `/mensajes?chat=${selectedTrade.id}`
                });
            }

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
            pending_payment: { label: "Pendiente de Pago", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
            payment_confirmed: { label: "Pago Confirmado / Preparando", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
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
                        <button 
                            onClick={() => setIsClaimModalOpen(true)}
                            className="p-4 bg-white/5 border border-white/10 rounded-2xl text-white hover:bg-white/10 transition-all font-bold flex items-center gap-3"
                        >
                            {dbUser?.username ? (
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary">@{dbUser.username}</span>
                            ) : null}
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
                            <div className="flex flex-wrap justify-end gap-3">
                                <Link
                                    to="/trade/new?mode=admin_negotiation"
                                    state={{ admin_negotiation: true }}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary/10 to-primary/20 border border-primary/30 text-primary hover:from-primary/20 hover:to-primary/30 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/5"
                                >
                                    <BadgeDollarSign className="w-4 h-4" /> Vender mi Colección a OBG
                                </Link>
                                <Link
                                    to="/trade/new"
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/30 text-violet-400 hover:from-violet-500/20 hover:to-purple-500/20 hover:text-violet-300 text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    <Handshake className="w-4 h-4" /> Intercambio P2P
                                </Link>
                            </div>
                            <UserCollection userId={user?.uid || ""} />
                        </div>
                    )}
                </div>
            </div>

            {/* Order Details Drawer (Recibo Digital V65.0) */}
            <OrderDetailsDrawer
                isOpen={!!selectedOrder}
                onClose={() => setSelectedOrder(null)}
                status={selectedOrder?.status}
                title={selectedOrder?.type === 'exchange' ? 'INTERCAMBIO P2P' : 'VENTA DIRECTA'}
                footer={
                    selectedOrder && (
                        <div className="space-y-3">
                            {/* Inbox V2 Action (Primary focus) */}
                            <button
                                onClick={() => {
                                    const tradeId = selectedOrder.id;
                                    const senderId = selectedOrder.participants?.senderId || selectedOrder.user_id;
                                    const receiverId = selectedOrder.participants?.receiverId;
                                    let url = `/mensajes?chat=${tradeId}_${user?.uid === senderId ? receiverId : senderId}`;
                                    window.location.href = url;
                                }}
                                className="w-full flex items-center justify-center gap-3 py-4 bg-primary text-black rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-white transition-all shadow-lg shadow-primary/20 active:scale-95"
                            >
                                <MessageCircle className="h-5 w-5" />
                                Abrir Conversación (Inbox V2)
                            </button>

                            {/* Verification / Logistic Actions */}
                            {(selectedOrder.status === 'pending_payment' || selectedOrder.status === 'completed_unpaid') && user?.uid === (selectedOrder.participants?.receiverId || selectedOrder.ownerId) && (
                                <button
                                    onClick={() => {
                                        setIsPaymentModalOpen(true);
                                    }}
                                    className="w-full flex items-center justify-center gap-3 py-4 bg-orange-500 text-black rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-white transition-all shadow-lg shadow-orange-500/20 active:scale-95"
                                >
                                    <CheckCircle2 className="h-5 w-5" />
                                    Confirmar Pago Recibido
                                </button>
                            )}

                            {/* Secondary Link */}
                            <Link
                                to={`/orden/${selectedOrder.id}`}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10"
                            >
                                <Search className="h-4 w-4" /> Link Público del Lote
                            </Link>

                            {/* WhatsApp Fallback */}
                            <button
                                onClick={() => {
                                    pushWhatsAppContactFromOrder(selectedOrder);
                                    window.open(whatsappService.generateTradeLink(selectedOrder.id), "_blank");
                                }}
                                className="w-full text-center py-2 text-[9px] font-black text-gray-600 hover:text-green-500 uppercase tracking-widest transition-colors"
                            >
                                Contacto Directo vía WhatsApp →
                            </button>
                        </div>
                    )
                }
            >
                {selectedOrder && (
                    <div className="space-y-8">
                        {/* Header Compacto: Disco + Info Principal */}
                        <div className="flex items-center gap-5 p-4 bg-white/[0.02] border border-white/5 rounded-3xl">
                            <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 shadow-2xl border border-white/10 bg-black/40">
                                <LazyImage 
                                    src={selectedOrder.items?.[0]?.cover_image || selectedOrder.details?.cover_image || '/default-album.png'} 
                                    alt="" 
                                    className="w-full h-full object-cover" 
                                />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-xl font-black text-white leading-tight uppercase tracking-tighter truncate">
                                    {selectedOrder.items?.[0]?.title || selectedOrder.details?.album || "Disco Variado"}
                                </h3>
                                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest truncate">
                                    {selectedOrder.items?.[0]?.artist || selectedOrder.details?.artist || "Varios Artistas"}
                                </p>
                                <div className="mt-2 flex items-center gap-2">
                                    {getStatusBadge(selectedOrder.status)}
                                </div>
                            </div>
                        </div>

                        {/* Bloque Contraparte */}
                        <div className="flex items-center justify-between px-6 py-4 bg-white/5 border border-white/10 rounded-2xl">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-[10px]">
                                    {selectedOrder.participants?.senderId === user?.uid ? "V" : "C"}
                                </div>
                                <div>
                                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">
                                        Operación con
                                    </p>
                                    <p className="text-xs font-bold text-white">
                                        @{selectedOrder.participants?.senderId === user?.uid ? (selectedOrder.participants?.receiverName || "Vendedor") : (selectedOrder.participants?.senderName || "Comprador")}
                                    </p>
                                </div>
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${selectedOrder.participants?.senderId === user?.uid ? 'text-orange-400' : 'text-emerald-400'}`}>
                                {selectedOrder.participants?.senderId === user?.uid ? 'Eres Vendedor' : 'Eres Comprador'}
                            </span>
                        </div>

                        {/* Resumen Financiero Mini */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-5 rounded-3xl bg-secondary/5 border border-secondary/10">
                                <p className="text-[9px] uppercase tracking-widest font-black text-secondary/70 mb-2">Precio Final</p>
                                <p className="text-2xl font-black text-white">
                                    {selectedOrder.currency === 'USD' ? 'US$' : '$'} {(selectedOrder.totalPrice || selectedOrder.details?.price || 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/5">
                                <p className="text-[9px] uppercase tracking-widest font-black text-gray-500 mb-2">Items</p>
                                <p className="text-2xl font-black text-white">
                                    {selectedOrder.items?.length || selectedOrder.manifest?.requestedItems?.length || 1}
                                </p>
                            </div>
                        </div>

                        {/* Listado de Items (Compacto) */}
                        <div className="space-y-3">
                            <h4 className="px-1 text-[10px] font-black uppercase tracking-widest text-gray-600">Items en la Orden</h4>
                            <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar space-y-2">
                                {(selectedOrder.items || []).map((item: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-2xl">
                                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-black/20">
                                            <LazyImage src={item.cover_image || '/default-album.png'} alt="" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-bold text-white uppercase truncate">{item.title}</p>
                                            <div className="flex gap-2">
                                                {item.format && item.format !== 'N/A' && <span className="text-[8px] text-gray-500 font-bold uppercase">{item.format}</span>}
                                                {item.condition && item.condition !== 'N/A' && <span className="text-[8px] text-gray-500 font-bold uppercase">{item.condition}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Protocolo V68.0: Sección de Logística */}
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <div className="flex items-center justify-between">
                                <h4 className="px-1 text-[10px] font-black uppercase tracking-widest text-gray-600">Logística y Entrega</h4>
                                {selectedOrder.status === 'completed' && user?.uid === (selectedOrder.participants?.receiverId || selectedOrder.ownerId) && (
                                    <button 
                                        onClick={() => {
                                            const courier = prompt("Empresa de Correo:", selectedOrder.logistics?.courier || "");
                                            const tracking = prompt("Código de Seguimiento:", selectedOrder.logistics?.tracking_code || "");
                                            if (courier && tracking) {
                                                tradeService.updateLogistics(selectedOrder.id, {
                                                    delivery_type: 'shipping',
                                                    courier,
                                                    tracking_code: tracking
                                                });
                                            }
                                        }}
                                        className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline"
                                    >
                                        {selectedOrder.logistics?.tracking_code ? "Editar Seguimiento" : "Añadir Seguimiento"}
                                    </button>
                                )}
                            </div>

                            {selectedOrder.logistics?.tracking_code ? (
                                <div className="relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-blue-500/5 blur-xl group-hover:bg-blue-500/10 transition-all" />
                                    <div className="relative p-6 rounded-[2rem] bg-white/[0.03] border border-blue-500/20 backdrop-blur-md space-y-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-blue-500 text-black flex items-center justify-center shadow-lg shadow-blue-500/20">
                                                    <Truck size={24} />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Enviado por</p>
                                                    <p className="text-lg font-black text-white uppercase tracking-tight">{selectedOrder.logistics.courier}</p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                                            <div className="min-w-0">
                                                <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Código de Seguimiento</p>
                                                <p className="text-xs font-mono font-bold text-blue-400 truncate">{selectedOrder.logistics.tracking_code}</p>
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    navigator.clipboard.writeText(selectedOrder.logistics.tracking_code);
                                                    alert("Código copiado");
                                                }}
                                                className="p-3 hover:bg-white/5 rounded-xl transition-colors text-gray-400 hover:text-white"
                                            >
                                                <Copy size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-dashed border-white/10 flex flex-col items-center justify-center text-center space-y-2">
                                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-700">
                                        <Truck size={18} />
                                    </div>
                                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                                        {selectedOrder.status === 'completed' 
                                            ? "Pendiente de despacho / Aviso de envío" 
                                            : "El seguimiento estará disponible una vez confirmado el pago"}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Método de Pago Recibido */}
                        {selectedOrder.payment_method && (
                            <div className="p-4 bg-green-500/5 border border-green-500/10 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 size={16} className="text-green-500" />
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Pago Recibido vía</span>
                                </div>
                                <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">
                                    {selectedOrder.payment_method}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </OrderDetailsDrawer>

            <PaymentMethodModal 
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                tradeId={selectedOrder?.id}
                onSuccess={() => {
                    // Update the local state or let onSnapshot handle it
                }}
            />
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
            {/* Claim Identity Modal */}
            <UsernameClaimModal 
                isOpen={isClaimModalOpen} 
                onClose={() => setIsClaimModalOpen(false)}
                onSuccess={() => {
                    setIsClaimModalOpen(false);
                    fetchTrades();
                }}
            />
        </div >
    );
}
