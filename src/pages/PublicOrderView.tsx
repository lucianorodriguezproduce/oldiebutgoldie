import { useState, useEffect } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { doc, getDoc, updateDoc, increment, arrayUnion, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { SEO } from "@/components/SEO";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Music, Disc, Lock, Clock, Eye, ChevronDown, Share2, ChevronRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLoading } from "@/context/LoadingContext";
import { formatDate, getReadableDate } from "@/utils/date";
import { TEXTS } from "@/constants/texts";
import { pushViewItemFromOrder, pushHotOrderDetected } from "@/utils/analytics";

export default function PublicOrderView() {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const { user, isAdmin } = useAuth();
    const { showLoading, hideLoading } = useLoading();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isItemsExpanded, setIsItemsExpanded] = useState(false);

    const isOwner = user?.uid === order?.user_id;
    const isAdminOrder = order?.user_id === "oldiebutgoldie" || order?.user_email === "admin@discography.ai";
    const canSeePrice = isAdmin || isOwner || isAdminOrder;

    const [offerAmount, setOfferAmount] = useState<string>("");
    const [showOfferInput, setShowOfferInput] = useState(false);
    const [showLoginDrawer, setShowLoginDrawer] = useState(false);

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
                    const orderData = { id: docSnap.id, ...docSnap.data() } as any;
                    setOrder(orderData);

                    // GA4 Tracking
                    pushViewItemFromOrder(orderData);

                    if (orderData.view_count === 4) {
                        pushHotOrderDetected(orderData, 5);
                    }

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

    // Handle incoming buy intents via URL params
    useEffect(() => {
        if (!loading && order && searchParams.get('action') === 'buy') {
            if (!user) {
                setShowLoginDrawer(true);
            } else if (order.status !== 'venta_finalizada') {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }
        }
    }, [loading, order, searchParams, user]);

    const handleBuyNow = async () => {
        if (!user) {
            setShowLoginDrawer(true);
            return;
        }
        if (!id) return;
        showLoading("Confirmando compra...");
        try {
            await updateDoc(doc(db, "orders", id), {
                status: "venta_finalizada",
                purchased_by: user.uid,
                buyer_uid: user.uid,
                user_id: user.uid,
                original_admin: "oldiebutgoldie",
                buyer_email: user.email,
                buyer_name: user.displayName || "Usuario",
                confirmedAt: serverTimestamp(),
                negotiationHistory: arrayUnion({
                    price: order.adminPrice || order.totalPrice || order.details?.price || 0,
                    currency: order.adminCurrency || order.currency || order.details?.currency || "ARS",
                    sender: "user",
                    timestamp: new Date(),
                    message: `Orden aceptada por ${user.displayName || user.email} `
                })
            });

            if (order.is_admin_offer) {
                await addDoc(collection(db, "notifications"), {
                    userId: "oldiebutgoldie", // Target the master admin
                    orderId: id,
                    title: "¡Vendido!",
                    message: `El usuario ${user.displayName || user.email || 'Usuario'} ha comprado el ${order.isBatch || order.is_batch ? 'lote' : 'vinilo'} "${order.title || 'Sin Título'}".`,
                    type: "sale_completed",
                    read: false,
                    createdAt: serverTimestamp(),
                    sender_email: user.email,
                    sender_name: user.displayName || "Usuario",
                });
            }

            setOrder((prev: any) => ({ ...prev, status: "venta_finalizada" }));
        } catch (error) {
            console.error("Buy error:", error);
            alert("Hubo un error al procesar tu compra. Por favor intenta nuevamente o contáctanos por WhatsApp.");
        } finally {
            hideLoading();
        }
    };

    const handleMakeOffer = async () => {
        if (!user) {
            setShowLoginDrawer(true);
            return;
        }
        if (!id) return;
        const offerVal = parseFloat(offerAmount);
        if (isNaN(offerVal) || offerVal <= 0) return;

        showLoading("Enviando oferta...");
        try {
            const currentCurrency = order.adminCurrency || order.currency || order.details?.currency || "ARS";
            await updateDoc(doc(db, "orders", id), {
                totalPrice: offerVal,
                status: "contraoferta_usuario",
                buyer_uid: user.uid,
                user_id: user.uid, // Mutate ownership so it appears in Profile
                original_admin: "oldiebutgoldie", // Track the creator
                buyer_email: user.email,
                buyer_name: user.displayName || "Usuario",
                confirmedAt: serverTimestamp(),
                negotiationHistory: arrayUnion({
                    price: offerVal,
                    currency: currentCurrency,
                    sender: "user",
                    timestamp: new Date(),
                    message: `Contraoferta de ${user.displayName || user.email} `
                })
            });
            setOrder((prev: any) => ({
                ...prev,
                totalPrice: offerVal,
                status: "contraoferta_usuario",
                negotiationHistory: [...(prev.negotiationHistory || []), {
                    price: offerVal,
                    currency: currentCurrency,
                    sender: "user",
                    timestamp: new Date(),
                    message: `Contraoferta de ${user.displayName || user.email} `
                }]
            }));
            setShowOfferInput(false);
        } catch (error) {
            console.error("Offer error:", error);
            alert("Hubo un error al enviar tu oferta.");
        } finally {
            hideLoading();
        }
    };

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

    const isBatch = order.isBatch === true || order.is_batch === true;

    const items = isBatch ? (order.items || []) : [
        {
            title: order.details?.artist ? `${order.details.artist} - ${order.details.album} ` : (order.title || "Unknown Title"),
            artist: order.details?.artist || order.artist || "Unknown Artist",
            album: order.details?.album || order.title || "Unknown Album",
            cover_image: order.details?.cover_image || order.thumbnailUrl || "https://raw.githubusercontent.com/lucianorodriguezproduce/buscadordiscogs2/refs/heads/main/public/obg.png",
            format: order.details?.format || "N/A",
            condition: order.details?.condition || "N/A",
            intent: order.details?.intent || order.intent || (order.adminPrice || order.admin_offer_price ? "VENDER" : "COMPRAR"),
            label: order.details?.label || order.label,
            country: order.details?.country || order.country,
            year: order.details?.year || order.year,
            genre: order.details?.genre?.length ? order.details.genre.join(", ") : (order.genre?.length ? order.genre.join(", ") : undefined),
        }
    ];

    const generateDescription = () => {
        if (!items || items.length === 0) return TEXTS.common.batchDescription;
        const artists = Array.from(new Set(items.map((i: any) => i.artist || "Varios"))).slice(0, 3);
        const prefix = isBatch ? `Lote de ${items.length} ítems.` : TEXTS.common.pieceDescription;
        return `${prefix} Incluye: ${artists.join(", ")}${artists.length < items.length ? " y más" : ""}.`;
    };

    const titleStr = isBatch ? `Lote de ${items.length} discos en Oldie but Goldie` : `${order.details?.artist || "Álbum"} - ${order.details?.album || "Desconocido"} en Oldie but Goldie`;

    // Render Schema markup for items
    const schemaMarkup = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": items.map((item: any, index: number) => ({
            "@type": "ListItem",
            "position": index + 1,
            "item": {
                "@type": "MusicRelease",
                "name": item.title || `${item.artist} - ${item.album} `,
                "image": item.cover_image || order.thumbnailUrl,
                "musicReleaseFormat": item.format,
                "offers": {
                    "@type": "Offer",
                    "itemCondition": item.condition
                }
            }
        }))
    };

    const timestamp = new Date().getTime();
    const ogImage = items.length > 0 && items[0].cover_image
        ? `${items[0].cover_image}${items[0].cover_image.includes('?') ? '&' : '?'}v=${timestamp}`
        : `${order.thumbnailUrl}${order.thumbnailUrl?.includes('?') ? '&' : '?'}v=${timestamp}`;

    return (
        <div className="min-h-screen bg-black pt-12">
            <SEO
                title={titleStr}
                description={generateDescription()}
                image={ogImage}
                url={`https://www.oldiebutgoldie.com.ar/orden/${id}`}
                schema={schemaMarkup}
                status={order.status}
            />

            <div className="max-w-4xl mx-auto px-4 pt-8 pb-32 md:py-16 space-y-12">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-4 w-full">
                        {isAdminOrder && order.status === 'pending' && (
                            <div className="flex w-full items-center justify-between mb-4 mt-2">
                                <Link
                                    to="/actividad"
                                    className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors group"
                                >
                                    <ChevronRight className="h-5 w-5 md:h-6 md:w-6 rotate-180 group-hover:-translate-x-1 transition-transform" />
                                    <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">{TEXTS.navigation.activity}</span>
                                </Link>
                                <span className="bg-yellow-500/10 text-yellow-500 text-[8px] md:text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-lg shadow-yellow-500/10 border border-yellow-500/20">
                                    {TEXTS.activity.availableNow}
                                </span>
                            </div>
                        )}

                        <div className="flex items-center gap-4 flex-wrap">
                            <h1 className={`text-4xl md:text-5xl font-display font-black tracking-tightest leading-none transition-colors ${isAdminOrder ? 'bg-gradient-to-r from-yellow-200 via-yellow-500 to-yellow-700 bg-clip-text text-transparent drop-shadow-xl' : 'text-white hover:text-primary'}`}>
                                {TEXTS.common.batchDetail}
                            </h1>
                            <button
                                onClick={() => {
                                    if (navigator.share) {
                                        navigator.share({
                                            title: titleStr,
                                            text: TEXTS.item.share,
                                            url: `https://oldiebutgoldie.com.ar/orden/${id}`
                                        }).catch(console.error);
                                    } else {
                                        navigator.clipboard.writeText(`https://oldiebutgoldie.com.ar/orden/${id}`);
                                        alert('Enlace copiado al portapapeles');
                                    }
                                }}
                                className="p-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-all flex-shrink-0 border border-white/5"
                                title="Compartir Lote"
                            >
                                <Share2 className="w-5 h-5 md:w-6 md:h-6" />
                            </button>
                        </div>

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
                        <div className={`w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden bg-white/5 border shadow-2xl flex-shrink-0 ${isAdminOrder ? 'border-yellow-500/50 shadow-yellow-500/20 scale-110 md:w-48 md:h-48' : 'border-white/10'}`}>
                            <img
                                src={isAdminOrder ? (order.imageUrl || order.details?.cover_image || order.thumbnailUrl) : order.thumbnailUrl}
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
                                {(isItemsExpanded ? items : items.slice(0, 3)).map((item: any, idx: number) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="border-b border-white/10 py-5 flex items-center justify-between gap-4"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-white uppercase text-base leading-tight truncate">
                                                {item.title || (item.artist && item.album ? `${item.artist} - ${item.album}` : 'Sin Título')}
                                            </h4>
                                            {item.artist && (
                                                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest truncate">{item.artist}</p>
                                            )}

                                            {isAdminOrder && item.condition && (
                                                <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-gray-400">
                                                    <span className="text-yellow-500/70">Media: {item.condition.split('/')[0] || item.condition}</span>
                                                    {item.condition.includes('/') && <span className="text-gray-600">|</span>}
                                                    {item.condition.includes('/') && <span className="text-yellow-500/70">Cover: {item.condition.split('/')[1]}</span>}
                                                </div>
                                            )}

                                            <div className="flex flex-wrap gap-2 mt-2">
                                                <span className="bg-gray-800 text-gray-300 px-2 py-1 text-[9px] font-black uppercase rounded">{item.format}</span>
                                                {!isAdminOrder && <span className="bg-blue-900/30 text-blue-400 px-2 py-1 text-[9px] font-black uppercase rounded border border-blue-500/20">{item.condition}</span>}
                                            </div>

                                            {/* Ficha Técnica */}
                                            {(item.label || item.country || item.year || item.genre) && (
                                                <details className="mt-3 group cursor-pointer">
                                                    <summary className="text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors outline-none flex items-center gap-1 w-max">
                                                        {TEXTS.details.technicalSheet} <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
                                                    </summary>
                                                    <div className="mt-2 grid grid-cols-2 gap-2 p-3 bg-white/5 rounded-xl border border-white/5 text-[10px]">
                                                        {item.label && <div className="flex flex-col min-w-0"><span className="text-gray-600 uppercase font-black tracking-widest text-[8px]">{TEXTS.details.label}</span><span className="text-white font-bold truncate">{item.label}</span></div>}
                                                        {item.year && <div className="flex flex-col min-w-0"><span className="text-gray-600 uppercase font-black tracking-widest text-[8px]">{TEXTS.details.year}</span><span className="text-white font-bold truncate">{item.year}</span></div>}
                                                        {item.country && <div className="flex flex-col min-w-0"><span className="text-gray-600 uppercase font-black tracking-widest text-[8px]">{TEXTS.details.country}</span><span className="text-white font-bold truncate">{item.country}</span></div>}
                                                        {item.genre && <div className="flex flex-col min-w-0"><span className="text-gray-600 uppercase font-black tracking-widest text-[8px]">{TEXTS.details.genre}</span><span className="text-white font-bold truncate">{item.genre}</span></div>}
                                                    </div>
                                                </details>
                                            )}
                                        </div>
                                        <div className="w-14 h-14 rounded-md overflow-hidden bg-white/5 border border-white/10 flex-shrink-0 shadow-sm">
                                            <img
                                                src={item.cover_image || item.image || item.thumb || "https://raw.githubusercontent.com/lucianorodriguezproduce/buscadordiscogs2/refs/heads/main/public/obg.png"}
                                                alt={item.title || "Item"}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {items.length > 3 && (
                                <button
                                    onClick={() => setIsItemsExpanded(!isItemsExpanded)}
                                    className="w-full mt-4 py-3 border border-white/10 rounded-xl text-gray-400 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 hover:text-white transition-all flex items-center justify-center gap-2"
                                >
                                    {isItemsExpanded ? TEXTS.details.showLess : `${TEXTS.details.showAll} (+${items.length - 3})`}
                                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isItemsExpanded ? 'rotate-180' : ''}`} />
                                </button>
                            )}
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

                    {/* Transactional Action Buttons & Ownership Shields */}
                    {isAdminOrder && (() => {
                        const isSold = ['venta_finalizada', 'completed'].includes(order.status);
                        const isNegotiating = ['contraoferta_usuario', 'negotiating', 'quoted'].includes(order.status);

                        if (isSold) {
                            return (
                                <div className="mt-8 p-6 md:p-8 bg-red-500/10 border border-red-500/30 rounded-[2.5rem] flex items-center justify-center shadow-inner">
                                    <h4 className="text-2xl md:text-3xl font-display font-black text-red-500 uppercase tracking-tightest">Vendido</h4>
                                </div>
                            );
                        }

                        if (isNegotiating && !isOwner && !isAdmin) {
                            return (
                                <div className="mt-8 p-6 md:p-8 bg-blue-500/10 border border-blue-500/30 rounded-[2.5rem] flex items-center justify-center shadow-inner">
                                    <h4 className="text-2xl md:text-3xl font-display font-black text-blue-500 uppercase tracking-tightest">En Negociación</h4>
                                </div>
                            );
                        }

                        if (!['cancelled'].includes(order.status)) {
                            return (
                                <div className="fixed bottom-0 left-0 right-0 z-[100] md:static mt-0 md:mt-8 p-4 md:p-8 bg-black/90 md:bg-gradient-to-br md:from-yellow-500/10 md:to-orange-600/10 border-t md:border border-white/10 md:border-yellow-500/30 md:rounded-[2.5rem] flex flex-col md:flex-row items-center gap-4 md:gap-6 justify-between shadow-[0_-20px_40px_rgba(0,0,0,0.5)] md:shadow-[0_0_30px_rgba(234,179,8,0.1)] backdrop-blur-md md:backdrop-blur-none transition-all">
                                    <div className="hidden md:block space-y-2 text-left">
                                        <h4 className="text-xl font-display font-black text-white uppercase tracking-tight">Adquirir Coleccionable</h4>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Asegura esta pieza antes que otro coleccionista</p>
                                    </div>

                                    {user ? (
                                        <div className="flex flex-row w-full md:w-auto gap-2 md:gap-4">
                                            {showOfferInput ? (
                                                <div className="flex items-center gap-2 bg-black/40 p-2 rounded-2xl border border-white/10 flex-1 md:flex-none">
                                                    <span className="text-gray-500 font-bold pl-2 md:pl-3">$</span>
                                                    <input
                                                        type="number"
                                                        placeholder="Oferta"
                                                        value={offerAmount}
                                                        onChange={(e) => setOfferAmount(e.target.value)}
                                                        className="bg-transparent border-none text-white font-black w-20 md:w-24 focus:ring-0 outline-none placeholder:text-gray-600 text-xs md:text-sm"
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={handleMakeOffer}
                                                        disabled={!offerAmount}
                                                        className="px-3 md:px-4 py-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black font-black uppercase tracking-widest text-[9px] md:text-[10px] rounded-xl transition-all"
                                                    >
                                                        Enviar
                                                    </button>
                                                    <button
                                                        onClick={() => setShowOfferInput(false)}
                                                        className="px-2 md:px-3 py-2 text-gray-500 hover:text-white transition-colors"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setShowOfferInput(true)}
                                                    className="px-4 md:px-6 py-3 md:py-4 rounded-2xl border border-yellow-500/30 text-yellow-500 font-black uppercase tracking-widest text-[9px] md:text-[10px] hover:bg-yellow-500/10 transition-all text-center flex-1 md:flex-none whitespace-nowrap"
                                                >
                                                    Regatear
                                                </button>
                                            )}

                                            <button
                                                onClick={handleBuyNow}
                                                className="px-4 md:px-8 py-3 md:py-4 rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black uppercase tracking-widest text-[10px] md:text-xs shadow-xl shadow-orange-500/20 hover:shadow-orange-500/40 transition-all text-center flex-1 md:flex-none transform hover:-translate-y-1 whitespace-nowrap"
                                            >
                                                ¡Comprar Ahora!
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col md:flex-row w-full md:w-auto gap-3 items-center">
                                            <div className="w-full md:w-auto text-center px-4 py-3 md:py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-wider text-gray-400">
                                                Inicia sesión para negociar o proponer precio
                                            </div>

                                            <button
                                                onClick={() => setShowLoginDrawer(true)}
                                                className="w-full md:w-auto px-4 md:px-8 py-3 md:py-4 rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black uppercase tracking-widest text-[10px] md:text-xs shadow-xl shadow-orange-500/20 hover:shadow-orange-500/40 transition-all text-center flex-1 md:flex-none transform hover:-translate-y-1 whitespace-nowrap"
                                            >
                                                ¡Comprar Ahora!
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        }
                        return null;
                    })()}

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

                            <div className="flex flex-col items-end md:justify-end gap-2 mt-2 md:mt-0">
                                <div className="flex items-center gap-2 text-gray-700 text-[10px] font-black uppercase tracking-widest">
                                    <Clock className="h-3.5 w-3.5" />
                                    {getReadableDate(order.createdAt || order.timestamp)}
                                </div>
                                {/* LiveVisitorCount UI */}
                                {(order.unique_visitors?.length || 0) > 0 && (
                                    <div className="flex items-center gap-1.5 text-gray-500/50 text-[9px] font-black uppercase tracking-widest mt-1">
                                        <Eye className="h-3 w-3" /> Visto por {order.unique_visitors.length} persona{order.unique_visitors.length !== 1 ? 's' : ''} en las últimas 24hs
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Auth Drawer */}
            <AnimatePresence>
                {showLoginDrawer && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm"
                            onClick={() => setShowLoginDrawer(false)}
                        />
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed bottom-0 left-0 right-0 z-[1000] bg-zinc-950 rounded-t-[2.5rem] p-8 border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
                        >
                            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-8" />
                            <h3 className="text-3xl font-display font-black text-white text-center mb-3 tracking-tight">Acceso Requerido</h3>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest text-center mb-8 max-w-sm mx-auto">Debes identificarte de forma segura para adquirir este disco y validar la transacción.</p>

                            <button
                                onClick={async () => {
                                    showLoading("Sincronizando identidad...");
                                    try {
                                        const provider = new GoogleAuthProvider();
                                        await signInWithPopup(auth, provider);
                                        setShowLoginDrawer(false);
                                    } catch (e) {
                                        console.error(e);
                                    } finally {
                                        hideLoading();
                                    }
                                }}
                                className="w-full h-16 bg-white hover:bg-gray-200 text-black font-black uppercase tracking-widest text-xs rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl shadow-white/10"
                            >
                                Identificarse con Google
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div >
    );
}
