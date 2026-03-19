import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    ShoppingBag,
    Music,
    Clock,
    BadgeDollarSign,
    CheckCircle2,
    XCircle,
    Handshake,
    ChevronDown,
    Search,
    Tag,
    DollarSign,
    Hash,
    Trash2,
    Disc,
    ChevronRight,
    MessageCircle,
    Eye,
    Flame,
    Share2,
    Truck
} from 'lucide-react';
import { TEXTS } from '@/constants/texts';
import { useAuth } from '@/context/AuthContext';
import { formatDate, getReadableDate } from '@/utils/date';
import { LazyImage } from '@/components/ui/LazyImage';
import { db } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion, addDoc, serverTimestamp, collection } from 'firebase/firestore';
import { getCleanOrderMetadata } from '@/utils/orderMetadata';
import { useLoading } from '@/context/LoadingContext';
import { tradeService } from '@/services/tradeService';
import { isAdminEmail, ADMIN_UIDS } from '@/constants/admin';
import { CountdownTimer } from './Auction/CountdownTimer';
import DirectPurchaseModal from './Trades/DirectPurchaseModal';
import PaymentMethodModal from './Trades/PaymentMethodModal';

interface OrderCardProps {
    order: any; // Using any or an extended OrderData to catch legacy fields without crashing
    context: 'admin' | 'public' | 'profile';
    onClick?: () => void;
}

export default function OrderCard({ order, context, onClick }: OrderCardProps) {
    if (!order) return null;

    // Extracción tolerante a fallas para órdenes V1
    const isExchange = order?.type === 'exchange';
    const isAuction = order?.type === 'auction';
    const isAdminNegotiation = order?.type === 'admin_negotiation';
    const isDirectSaleP2P = order?.type === 'direct_sale';
    const isPurchase = isDirectSaleP2P || (isAdminNegotiation && order.manifest?.requestedItems?.length > 0 && order.manifest?.offeredItems?.length === 0);
    const isSale = order?.type === 'admin_negotiation' && order.manifest?.offeredItems?.length > 0;

    const orderIntent = (order && (order.intent || order.details?.intent))
        ? (order.intent || order.details.intent)
        : (isDirectSaleP2P ? 'VENDER' : isPurchase ? 'COMPRAR' : isExchange ? 'INTERCAMBIO' : isAuction ? 'SUBASTA' : 'VENDER');

    const orderStatus = order?.status || 'pending';
    const orderType = isAdminNegotiation ? (isSale ? 'sell' : 'buy') : (order?.type || 'buy');

    const { user, dbUser, isAdmin } = useAuth();
    const isStoreDirectSale = order?.type === 'direct_sale' && (
        !order.participants?.receiverId || 
        ADMIN_UIDS.includes(order.participants.receiverId) || 
        order.participants.receiverId === 'admin'
    );
    const { showLoading, hideLoading } = useLoading();
    const [isExpanded, setIsExpanded] = useState(false);
    const [quickOffer, setQuickOffer] = useState("");
    const [bidAmount, setBidAmount] = useState(
        (order.current_highest_bid || order.starting_price || 0) + 1000
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [auctionFinished, setAuctionFinished] = useState(false);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    const handleBid = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user || isSubmitting || auctionFinished) return;
        
        if (!dbUser?.username) {
            alert("Debes reclamar un @usuario para poder pujar en subastas.");
            return;
        }

        const amount = parseFloat(bidAmount as any);
        const currentMin = order.current_highest_bid || order.starting_price || 0;
        
        if (amount <= currentMin) {
            alert(`Tu oferta debe ser mayor a $${currentMin.toLocaleString()}`);
            return;
        }

        setIsSubmitting(true);
        showLoading("Enviando puja...");
        try {
            await tradeService.submitBid(order.id, user.uid, amount, dbUser.username);
            alert("¡Puja enviada con éxito!");
        } catch (error: any) {
            console.error("Bid error:", error);
            alert(error.message || "Error al enviar la puja");
        } finally {
            setIsSubmitting(false);
            hideLoading();
        }
    };

    const lastNegotiation = order.negotiationHistory?.[order.negotiationHistory.length - 1];
    const requiresAction = context === 'admin' && (
        lastNegotiation?.sender === 'user' ||
        (order.type === 'direct_sale' && order.status === 'pending')
    );

    const handleQuickOffer = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const priceVal = parseFloat(quickOffer);
        if (isNaN(priceVal) || priceVal <= 0 || isSubmitting) return;

        setIsSubmitting(true);
        showLoading(TEXTS.admin.admin.updatingStatus);
        try {
            const currency = order.adminCurrency || order.currency || order.details?.currency || "ARS";
            await updateDoc(doc(db, "trades", order.id), {
                adminPrice: priceVal,
                adminCurrency: currency,
                status: "counteroffered",
                negotiationHistory: arrayUnion({
                    price: priceVal,
                    currency: currency,
                    sender: 'admin',
                    timestamp: new Date()
                })
            });

            const currSymbol = currency === "USD" ? "US$" : "$";
            await addDoc(collection(db, "notifications"), {
                uid: (order.participants?.senderId || order.user_id),
                user_id: (order.participants?.senderId || order.user_id),
                title: TEXTS.admin.admin.counterOfferReceived,
                message: `Oldie but Goldie propone ${currSymbol} ${priceVal.toLocaleString()} para tu operación.`,
                read: false,
                timestamp: serverTimestamp(),
                order_id: order.id,
                link: `/mensajes?chat=${order.id}`
            });

            setQuickOffer("");
        } catch (error) {
            console.error("Quick offer error:", error);
        } finally {
            setIsSubmitting(false);
            hideLoading();
        }
    };

    // Ownership & Role detection for P2P routing
    const senderId = order.participants?.senderId || order.user_id;
    const receiverId = order.participants?.receiverId;
    const isSender = user?.uid === senderId;
    const isReceiver = user?.uid === receiverId;

    const getChatUrl = () => {
        if (!user) return '/mensajes';
        
        // Caso A: El usuario actual no es el vendedor (es el comprador o interesado)
        if (!isSender) {
            return `/mensajes?chat=${order.id}_${user.uid}`;
        }

        // Caso B: El usuario actual es el VENDEDOR y la orden tiene destinatario (adjudicada)
        if (isSender && (orderStatus === 'pending_payment' || orderStatus === 'payment_confirmed' || orderStatus === 'completed' || orderStatus === 'venta_finalizada')) {
            if (receiverId) {
                return `/mensajes?chat=${order.id}_${receiverId}`;
            }
        }

        // Caso C: Vendedor con orden pendiente (muchas conversaciones posibles)
        return '/mensajes';
    };

    const getStatusBadge = (status: string) => {
        const statusLabel = TEXTS.admin.admin.statusOptions[status as keyof typeof TEXTS.admin.admin.statusOptions] || status;
        switch (status) {
            case 'sold':
            case 'completed':
            case 'venta_finalizada':
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 backdrop-blur-md">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-[10px] uppercase tracking-widest font-black text-green-500">{statusLabel}</span>
                    </div>
                );
            case 'quoted':
            case 'counteroffered':
            case 'counter_offer':
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 backdrop-blur-md">
                        <BadgeDollarSign className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-[10px] uppercase tracking-widest font-black text-purple-400">{statusLabel}</span>
                    </div>
                );
            case 'negotiating':
            case 'contraofertado':
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 backdrop-blur-md">
                        <Handshake className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-[10px] uppercase tracking-widest font-black text-blue-400">{statusLabel}</span>
                    </div>
                );
            case 'cancelled':
            case 'rejected':
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 backdrop-blur-md">
                        <XCircle className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-[10px] uppercase tracking-widest font-black text-red-500">{statusLabel}</span>
                    </div>
                );
            case 'pending_payment':
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 backdrop-blur-md">
                        <Clock className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                        <span className="text-[10px] uppercase tracking-widest font-black text-orange-500">Pendiente de Pago</span>
                    </div>
                );
            case 'payment_confirmed':
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 backdrop-blur-md">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-[10px] uppercase tracking-widest font-black text-blue-400">Pago Confirmado / Preparando</span>
                    </div>
                );
            case 'pending':
            default:
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-md">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[10px] uppercase tracking-widest font-black text-primary">{statusLabel}</span>
                    </div>
                );
        }
    }    // 3. ROLE & SEMANTIC LABELING (Protocol V90.0: Semantic Refactor)
    const getTradeRoleLabel = () => {
        if (isAdmin && context === 'admin') {
            if (isDirectSaleP2P) return "VENTA (B2C)";
            if (order.type === 'sourcing_request' || (isAdminNegotiation && order.manifest?.requestedItems?.length > 0)) return "SOURCING";
            return "NEGOCIACIÓN";
        }

        const isStoreReceiver = ADMIN_UIDS.includes(receiverId || "");
        const isStoreSender = ADMIN_UIDS.includes(senderId || "");

        // A. Official Store Branch (User vs. OBG)
        if (isStoreReceiver || isStoreSender) {
            if (isDirectSaleP2P) return "COMPRA";
            if (order.type === 'sourcing_request') return "PEDIDO";
            if (isAdminNegotiation) {
                // Sourcing logic check
                if (order.manifest?.requestedItems?.length > 0 && order.manifest?.offeredItems?.length === 0) return "PEDIDO";
                return "VENTA"; // User selling to OBG
            }
        }

        // B. Peer-to-Peer Branch
        if (isExchange) {
            const cash = order.manifest?.cashAdjustment || 0;
            if (cash > 0) return isSender ? "COMPRA" : "VENTA";
            if (cash < 0) return isSender ? "VENTA" : "COMPRA";
            return "INTERCAMBIO";
        }

        if (isAuction) return "SUBASTA";

        // Fallback robusto
        return isSender ? "VENTA" : "COMPRA";
    };

    const refinedIntent = getTradeRoleLabel();
    const intent = refinedIntent;

    // [STRICT-EXTRACT] Uso del helper centralizado para integridad de datos
    const meta = getCleanOrderMetadata(order);
    const { artist, album, image, isBatch, itemsCount: itemsFromHelper } = meta;
    const isInventoryItem = meta.isInventoryItem || order.isInventoryItem;
    const items = Array.isArray(order.items) && order.items.length > 0 ? order.items : (Array.isArray(order.manifest?.items) ? order.manifest.items : []);
    const manifestOffered = isExchange ? items.filter((i: any) => i.source === 'user_asset') : [];
    const manifestRequested = isExchange ? items.filter((i: any) => i.source === 'inventory') : [];

    const coverImage = image;
    const title = isBatch ? `LOTE DE ${itemsFromHelper} DISCOS` : album;

    const format = isBatch ? 'Varios Formatos' : (order.details?.format || 'N/A');
    const condition = isBatch ? 'Varias Condiciones' : (order.details?.condition || 'N/A');
    const status = orderStatus;

    const renderPriceOffer = () => {
        // 1. OFERTA DEL VENDEDOR (From User)
        // If it's a VENDER (Sell) order, the user's price is their bid.
        const userPrice = order.totalPrice || order.details?.price;
        const userCurrency = order.currency || order.details?.currency || "ARS";
        const isSellOrder = intent.includes("VENDER") || intent === "VENTA" || intent === "COMPRA" || intent === "PEDIDO";

        // 2. CONTRAOFERTA (From Admin)
        // This is the new adminPrice field for negotiation.
        const historyAdminOffer = order.negotiationHistory?.filter((h: any) => h.sender === 'admin').pop();
        const adminPrice = historyAdminOffer?.price || order.adminPrice;
        const adminCurrency = historyAdminOffer?.currency || order.adminCurrency || "ARS";

        const historyUserOffer = order.negotiationHistory?.filter((h: any) => h.sender === 'user').pop();
        const latestUserPrice = historyUserOffer?.price || userPrice;
        const latestUserCurrency = historyUserOffer?.currency || userCurrency;

        const canSeePrice = isAdmin || (user?.uid === order.user_id) || (user?.uid === senderId) || order.is_admin_offer || order.isPublicOrder === true;

        if (!canSeePrice) return null;

        return (
            <div className="flex flex-col gap-2 w-full mt-4">
                {(isSellOrder && latestUserPrice) && (
                    <div className={`bg-secondary/10 border border-secondary/20 px-3 py-2 rounded-xl flex flex-col items-end shadow-sm shadow-secondary/5 ${context === 'admin' ? "mr-4" : ""}`}>
                        <span className="text-[9px] font-black uppercase tracking-widest text-secondary">
                            {historyUserOffer ? "Última Contraoferta Cliente" : "Oferta del Vendedor"}
                        </span>
                        <span className="text-sm font-black text-white">
                            {latestUserCurrency === "USD" ? "US$" : "$"} {(latestUserPrice || 0).toLocaleString()}
                        </span>
                    </div>
                )}

                {adminPrice && (
                    <div className={`bg-primary/10 border border-primary/20 px-3 py-2 rounded-xl flex flex-col items-end shadow-sm shadow-primary/5 ${context === 'admin' ? "mr-4" : ""}`}>
                        <span className="text-[9px] font-black uppercase tracking-widest text-primary">
                            {historyAdminOffer ? "Última Contraoferta OBG" : "Contraoferta de OBG"}
                        </span>
                        <span className="text-sm font-black text-white">
                            {adminCurrency === "USD" ? "US$" : "$"} {(adminPrice || 0).toLocaleString()}
                        </span>
                    </div>
                )}

                {/* Legacy admin_offer_price for backward compatibility */}
                {!adminPrice && order.admin_offer_price && (
                    <div className={`bg-purple-500/10 border border-purple-500/20 px-3 py-2 rounded-xl flex flex-col items-end shadow-sm shadow-purple-500/5 ${context === 'admin' ? "mr-4" : ""}`}>
                        <span className="text-[9px] font-black uppercase tracking-widest text-purple-400">{TEXTS.admin.admin.ourOffer}</span>
                        <span className="text-sm font-black text-white">
                            {order.admin_offer_currency === "USD" ? "US$" : "$"} {(order.admin_offer_price || 0).toLocaleString()}
                        </span>
                    </div>
                )}
            </div>
        );
    };

    const isHot = context === 'admin' && (order.view_count || 0) > 5 &&
        (order.last_viewed_at?.seconds
            ? (Date.now() - order.last_viewed_at.seconds * 1000) < 86400000
            : (order.createdAt?.seconds
                ? (Date.now() - order.createdAt.seconds * 1000) < 86400000
                : false));

    return (
        <motion.article
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={context !== 'public' ? onClick : undefined}
            aria-label={`${intent}: ${artist} - ${title}`}
            className={`
                group relative bg-white/[0.02] border rounded-[1.5rem] overflow-hidden transition-all duration-300
                ${context !== 'public' ? 'cursor-pointer hover:border-primary/30' : 'hover:border-white/10'}
                ${isHot ? "border-secondary/50 shadow-[0_0_15px_rgba(255,77,0,0.15)]" : (order.admin_offer_price ? "border-purple-500/20" : "border-white/5")}
                ${(ADMIN_UIDS.includes(senderId) || ADMIN_UIDS.includes(order.user_id) || isAdminEmail(order.user_email)) ? "border-primary/30 shadow-[0_10px_40px_rgba(255,184,0,0.1)] bg-gradient-to-b from-primary/[0.03] to-transparent" : ""}
            `}
        >
            {/* Context Badge Corner - Floating Island to prevent overlaps */}
            <div className="absolute top-2 right-2 md:top-4 md:right-4 flex items-center z-20 bg-black/40 backdrop-blur-md rounded-[1.25rem] border border-white/10 shadow-lg">
                {context === 'admin' && order.user_email && (
                    <>
                        {requiresAction && (
                            <div className="px-3 py-1.5 bg-red-500/80 text-white text-[8px] font-black uppercase tracking-widest rounded-l-[1.25rem] animate-pulse">
                                Acción
                            </div>
                        )}
                        <div className="px-3 py-1.5 text-[9px] text-gray-300 font-mono hidden md:block border-r border-white/10">
                            {order.user_email}
                        </div>
                    </>
                )}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (navigator.share) {
                            navigator.share({
                                title: `Oldie But Goldie - ${title}`,
                                text: '¡Mira esta joya que encontré en Oldie But Goldie!',
                                url: isInventoryItem ? `https://www.oldiebutgoldie.com.ar/album/${order.id}` : `https://www.oldiebutgoldie.com.ar/orden/${order.id}`
                            }).catch(console.error);
                        } else {
                            navigator.clipboard.writeText(isInventoryItem ? `https://www.oldiebutgoldie.com.ar/album/${order.id}` : `https://www.oldiebutgoldie.com.ar/orden/${order.id}`);
                            alert('Enlace copiado al portapapeles');
                        }
                    }}
                    className={`p-2.5 text-gray-400 hover:text-white transition-colors ${context === 'admin' && order.user_email ? 'rounded-r-[1.25rem]' : 'rounded-[1.25rem]'}`}
                    title="Compartir"
                >
                    <Share2 className="w-4 h-4" />
                </button>
            </div>

            <div className="p-4 pt-12 md:p-6 lg:p-8 flex flex-col lg:flex-row items-start lg:items-center gap-6">

                {/* Image Section */}
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden bg-black/50 flex-shrink-0 border border-white/10 group-hover:border-primary/20 transition-all relative shadow-md shadow-black/50">
                    {coverImage ? (
                        <LazyImage
                            src={coverImage}
                            alt={title}
                            className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Music className="w-8 h-8 text-white/10" />
                        </div>
                    )}
                    {isBatch && (
                        <div className="absolute bottom-1 right-1 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 text-[10px] font-bold text-white flex items-center gap-1 shadow-sm shadow-black/50">
                            <ShoppingBag className="w-3 h-3" /> {items.length}
                        </div>
                    )}
                </div>

                {/* Details Section */}
                <div className="flex-1 min-w-0 flex flex-col justify-center space-y-2.5 w-full">
                    <div className="flex items-center gap-3">
                        {order.order_number && (
                            <span className="inline-flex items-center gap-1.5 text-[9px] font-mono font-bold text-gray-500 uppercase tracking-wider">
                                <Hash className="h-3 w-3" /> {order.order_number}
                            </span>
                        )}
                        {context === 'admin' && (order.view_count !== undefined) && order.view_count > 0 && (
                            <span className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider ${isHot ? 'text-orange-400' : 'text-gray-500'}`} title={`Vistas: ${order.view_count}`}>
                                <Eye className="h-3 w-3" /> {order.view_count}
                                {isHot && <Flame className="h-3 w-3 ml-0.5" />}
                            </span>
                        )}
                        {(isBatch || order.is_admin_offer || isDirectSaleP2P) && (
                            ((order.is_admin_offer || ADMIN_UIDS.includes(order.user_id) || isAdminEmail(order.user_email)) && !isDirectSaleP2P) || isStoreDirectSale ? (
                                <span className="px-3 py-1 rounded-full bg-gradient-to-r from-primary to-primary/60 text-black text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(255,184,0,0.4)] flex items-center gap-1.5 border border-white/20">
                                    <span className="text-sm">🌟</span> {isStoreDirectSale ? "Compra Oficial en OBG" : TEXTS.global.badges.storeObg}
                                </span>
                            ) : isDirectSaleP2P ? (
                                <span className="px-2 py-0.5 rounded-full bg-primary/20 border border-primary/50 text-primary text-[9px] font-black uppercase tracking-widest shadow-lg shadow-primary/10">
                                    VENTA DIRECTA
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/30 text-slate-400 text-[9px] font-black uppercase tracking-widest">
                                    {TEXTS.global.badges.user_label}
                                </span>
                            )
                        )}
                        {order.logistics?.tracking_code && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/50 text-blue-400 text-[9px] font-black uppercase tracking-widest animate-pulse flex items-center gap-1">
                                <Truck size={10} /> EN CAMINO
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col">
                        <h3 className={`text-xl md:text-2xl font-display font-black text-white uppercase tracking-tight truncate ${context !== 'public' ? 'group-hover:text-primary transition-colors' : ''}`}>
                            {context === 'public' && isStoreDirectSale 
                                ? `${order.user_name || 'Alguien'} realizó una compra oficial en OBG`
                                : (artist || album)}
                        </h3>
                        {album && artist && (
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest truncate mt-0.5 opacity-80">
                                {isBatch ? `LOTE DE ${itemsFromHelper} ÍTEMS` : album}
                            </h4>
                        )}
                        {isBatch && !artist && (
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest truncate mt-0.5 opacity-80">
                                LOTE DE {itemsFromHelper} ÍTEMS
                            </h4>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-1">
                        <span className={`px-2 md:px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                            intent === "INTERCAMBIO" ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : 
                            intent === "COMPRA" || intent.includes("COMPRAR") ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                            intent === "PEDIDO" || intent === "SOURCING" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                            "bg-secondary/10 text-secondary border-secondary/20"
                            }`}>
                            {intent === "INTERCAMBIO" && <Handshake className="w-3 h-3 inline mr-1" />}
                            {intent}
                        </span>
                        {!isBatch && (
                            <>
                                {(format && format !== 'N/A') && (
                                    <span className="flex items-center gap-1 text-gray-500 text-[9px] md:text-[10px] font-black uppercase">
                                        <Tag className="h-3 w-3" /> {format}
                                    </span>
                                )}
                                {(condition && condition !== 'N/A') && (
                                    <span className="text-gray-600 text-[9px] md:text-[10px] font-bold uppercase">{condition}</span>
                                )}
                            </>
                        )}

                        {/* Premium Price Badge */}
                        {(order.details?.price || order.totalPrice || order.starting_price || order.current_highest_bid) && (
                            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs md:text-sm font-black shadow-sm ml-auto md:ml-2 ${
                                isAuction ? 'bg-orange-500/10 border border-orange-500/20 text-orange-400' : 'bg-primary/10 border border-primary/20 text-primary'
                            }`}>
                                {isAuction ? <Flame className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />}
                                {(isAdmin || user?.uid === order.user_id || user?.uid === senderId || order.is_admin_offer || order.isPublicOrder === true) ? (
                                    <>
                                        <span className="text-[10px] opacity-50 mr-1">{isAuction ? (order.current_highest_bid ? 'PUJA ACTUAL:' : 'INICIO:') : ''}</span>
                                        {`${(order.details?.currency || order.currency || 'ARS') === "USD" ? "US$" : "$"} ${(order.current_highest_bid || order.totalPrice || order.details?.price || order.starting_price || 0).toLocaleString()}`}
                                    </>
                                ) : (
                                    <span className="text-primary/50 italic text-[10px]">{TEXTS.global.common.private}</span>
                                )}
                            </span>
                        )}
                    </div>

                    {/* Time & Public Link Line */}
                    <div className="flex items-center justify-between pt-2">
                        <time
                            dateTime={new Date(order.createdAt?.seconds * 1000 || order.timestamp?.seconds * 1000 || Date.now()).toISOString()}
                            className="text-[10px] text-gray-600 font-bold flex items-center gap-1.5 uppercase font-mono"
                        >
                            <Clock className="w-3.5 h-3.5" /> {getReadableDate(order.createdAt || order.timestamp)}
                        </time>
                        
                        <div className="flex items-center gap-2">
                            {/* Intelligent Routing Button - Protocol V59.1 */}
                            {context === 'profile' && status !== 'cancelled' && (
                                <Link
                                    to={getChatUrl()}
                                    onClick={(e) => e.stopPropagation()}
                                    className="px-3 py-1.5 bg-primary/20 hover:bg-primary text-primary hover:text-black border border-primary/30 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                >
                                    <MessageCircle className="w-3.5 h-3.5" /> Ir al Chat
                                </Link>
                            )}
                            <Link
                                to={isInventoryItem ? `/album/${order.id}` : `/orden/${order.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className={`px-3 py-1.5 border rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-2
                                    ${context === 'public' ? 'bg-white/5 hover:bg-white/10 text-white border-white/10' : 'bg-transparent hover:bg-white/5 text-gray-400 border-transparent hover:border-white/10'}
                                `}
                            >
                                <Search className="w-3 h-3" /> Ver Detalle {isInventoryItem ? "Automático" : "Público"}
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Right Status Panel */}
                <div className="flex flex-col w-full lg:w-auto mt-4 lg:mt-0 gap-3 md:gap-4 flex-shrink-0 border-t border-white/5 lg:border-t-0 pt-4 lg:pt-0">
                    <div className="flex w-full justify-start lg:justify-end gap-2">
                        {isAuction && (
                            <CountdownTimer 
                                endDate={order.auction_end_date} 
                                onEnd={() => setAuctionFinished(true)} 
                            />
                        )}
                        {getStatusBadge(status)}
                    </div>

                    {isAuction ? (
                        /* BIDDING UI */
                        context === 'public' && !auctionFinished && status !== 'resolved' && (
                            <div className="flex flex-col gap-2 w-full lg:w-48 mt-auto" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center gap-2 group/bid">
                                    <div className="relative flex-1">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/50 group-focus-within/bid:text-primary transition-colors" />
                                        <input
                                            type="number"
                                            value={bidAmount}
                                            onChange={e => setBidAmount(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-3 text-sm font-mono text-white focus:border-primary/40 outline-none transition-all"
                                            placeholder="Monto"
                                        />
                                    </div>
                                    <button
                                        onClick={handleBid}
                                        disabled={isSubmitting || !user}
                                        className="h-[46px] px-6 bg-primary text-black rounded-xl font-black uppercase text-xs tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                                    >
                                        {isSubmitting ? (
                                            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                        ) : "PUJAR"}
                                    </button>
                                </div>
                                {!user && (
                                    <p className="text-[8px] text-gray-500 font-bold uppercase text-center">Inicia sesión para pujar</p>
                                )}
                            </div>
                        )
                    ) : (
                        /* BUY BUTTON (Standard / P2P) */
                        context === 'public' && (order.is_admin_offer || isInventoryItem || isDirectSaleP2P) && status !== 'completed' && status !== 'venta_finalizada' && status !== 'cancelled' && (
                            isDirectSaleP2P ? (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!user) {
                                            alert("Debes iniciar sesión para comprar.");
                                            return;
                                        }
                                        setIsPurchaseModalOpen(true);
                                    }}
                                    className="w-full px-6 py-4 bg-gradient-to-r from-primary to-secondary text-black font-black uppercase tracking-widest text-[11px] md:text-sm rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all text-center lg:mt-auto"
                                >
                                    ¡COMPRAR!
                                </button>
                            ) : (
                                <Link
                                    to={isInventoryItem ? `/album/${order.id}` : `/orden/${order.id}?action=buy`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-6 py-4 bg-gradient-to-r from-primary to-secondary text-black font-black uppercase tracking-widest text-[11px] md:text-sm rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all text-center lg:mt-auto"
                                >
                                    ¡COMPRAR!
                                </Link>
                            )
                        )
                    )}

                    {status === 'pending_payment' && (
                        <div className="w-full mt-auto pt-4 border-t border-white/5 space-y-3">
                            {user?.uid === (order.participants?.receiverId || order.ownerId) ? (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsPaymentModalOpen(true);
                                    }}
                                    className="w-full px-6 py-4 bg-orange-500 text-black font-black uppercase tracking-widest text-[11px] md:text-sm rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all text-center"
                                >
                                    Confirmar Pago Recibido
                                </button>
                            ) : (
                                <div className="w-full px-6 py-4 bg-blue-500/10 border border-blue-500/20 text-blue-400 font-black uppercase tracking-widest text-[10px] md:text-xs rounded-xl text-center italic">
                                    Esperando confirmación del vendedor
                                </div>
                            )}
                        </div>
                    )}

                    <DirectPurchaseModal 
                        isOpen={isPurchaseModalOpen}
                        onClose={() => setIsPurchaseModalOpen(false)}
                        order={order}
                    />

                    <PaymentMethodModal
                        isOpen={isPaymentModalOpen}
                        onClose={() => setIsPaymentModalOpen(false)}
                        tradeId={order.id}
                    />

                    {/* QuickOffer Component for Admins - Minimalist & Validated */}
                    {context === 'admin' && status !== 'completed' && status !== 'venta_finalizada' && status !== 'cancelled' && (
                        <div className="flex items-center gap-1.5 mt-auto group/quick" onClick={(e) => e.stopPropagation()}>
                            {requiresAction && (
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        const confirmMsg = order.type === 'direct_sale' 
                                            ? "¿Aceptar esta propuesta? Esto moverá la orden a 'Pendiente de Pago'. El stock se descontará recién al confirmar el pago."
                                            : "¿Aceptar esta propuesta del cliente? Esto completará la orden y transferirá los activos.";
                                        if (!window.confirm(confirmMsg)) return;
                                        setIsSubmitting(true);
                                        showLoading("Aceptando propuesta...");
                                        try {
                                            const manifestToResolve = order.manifest || {
                                                requestedItems: items.map((i: any) => i.id || i.itemId).filter(Boolean),
                                                offeredItems: [],
                                                cashAdjustment: lastNegotiation?.price || order.totalPrice,
                                                currency: lastNegotiation?.currency || order.currency || 'ARS'
                                            };
                                            await tradeService.resolveTrade(order.id, manifestToResolve);
                                            // The onSnapshot will automatically update the UI since orders are mapped from real-time DB
                                        } catch (error: any) {
                                            console.error("Accept offer error:", error);
                                            alert(`Error: ${error.message}`);
                                        } finally {
                                            setIsSubmitting(false);
                                            hideLoading();
                                        }
                                    }}
                                    disabled={isSubmitting}
                                    className="p-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg hover:bg-emerald-500 hover:text-black transition-all disabled:opacity-10 active:scale-95 shadow-lg shadow-emerald-500/5 mr-2"
                                    title="Aceptar Oferta del Cliente"
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                </button>
                            )}
                            <div className="relative">
                                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-primary/50 group-focus-within/quick:text-primary transition-colors" />
                                <input
                                    type="number"
                                    placeholder="Cotizar"
                                    value={quickOffer}
                                    onChange={(e) => setQuickOffer(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleQuickOffer(e as any)}
                                    className="bg-white/5 border border-white/10 rounded-lg pl-6 pr-2 py-1.5 text-[10px] font-black text-white w-20 focus:w-28 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all placeholder:text-gray-700 placeholder:font-bold"
                                />
                            </div>
                            <button
                                onClick={handleQuickOffer}
                                disabled={!quickOffer || parseFloat(quickOffer) <= 0 || isSubmitting}
                                className="p-2 bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary hover:text-black transition-all disabled:opacity-10 active:scale-95 shadow-lg shadow-primary/5"
                                title="Enviar Contraoferta"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Offer Injection for internal contexts */}
            {context !== 'public' && (order.adminPrice || order.admin_offer_price) && (
                <div className="px-6 md:px-8 pb-6 w-full flex justify-end">
                    {renderPriceOffer()}
                </div>
            )}

            {/* Collapsible Batch Section */}
            {isBatch && context !== 'public' && (
                <div className="border-t border-white/5">
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                        className="w-full px-6 py-3 flex items-center justify-between bg-white/[0.01] hover:bg-white/[0.03] transition-colors"
                    >
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                            Desplegar Contenido del Lote ({items.length})
                        </span>
                        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                        {isExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="px-6 pb-6 pt-2 space-y-2">
                                    {(items || []).map((item: any, idx: number) => {
                                        const cleanArtist = item.artist ? item.artist.replace(/UNKNOWN ARTIST\s*[-—–]*\s*/gi, '').trim() : 'Falta Artista';
                                        return (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 gap-4 hover:bg-white/[0.02] transition-colors">
                                                <div className="flex-1 min-w-0">
                                                    <h5 className="text-sm font-bold text-white truncate w-full uppercase">
                                                        {item.title || cleanArtist}
                                                    </h5>
                                                    {item.artist && item.title && (
                                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest truncate mt-0.5">
                                                            {cleanArtist}
                                                        </p>
                                                    )}
                                                    <div className="flex gap-2 mt-1">
                                                        {item.format && <span className="text-[9px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-gray-400 uppercase font-bold">{item.format}</span>}
                                                        {item.condition && <span className="text-[9px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-gray-400 uppercase font-bold">{item.condition}</span>}
                                                    </div>
                                                </div>
                                                <div className="w-14 h-14 rounded-md overflow-hidden bg-white/5 flex-shrink-0 shadow-sm border border-white/5 group-hover:border-white/10 transition-colors">
                                                    {(item.cover_image || item.image || item.thumbnailUrl) ? (
                                                        <LazyImage
                                                            src={item.cover_image || item.image || item.thumbnailUrl}
                                                            alt=""
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Disc className="w-6 h-6 text-white/10" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* Collapsible Exchange Items Section */}
            {isExchange && items.length > 0 && context !== 'public' && (
                <div className="border-t border-white/5">
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                        className="w-full px-6 py-3 flex items-center justify-between bg-white/[0.01] hover:bg-white/[0.03] transition-colors"
                    >
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                            <Handshake className="w-3 h-3 inline mr-1" /> Detalle del Intercambio ({items.length} ítems)
                        </span>
                        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                        {isExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="px-6 pb-6 pt-2 space-y-4">
                                    {manifestOffered.length > 0 && (
                                        <div className="space-y-2">
                                            <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Ofrece ({manifestOffered.length})
                                            </span>
                                            {manifestOffered.map((item: any, idx: number) => (
                                                <div key={`o-${idx}`} className="flex items-center gap-3 p-2 rounded-xl bg-orange-500/5 border border-orange-500/10">
                                                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/30 flex-shrink-0 border border-orange-500/20">
                                                        {(item.cover_image || item.image || item.thumbnailUrl) ? (
                                                            <LazyImage src={item.cover_image || item.image || item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center"><Disc className="w-4 h-4 text-white/10" /></div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-white truncate uppercase">{item.title || "Sin título"}</p>
                                                        {item.artist && <p className="text-[9px] text-gray-500 uppercase tracking-widest truncate">{item.artist}</p>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {manifestRequested.length > 0 && (
                                        <div className="space-y-2">
                                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Solicita ({manifestRequested.length})
                                            </span>
                                            {manifestRequested.map((item: any, idx: number) => (
                                                <div key={`r-${idx}`} className="flex items-center gap-3 p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/30 flex-shrink-0 border border-emerald-500/20">
                                                        {(item.cover_image || item.image || item.thumbnailUrl) ? (
                                                            <LazyImage src={item.cover_image || item.image || item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center"><Disc className="w-4 h-4 text-white/10" /></div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-white truncate uppercase">{item.title || "Sin título"}</p>
                                                        {item.artist && <p className="text-[9px] text-gray-500 uppercase tracking-widest truncate">{item.artist}</p>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {order.manifest?.cashAdjustment && order.manifest.cashAdjustment !== 0 && (
                                        <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                                                {order.manifest.cashAdjustment > 0 ? "Ajuste (Pagas)" : "Ajuste (Recibes)"}
                                            </span>
                                            <span className={`text-sm font-display font-black ${order.manifest.cashAdjustment > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                {order.manifest.currency === 'USD' ? 'US$' : '$'} {Math.abs(order.manifest.cashAdjustment).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </motion.article>
    );
}
