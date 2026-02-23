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
    Hash
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { OrderData } from '@/utils/whatsapp';
import { formatDate, getReadableDate } from '@/utils/date';

interface OrderCardProps {
    order: any; // Using any or an extended OrderData to catch legacy fields without crashing
    context: 'admin' | 'public' | 'profile';
    onClick?: () => void;
}

export default function OrderCard({ order, context, onClick }: OrderCardProps) {
    const { user, isAdmin } = useAuth();
    const [isExpanded, setIsExpanded] = useState(false);

    // Ownership check for privacy
    const isOwner = user?.uid === order.user_id;
    const canSeePrice = isAdmin || isOwner;


    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'sold':
            case 'completed':
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 backdrop-blur-md">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-[10px] uppercase tracking-widest font-black text-green-500">Completado</span>
                    </div>
                );
            case 'quoted':
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 backdrop-blur-md">
                        <BadgeDollarSign className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-[10px] uppercase tracking-widest font-black text-purple-400">Cotizado</span>
                    </div>
                );
            case 'negotiating':
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 backdrop-blur-md">
                        <Handshake className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-[10px] uppercase tracking-widest font-black text-blue-400">En Negociación</span>
                    </div>
                );
            case 'cancelled':
            case 'rejected':
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 backdrop-blur-md">
                        <XCircle className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-[10px] uppercase tracking-widest font-black text-red-500">Cancelado</span>
                    </div>
                );
            case 'pending':
            default:
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 backdrop-blur-md">
                        <Clock className="w-3.5 h-3.5 text-yellow-500" />
                        <span className="text-[10px] uppercase tracking-widest font-black text-yellow-500">Pendiente</span>
                    </div>
                );
        }
    };

    // Safe Data Extraction
    const isBatch = order.isBatch === true;
    const items = isBatch && Array.isArray(order.items) ? order.items : [];

    // Extracción tolerante a fallas para órdenes V1
    const coverImage = order.thumbnailUrl || order.details?.cover_image || order.imageUrl || "https://raw.githubusercontent.com/lucianorodriguezproduce/buscadordiscogs2/refs/heads/main/public/obg.png";
    const title = isBatch ? `Lote de ${items.length} discos` : (order.details?.album || order.title || 'Unknown Title');
    const artist = isBatch ? 'Múltiples Artistas' : (order.details?.artist || order.artist || 'Unknown Artist');
    const intent = isBatch ? (order.type === 'buy' ? 'COMPRAR LOTE' : 'VENDER LOTE') : (order.details?.intent || order.intent || 'COMPRAR');
    const format = isBatch ? 'Varios Formatos' : (order.details?.format || 'N/A');
    const condition = isBatch ? 'Varias Condiciones' : (order.details?.condition || 'N/A');
    const status = order.status || 'pending';

    const renderPriceOffer = () => {
        // 1. OFERTA DEL VENDEDOR (From User)
        // If it's a VENDER (Sell) order, the user's price is their bid.
        const userPrice = order.totalPrice || order.details?.price;
        const userCurrency = order.currency || order.details?.currency || "ARS";
        const isSellOrder = intent.includes("VENDER");

        // 2. CONTRAOFERTA (From Admin)
        // This is the new adminPrice field for negotiation.
        const adminPrice = order.adminPrice;
        const adminCurrency = order.adminCurrency || "ARS";

        if (!canSeePrice) return null;

        return (
            <div className="flex flex-col gap-2 w-full mt-4">
                {isSellOrder && userPrice && (
                    <div className={`bg-orange-500/10 border border-orange-500/20 px-3 py-2 rounded-xl flex flex-col items-end shadow-sm shadow-orange-500/5 ${context === 'admin' ? "mr-4" : ""}`}>
                        <span className="text-[9px] font-black uppercase tracking-widest text-orange-400">Oferta del Vendedor</span>
                        <span className="text-sm font-black text-white">
                            {userCurrency === "USD" ? "US$" : "$"} {userPrice.toLocaleString()}
                        </span>
                    </div>
                )}

                {adminPrice && (
                    <div className={`bg-primary/10 border border-primary/20 px-3 py-2 rounded-xl flex flex-col items-end shadow-sm shadow-primary/5 ${context === 'admin' ? "mr-4" : ""}`}>
                        <span className="text-[9px] font-black uppercase tracking-widest text-primary">Contraoferta de OBG</span>
                        <span className="text-sm font-black text-white">
                            {adminCurrency === "USD" ? "US$" : "$"} {adminPrice.toLocaleString()}
                        </span>
                    </div>
                )}

                {/* Legacy admin_offer_price for backward compatibility */}
                {!adminPrice && order.admin_offer_price && (
                    <div className={`bg-purple-500/10 border border-purple-500/20 px-3 py-2 rounded-xl flex flex-col items-end shadow-sm shadow-purple-500/5 ${context === 'admin' ? "mr-4" : ""}`}>
                        <span className="text-[9px] font-black uppercase tracking-widest text-purple-400">Nuestra Oferta</span>
                        <span className="text-sm font-black text-white">
                            {order.admin_offer_currency === "USD" ? "US$" : "$"} {order.admin_offer_price.toLocaleString()}
                        </span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={context !== 'public' ? onClick : undefined}
            className={`
                group relative bg-white/[0.02] border rounded-[1.5rem] overflow-hidden transition-all duration-300
                ${context !== 'public' ? 'cursor-pointer hover:border-primary/30' : 'hover:border-white/10'}
                ${order.admin_offer_price ? "border-purple-500/20" : "border-white/5"}
            `}
        >
            {/* Context Badge Corner */}
            {context === 'admin' && order.user_email && (
                <div className="absolute top-0 right-0 px-3 py-1 bg-white/5 rounded-bl-xl border-b border-l border-white/10 text-[9px] text-gray-500 font-mono hidden md:block">
                    {order.user_email}
                </div>
            )}

            <div className="p-4 md:p-6 lg:p-8 flex flex-col lg:flex-row items-start lg:items-center gap-6">

                {/* Image Section */}
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden bg-black/50 flex-shrink-0 border border-white/10 group-hover:border-primary/20 transition-all relative">
                    {coverImage ? (
                        <img
                            src={coverImage}
                            alt={title}
                            className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500"
                            loading="lazy"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Music className="w-8 h-8 text-white/10" />
                        </div>
                    )}
                    {isBatch && (
                        <div className="absolute bottom-1 right-1 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 text-[10px] font-bold text-white flex items-center gap-1">
                            <ShoppingBag className="w-3 h-3" /> {items.length}
                        </div>
                    )}
                </div>

                {/* Details Section */}
                <div className="flex-1 min-w-0 space-y-3 w-full">
                    {order.order_number && (
                        <span className="inline-flex items-center gap-1.5 text-[9px] font-mono font-bold text-gray-500 uppercase tracking-wider">
                            <Hash className="h-3 w-3" /> {order.order_number}
                        </span>
                    )}

                    <h4 className={`text-lg md:text-xl font-display font-black text-white uppercase tracking-tight truncate ${context !== 'public' ? 'group-hover:text-primary transition-colors' : ''}`}>
                        {artist} — <span className="text-gray-400">{title}</span>
                    </h4>

                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
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
                        {!isBatch && order.details?.price && (
                            <span className="flex items-center gap-1 text-primary text-xs md:text-sm font-black">
                                <DollarSign className="h-3.5 w-3.5" />
                                {canSeePrice ? (
                                    `${order.details.currency === "USD" ? "US$" : "$"} ${order.details.price.toLocaleString()}`
                                ) : (
                                    <span className="text-gray-600 italic opacity-50">Privado</span>
                                )}
                            </span>
                        )}
                    </div>

                    {/* Time & Public Link Line */}
                    <div className="flex items-center justify-between pt-2">
                        <span className="text-[10px] text-gray-600 font-bold flex items-center gap-1.5 uppercase font-mono">
                            <Clock className="w-3.5 h-3.5" /> {getReadableDate(order.createdAt || order.timestamp)}
                        </span>
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
                <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-start w-full lg:w-auto mt-4 lg:mt-0 gap-4 flex-shrink-0 border-t border-white/5 lg:border-t-0 pt-4 lg:pt-0">
                    <div className="flex flex-col items-end gap-3">
                        {getStatusBadge(status)}
                    </div>
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
                                    {(items || []).map((item: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5">
                                                    {item.cover_image && (
                                                        <img
                                                            src={item.cover_image}
                                                            className="w-full h-full object-cover"
                                                            loading="lazy"
                                                        />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-white truncate max-w-[150px] md:max-w-xs">{item.artist || 'Unknown'} - {item.album || 'Unknown'}</p>
                                                    <p className="text-[9px] text-gray-500 uppercase">{item.format || '?'} • {item.condition || '?'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </motion.div>
    );
}
