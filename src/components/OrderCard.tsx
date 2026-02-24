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
    Share2
} from 'lucide-react';
import { TEXTS } from '@/constants/texts';
import { useAuth } from '@/context/AuthContext';
import type { OrderData } from '@/utils/whatsapp';
import { formatDate, getReadableDate } from '@/utils/date';
import { LazyImage } from '@/components/ui/LazyImage';
import { db } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion, addDoc, serverTimestamp, collection } from 'firebase/firestore';
import { useLoading } from '@/context/LoadingContext';

interface OrderCardProps {
    order: any;
    context: 'admin' | 'public' | 'profile';
    onClick?: () => void;
}

export default function OrderCard({ order, context, onClick }: OrderCardProps) {
    if (!order) return null;

    const orderIntent = (order && (order.intent || order.details?.intent)) ? (order.intent || order.details.intent) : "VENDER";
    const orderStatus = order?.status || 'pending';
    const orderType = order?.type || 'buy';

    const { user, isAdmin } = useAuth();
    const { showLoading, hideLoading } = useLoading();
    const [isExpanded, setIsExpanded] = useState(false);
    const [quickOffer, setQuickOffer] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const lastNegotiation = order.negotiationHistory?.[order.negotiationHistory.length - 1];
    const requiresAction = context === 'admin' && lastNegotiation?.sender === 'user';

    const handleQuickOffer = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const priceVal = parseFloat(quickOffer);
        if (isNaN(priceVal) || priceVal <= 0 || isSubmitting) return;

        setIsSubmitting(true);
        showLoading(TEXTS.admin.updatingStatus);
        try {
            const currency = order.adminCurrency || order.currency || order.details?.currency || "ARS";
            await updateDoc(doc(db, "orders", order.id), {
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
                user_id: order.user_id,
                title: TEXTS.admin.counterOfferReceived,
                message: `Oldie but Goldie propone ${currSymbol} ${priceVal.toLocaleString()} para tu pedido.`,
                read: false,
                timestamp: serverTimestamp(),
                order_id: order.id
            });

            setQuickOffer("");
        } catch (error) {
            console.error("Quick offer error:", error);
        } finally {
            setIsSubmitting(false);
            hideLoading();
        }
    };

    const isOwner = user?.uid === order.user_id;
    const canSeePrice = isAdmin || isOwner || order.is_admin_offer;

    const getStatusBadge = (status: string) => {
        const statusLabel = TEXTS.admin.statusOptions[status as keyof typeof TEXTS.admin.statusOptions] || status;
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
            case 'pending':
            default:
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 backdrop-blur-md">
                        <Clock className="w-3.5 h-3.5 text-yellow-500" />
                        <span className="text-[10px] uppercase tracking-widest font-black text-yellow-500">{statusLabel}</span>
                    </div>
                );
        }
    };

    const isBatch = order.isBatch === true || order.is_batch === true;
    const items = Array.isArray(order.items) ? order.items : [];

    const cleanString = (str: string | undefined | null) => {
        if (!str) return '';
        return str.replace(/UNKNOWN ARTIST\s*[-—–]*\s*/gi, '').trim();
    };

    // 1. RECUPERACIÓN DE IMAGEN (Cover Fetcher)
    const firstItemImage = items.length > 0
        ? (items[0].cover_image || items[0].thumb || items[0].image || items[0].cover || items[0].thumbnailUrl)
        : null;

    // Failsafe logic based on directive
    const coverImage = firstItemImage || order.cover_image || order.thumb || order.image || order.cover || order.thumbnailUrl || order.details?.cover_image || order.imageUrl || "https://raw.githubusercontent.com/lucianorodriguezproduce/buscadordiscogs2/refs/heads/main/public/obg.png";

    // 2. DEPURACIÓN DE TEXTO (Minimalismo)
    const title = isBatch ? `LOTE DE ${items.length} DISCOS` : cleanString(order.details?.album || order.title || items[0]?.title || 'Unknown Title');
    const artist = isBatch ? '' : cleanString(order.details?.artist || order.artist || items[0]?.artist || 'Unknown Artist');

    const isSellerOfferLegacy = order.admin_offer_price || order.adminPrice;
    const intent = isBatch ? (orderType === 'buy' ? TEXTS.badges.buying : TEXTS.badges.forSale) : (orderIntent || (isSellerOfferLegacy ? 'VENDER' : 'COMPRAR'));
    const status = orderStatus;

    const renderPriceOffer = () => {
        const userPrice = order.totalPrice || order.details?.price;
        const userCurrency = order.currency || order.details?.currency || "ARS";
        const isSellOrder = intent.includes("VENDER");

        const historyAdminOffer = order.negotiationHistory?.filter((h: any) => h.sender === 'admin').pop();
        const adminPrice = historyAdminOffer?.price || order.adminPrice;
        const adminCurrency = historyAdminOffer?.currency || order.adminCurrency || "ARS";

        const historyUserOffer = order.negotiationHistory?.filter((h: any) => h.sender === 'user').pop();
        const latestUserPrice = historyUserOffer?.price || userPrice;
        const latestUserCurrency = historyUserOffer?.currency || userCurrency;

        if (!canSeePrice) return null;

        return (
            <div className="flex flex-col gap-2 w-full mt-4">
                {(isSellOrder && latestUserPrice) && (
                    <div className={`bg-orange-500/10 border border-orange-500/20 px-3 py-2 rounded-xl flex flex-col items-end shadow-sm shadow-orange-500/5 ${context === 'admin' ? "mr-4" : ""}`}>
                        <span className="text-[9px] font-black uppercase tracking-widest text-orange-400">
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

                {!adminPrice && order.admin_offer_price && (
                    <div className={`bg-purple-500/10 border border-purple-500/20 px-3 py-2 rounded-xl flex flex-col items-end shadow-sm shadow-purple-500/5 ${context === 'admin' ? "mr-4" : ""}`}>
                        <span className="text-[9px] font-black uppercase tracking-widest text-purple-400">{TEXTS.admin.ourOffer}</span>
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

    // MAIN RENDER - Refactored for Directive [MINIMAL-CATALOG-VISUALS]
    return (
        <motion.article
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={context !== 'public' ? onClick : undefined}
            className={`
                group relative bg-white/[0.02] border rounded-[2rem] overflow-hidden transition-all duration-700
                ${context !== 'public' ? 'cursor-pointer hover:border-white/20' : 'hover:border-white/10'}
                ${isHot ? "border-orange-500/50 shadow-[0_0_30px_rgba(249,115,22,0.1)]" : "border-white/5"}
            `}
        >
            {/* 3. ESTÉTICA DE TARJETA - Imagen superior full space */}
            <div className="p-6 space-y-6">
                <div className="aspect-square w-full relative rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10">
                    <div className="relative overflow-hidden h-full w-full" style={{ aspectRatio: '1 / 1' }}>
                        <div className="animate-pulse rounded-md bg-white/5 absolute inset-0 w-full h-full rounded-inherit"></div>
                        <LazyImage
                            src={coverImage}
                            alt={title}
                            className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-700"
                        />
                    </div>
                    {/* Overlay al hacer hover */}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                    {/* Share Button Overlay */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (navigator.share) {
                                navigator.share({
                                    title: `Oldie But Goldie - ${title}`,
                                    text: '¡Mira esta joya que encontré en Oldie But Goldie!',
                                    url: `https://www.oldiebutgoldie.com.ar/orden/${order.id}`
                                }).catch(console.error);
                            } else {
                                navigator.clipboard.writeText(`https://www.oldiebutgoldie.com.ar/orden/${order.id}`);
                                alert('Enlace copiado al portapapeles');
                            }
                        }}
                        className="absolute top-4 right-4 p-2.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0"
                    >
                        <Share2 className="w-4 h-4" />
                    </button>
                </div>

                {/* Content Section - Minimalismo */}
                <div className="space-y-4 text-left">
                    <div className="min-h-[3.5rem]">
                        <h3 className="text-xl font-display font-black text-white uppercase tracking-tight leading-none line-clamp-2 group-hover:text-yellow-400 transition-colors">
                            {title}
                        </h3>
                        {/* 2. DEPURACIÓN DE TEXTO - Condicionalmente removemos el artista para lotes o según directiva */}
                        {artist && !isBatch && context !== 'public' && (
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">
                                {artist}
                            </p>
                        )}
                        {/* Indicador de Lote en vista pública si es necesario, pero minimalista */}
                        {isBatch && (
                            <div className="flex items-center gap-1.5 mt-1.5 opacity-60">
                                <ShoppingBag className="w-3 h-3 text-gray-400" />
                                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                                    Contenido verificado
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-0.5">
                                Precio de Colección
                            </span>
                            <span className="text-lg font-display font-black text-white">
                                {canSeePrice ? (
                                    `${(order.details?.currency || order.currency) === "USD" ? "US$" : "$"} ${((order.details?.price || order.totalPrice) || 0).toLocaleString()}`
                                ) : (
                                    <span className="text-gray-700 italic text-[10px]">{TEXTS.common.private}</span>
                                )}
                            </span>
                        </div>

                        {/* Action Icon / Button */}
                        <div className="p-3 bg-white/5 group-hover:bg-yellow-500 group-hover:text-black rounded-full transition-all border border-white/5 group-hover:border-yellow-500 shadow-xl">
                            <ChevronRight className="h-5 w-5" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Admin/Internal Overlay Info - Floating and Subtle */}
            {context !== 'public' && (
                <div className="absolute top-2 left-2 flex flex-col gap-1 pointer-events-none">
                    {order.order_number && (
                        <span className="bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-mono text-gray-400 border border-white/5">
                            #{order.order_number}
                        </span>
                    )}
                    {getStatusBadge(status)}
                </div>
            )}
        </motion.article>
    );
}
