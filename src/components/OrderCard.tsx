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
    order: any; // Using any or an extended OrderData to catch legacy fields without crashing
    context: 'admin' | 'public' | 'profile';
    onClick?: () => void;
}

export default function OrderCard({ order, context, onClick }: OrderCardProps) {
    if (!order) return null;

    // Extracción tolerante a fallas para órdenes V1
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

    // Ownership check for privacy
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

    // Frontend Shield: Limpieza en tiempo de renderizado
    const cleanString = (str: string | undefined | null) => {
        if (!str) return '';
        // Reemplaza UNKNOWN ARTIST - o — o directamente UNKNOWN ARTIST
        return str.replace(/UNKNOWN ARTIST\s*[-—–]*\s*/gi, '').trim();
    };

    // Si es un lote (más de 1 item)
    const itemsCount = items.length;
    const isBatchDetected = itemsCount > 1;

    const firstItemImage = items.length > 0 ? (items[0].cover_image || items[0].thumb || items[0].image || items[0].cover || items[0].thumbnailUrl) : null;
    const coverImage = (isBatchDetected && firstItemImage)
        ? firstItemImage
        : (order.cover_image || order.thumb || order.image || order.cover || order.thumbnailUrl || order.details?.cover_image || order.imageUrl || "https://raw.githubusercontent.com/lucianorodriguezproduce/buscadordiscogs2/refs/heads/main/public/obg.png");

    // Tarea Singular-Logic-Only: Título dinámico
    const title = isBatchDetected
        ? `LOTE DE ${itemsCount} DISCOS`
        : cleanString(order.details?.album || order.title || items[0]?.title || 'Disco Registrado');
    const artist = isBatchDetected ? '' : cleanString(order.details?.artist || order.artist || items[0]?.artist || 'Unknown Artist');

    // Fallback intent for legacy admin orders
    const isSellerOfferLegacy = order.admin_offer_price || order.adminPrice;
    const intent = isBatchDetected ? (orderType === 'buy' ? TEXTS.badges.buying : TEXTS.badges.forSale) : (orderIntent || (isSellerOfferLegacy ? 'VENDER' : 'COMPRAR'));
    const format = isBatchDetected ? 'Varios Formatos' : (order.details?.format || 'N/A');
    const condition = isBatchDetected ? 'Varias Condiciones' : (order.details?.condition || 'N/A');
    const status = orderStatus;

    const renderPriceOffer = () => {
        // 1. OFERTA DEL VENDEDOR (From User)
        // If it's a VENDER (Sell) order, the user's price is their bid.
        const userPrice = order.totalPrice || order.details?.price;
        const userCurrency = order.currency || order.details?.currency || "ARS";
        const isSellOrder = intent.includes("VENDER");

        // 2. CONTRAOFERTA (From Admin)
        // This is the new adminPrice field for negotiation.
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

                {/* Legacy admin_offer_price for backward compatibility */}
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

    return (
        <motion.article
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={context !== 'public' ? onClick : undefined}
            aria-label={`${intent}: ${artist} - ${title}`}
            className={`
                group relative bg-white/[0.02] border rounded-[1.5rem] overflow-hidden transition-all duration-300
                ${context !== 'public' ? 'cursor-pointer hover:border-primary/30' : 'hover:border-white/10'}
                ${isHot ? "border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.15)]" : (order.admin_offer_price ? "border-purple-500/20" : "border-white/5")}
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
                                url: `https://www.oldiebutgoldie.com.ar/orden/${order.id}`
                            }).catch(console.error);
                        } else {
                            navigator.clipboard.writeText(`https://www.oldiebutgoldie.com.ar/orden/${order.id}`);
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
                        {(isBatch || order.is_admin_offer) && (
                            order.is_admin_offer || order.user_id === 'oldiebutgoldie' || order.user_email === 'admin@discography.ai' ? (
                                <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-500/20 to-yellow-700/20 border border-yellow-500/50 text-yellow-500 text-[9px] font-black uppercase tracking-widest shadow-[0_0_10px_rgba(234,179,8,0.2)]">
                                    {TEXTS.badges.storeObg}
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/30 text-slate-400 text-[9px] font-black uppercase tracking-widest">
                                    {TEXTS.badges.user_label}
                                </span>
                            )
                        )}
                    </div>

                    <div className="flex flex-col">
                        <h3 className={`text-xl md:text-2xl font-display font-black text-white uppercase tracking-tight truncate ${context !== 'public' ? 'group-hover:text-primary transition-colors' : ''}`}>
                            {title}
                        </h3>
                        {!isBatchDetected && artist && artist !== 'Unknown Artist' && (
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest truncate mt-0.5">
                                {artist}
                            </h4>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-1">
                        <span className={`px-2 md:px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${intent.includes("COMPRAR") ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                            }`}>
                            {intent}
                        </span>
                        {!isBatch && (
                            <>
                                <span className="flex items-center gap-1 text-gray-500 text-[9px] md:text-[10px] font-black uppercase">
                                    <Tag className="h-3 w-3" /> {format}
                                </span>
                                <span className="text-gray-600 text-[9px] md:text-[10px] font-bold uppercase">{condition}</span>
                            </>
                        )}

                        {/* Premium Price Badge */}
                        {(order.details?.price || order.totalPrice) && (
                            <span className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-lg text-xs md:text-sm font-black shadow-sm shadow-primary/5 ml-auto md:ml-2">
                                <DollarSign className="h-4 w-4" />
                                {canSeePrice ? (
                                    `${(order.details?.currency || order.currency) === "USD" ? "US$" : "$"} ${((order.details?.price || order.totalPrice) || 0).toLocaleString()}`
                                ) : (
                                    <span className="text-primary/50 italic text-[10px]">{TEXTS.common.private}</span>
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
                        <Link
                            to={`/orden/${order.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`px-3 py-1.5 border rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-2
                                ${context === 'public' ? 'bg-white/5 hover:bg-white/10 text-white border-white/10' : 'bg-transparent hover:bg-white/5 text-gray-400 border-transparent hover:border-white/10'}
                            `}
                        >
                            <Search className="w-3 h-3" /> Ver Detalle Público
                        </Link>
                    </div>
                </div>

                {/* Right Status Panel */}
                <div className="flex flex-col w-full lg:w-auto mt-4 lg:mt-0 gap-3 md:gap-4 flex-shrink-0 border-t border-white/5 lg:border-t-0 pt-4 lg:pt-0">
                    <div className="flex w-full justify-start lg:justify-end">
                        {getStatusBadge(status)}
                    </div>

                    {/* Direct Buy Button for Public Feed */}
                    {context === 'public' && order.is_admin_offer && status !== 'completed' && status !== 'venta_finalizada' && status !== 'cancelled' && (
                        <Link
                            to={`/orden/${order.id}?action=buy`}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full px-6 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black uppercase tracking-widest text-[11px] md:text-sm rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-all text-center lg:mt-auto"
                        >
                            ¡COMPRAR!
                        </Link>
                    )}

                    {/* QuickOffer Component for Admins - Minimalist & Validated */}
                    {context === 'admin' && status !== 'completed' && status !== 'venta_finalizada' && (
                        <div className="flex items-center gap-1.5 mt-auto group/quick" onClick={(e) => e.stopPropagation()}>
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
        </motion.article>
    );
}
