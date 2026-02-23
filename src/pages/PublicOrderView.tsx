import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc, updateDoc, increment, arrayUnion, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SEO } from "@/components/SEO";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Music, Disc, Lock, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLoading } from "@/context/LoadingContext";
import { formatDate, getReadableDate } from "@/utils/date";
import { TEXTS } from "@/constants/texts";
import { pushViewItemFromOrder } from "@/utils/analytics";

export default function PublicOrderView() {
    const { id } = useParams<{ id: string }>();
    const { user, isAdmin } = useAuth();
    const { showLoading, hideLoading } = useLoading();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const isOwner = user?.uid === order?.user_id;
    const canSeePrice = isAdmin || isOwner;

    useEffect(() => {
        const fetchOrder = async () => {
            if (!id) {
                setLoading(false);
                return;
            }

            // Anti-Timeout 3s (Tarea 4 de Fase 2)
            const timeout = setTimeout(() => {
                if (loading) {
                    console.warn("Safety Timeout Triggered: 3s reached.");
                    setLoading(false);
                    hideLoading();
                }
            }, 3000);

            showLoading(TEXTS.common.locatingBatch);
            try {
                const docRef = doc(db, "orders", id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const orderData = { id: docSnap.id, ...docSnap.data() };
                    setOrder(orderData);

                    // GA4 Tracking
                    pushViewItemFromOrder(orderData);

                    // Tracker de vistas
                    try {
                        const visitorId = user?.uid || (() => {
                            let stored = localStorage.getItem('visitor_id');
                            if (!stored) {
                                stored = 'anon_' + Math.random().toString(36).substring(2, 9);
                                localStorage.setItem('visitor_id', stored);
                            }
                            return stored;
                        })();
                        await updateDoc(docRef, {
                            view_count: increment(1),
                            unique_visitors: arrayUnion(visitorId),
                            last_viewed_at: serverTimestamp()
                        });
                    } catch (e) {
                        console.error("Tracker error:", e);
                    }
                }
            } catch (error) {
                console.error("Error fetching order:", error);
            } finally {
                clearTimeout(timeout);
                setLoading(false);
                hideLoading();
            }
        };

        fetchOrder();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <p className="text-primary font-black uppercase tracking-widest animate-pulse">{TEXTS.common.loadingData}</p>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-4 px-4 text-center">
                <Disc className="w-16 h-16 text-white/20" />
                <h2 className="text-3xl font-display font-black text-white uppercase tracking-tighter">{TEXTS.common.batchNotFound}</h2>
                <p className="text-gray-500 max-w-sm">{TEXTS.common.batchAccessDenied}</p>
                <Link to="/" className="mt-4 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-black uppercase tracking-widest text-xs transition-colors">
                    {TEXTS.common.backToCatalog}
                </Link>
            </div>
        );
    }

    const items = order.isBatch ? (order.items || []) : [
        {
            title: order.details?.artist ? `${order.details.artist} - ${order.details.album}` : (order.title || "Unknown Title"),
            artist: order.details?.artist || order.artist || "Unknown Artist",
            album: order.details?.album || order.title || "Unknown Album",
            cover_image: order.details?.cover_image || order.thumbnailUrl || "https://raw.githubusercontent.com/lucianorodriguezproduce/buscadordiscogs2/refs/heads/main/public/obg.png",
            format: order.details?.format || "N/A",
            condition: order.details?.condition || "N/A",
            intent: order.details?.intent || order.status || "COMPRAR",
        }
    ];

    const generateDescription = () => {
        if (!items || items.length === 0) return TEXTS.common.batchDescription;
        const artists = Array.from(new Set(items.map((i: any) => i.artist || "Varios"))).slice(0, 3);
        const prefix = order.isBatch ? `Lote de ${items.length} ítems.` : TEXTS.common.pieceDescription;
        return `${prefix} Incluye: ${artists.join(", ")}${artists.length < items.length ? " y más" : ""}.`;
    };

    const titleStr = order.isBatch ? `Lote de ${items.length} discos en Oldie but Goldie` : `${order.details?.artist || "Álbum"} - ${order.details?.album || "Desconocido"} en Oldie but Goldie`;

    // Render Schema markup for items
    const schemaMarkup = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": items.map((item: any, index: number) => ({
            "@type": "ListItem",
            "position": index + 1,
            "item": {
                "@type": "MusicRelease",
                "name": item.title || `${item.artist} - ${item.album}`,
                "image": item.cover_image || order.thumbnailUrl,
                "musicReleaseFormat": item.format,
                "offers": {
                    "@type": "Offer",
                    "itemCondition": item.condition
                }
            }
        }))
    };

    return (
        <div className="min-h-screen bg-black pt-12">
            <SEO
                title={titleStr}
                description={generateDescription()}
                image={order.thumbnailUrl}
                url={`https://oldiebutgoldie.com.ar/orden/${id}`}
                schema={schemaMarkup}
                status={order.status}
            />

            <div className="max-w-4xl mx-auto px-4 py-8 md:py-16 space-y-12">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-4">
                        <Link to="/actividad" className="inline-flex items-center gap-2 text-[10px] font-black uppercase text-gray-500 hover:text-white transition-colors">
                            <ChevronLeft className="w-4 h-4" /> {TEXTS.navigation.activity}
                        </Link>
                        <h1 className="text-4xl md:text-5xl font-display font-black text-white hover:text-primary transition-colors tracking-tightest leading-none">
                            {TEXTS.common.batchDetail}
                        </h1>

                        {/* Header — TAREA 2 & 4 */}
                        <div className="flex flex-col gap-1 mt-6">
                            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">ID: {order.id}</p>
                            <p className="text-sm text-gray-400 font-bold uppercase">
                                {TEXTS.profile.date}: {order?.createdAt?.seconds
                                    ? new Date(order.createdAt.seconds * 1000).toLocaleString('es-AR')
                                    : (order?.timestamp?.seconds
                                        ? new Date(order.timestamp.seconds * 1000).toLocaleString('es-AR')
                                        : TEXTS.common.loadingGeneric)}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">
                                    {TEXTS.admin.statusOptions[order.status as keyof typeof TEXTS.admin.statusOptions] || order.status}
                                </span>
                            </div>
                        </div>
                    </div>

                    {order.thumbnailUrl && (
                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden bg-white/5 border border-white/10 shadow-2xl flex-shrink-0">
                            <img
                                src={order.thumbnailUrl}
                                alt="Lote reference"
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                        </div>
                    )}
                </header>

                <div className="space-y-0">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 italic mb-4">
                        {TEXTS.common.itemsInvolved} ({items.length})
                    </h3>

                    {!items || !Array.isArray(items) || items.length === 0 ? (
                        <div className="bg-white/5 border border-dashed border-white/10 rounded-2xl p-12 text-center">
                            <Music className="w-12 h-12 text-white/10 mx-auto mb-4" />
                            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">{TEXTS.common.noDiscsInBatch}</p>
                        </div>
                    ) : (
                        <div className="space-y-0">
                            <AnimatePresence>
                                {items.map((item: any, idx: number) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="border-b border-white/10 py-5 flex flex-col gap-1"
                                    >
                                        <h4 className="font-bold text-white uppercase text-base leading-tight">
                                            {item.title || (item.artist && item.album ? `${item.artist} - ${item.album}` : 'Sin Título')}
                                        </h4>
                                        {item.artist && (
                                            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">{item.artist}</p>
                                        )}
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <span className="bg-gray-800 text-gray-300 px-2 py-1 text-[9px] font-black uppercase rounded">{item.format}</span>
                                            <span className="bg-blue-900/30 text-blue-400 px-2 py-1 text-[9px] font-black uppercase rounded border border-blue-500/20">{item.condition}</span>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>

                {/* Price & Negotiation Visibility (TAREA 4) */}
                <div className="space-y-6 pt-6 border-t border-white/5">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 italic">{TEXTS.common.negotiationSummary}</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Initial Offer / Latest User Offer */}
                        {(() => {
                            const historyUserOffer = order.negotiationHistory?.filter((h: any) => h.sender === 'user').pop();
                            const userPrice = historyUserOffer?.price || order.totalPrice || order.details?.price;
                            const userCurrency = historyUserOffer?.currency || order.currency || order.details?.currency || "ARS";

                            if (!userPrice) return null;

                            return (
                                <div className="p-8 rounded-[2.5rem] bg-orange-500/5 border border-orange-500/10 flex flex-col justify-between group hover:bg-orange-500/10 transition-all">
                                    <p className="text-[10px] uppercase tracking-[0.2em] font-black text-orange-400/70 mb-4">
                                        {historyUserOffer ? TEXTS.common.latestUserOffer : TEXTS.common.initialUserOffer}
                                    </p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-display font-black text-white">
                                            {canSeePrice ? (
                                                `${userCurrency === "USD" ? "US$" : "$"} ${userPrice.toLocaleString()}`
                                            ) : (
                                                <span className="text-gray-700 flex items-center gap-2 italic opacity-40"><Lock className="h-4 w-4" /> {TEXTS.common.private}</span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Admin Counter-Offer */}
                        {(() => {
                            const historyAdminOffer = order.negotiationHistory?.filter((h: any) => h.sender === 'admin').pop();
                            const adminPrice = historyAdminOffer?.price || order.adminPrice;
                            const adminCurrency = historyAdminOffer?.currency || order.adminCurrency || "ARS";

                            if (!adminPrice) return null;

                            return (
                                <div className="p-8 rounded-[2.5rem] bg-primary/10 border border-primary/20 flex flex-col justify-between shadow-2xl shadow-primary/5 group hover:bg-primary/20 transition-all">
                                    <p className="text-[10px] uppercase tracking-[0.2em] font-black text-primary mb-4">
                                        {historyAdminOffer ? TEXTS.common.latestObgOffer : TEXTS.common.obgOffer}
                                    </p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-display font-black text-white">
                                            {canSeePrice ? (
                                                `${adminCurrency === "USD" ? "US$" : "$"} ${adminPrice.toLocaleString()}`
                                            ) : (
                                                <span className="text-gray-700 flex items-center gap-2 italic opacity-40"><Lock className="h-4 w-4" /> {TEXTS.common.private}</span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Metadata Footer */}
                    <div className="p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5 flex flex-col md:flex-row justify-between gap-8 items-start md:items-center">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                                <span className="text-xl text-primary font-black uppercase">{(order.user_name || "C").charAt(0)}</span>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-1">{TEXTS.common.initiatedBy}</p>
                                <p className="text-white text-lg font-black tracking-tight">{order.user_name || TEXTS.common.registeredCollector}</p>
                            </div>
                        </div>

                        <div className="space-y-4 w-full md:w-auto">
                            <div className="flex flex-col md:items-end">
                                <p className="text-[10px] uppercase tracking-widest font-black text-gray-600 mb-2">{TEXTS.common.orderStatus}</p>
                                <span className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border transition-all ${order.status === 'pending_acceptance'
                                    ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                                    : 'bg-white/5 border-white/10 text-white'
                                    }`}>
                                    {order.status === 'pending_acceptance' ? TEXTS.common.waitingAcceptance : (TEXTS.admin.statusOptions[order.status as keyof typeof TEXTS.admin.statusOptions] || order.status)}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 text-gray-700 text-[10px] font-black uppercase tracking-widest md:justify-end">
                                <Clock className="h-3.5 w-3.5" />
                                {getReadableDate(order.createdAt || order.timestamp)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
