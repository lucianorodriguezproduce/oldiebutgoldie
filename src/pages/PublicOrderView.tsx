import { useState, useEffect } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, increment, arrayUnion, serverTimestamp, addDoc, collection, onSnapshot } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { SEO } from "@/components/SEO";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Music, Disc, Lock, Clock, Eye, ChevronDown, Share2, ChevronRight, Plus, Check, ShoppingBag, Handshake, CheckCircle2, XCircle, MessageCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLote } from "@/context/LoteContext";
import { useLoading } from "@/context/LoadingContext";
import { formatDate, getReadableDate } from "@/utils/date";
import { TEXTS } from "@/constants/texts";
import { pushViewItemFromOrder, pushHotOrderDetected } from "@/utils/analytics";
import { getCleanOrderMetadata } from "@/utils/orderMetadata";
import { tradeService } from "@/services/tradeService";
import { generateWhatsAppAcceptDealMsg } from "@/utils/whatsapp";
import { ADMIN_UID } from "@/constants/admin";

export default function PublicOrderView() {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const { user, isAdmin } = useAuth();
    const { showLoading, hideLoading } = useLoading();
    const navigate = useNavigate();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isItemsExpanded, setIsItemsExpanded] = useState(false);
    const { addItemFromInventory, isInLote } = useLote();
    const [isExecuting, setIsExecuting] = useState(false);
    const [showRejectConfirm, setShowRejectConfirm] = useState(false);

    const isOwner = user?.uid === order?.user_id;
    const isAdminOrder = order?.user_id === ADMIN_UID || order?.user_id === "oldiebutgoldie" || order?.user_email === "admin@discography.ai";
    const canSeePrice = isAdmin || isOwner || isAdminOrder;

    const [offerAmount, setOfferAmount] = useState<string>("");
    const [showOfferInput, setShowOfferInput] = useState(false);
    const [showLoginDrawer, setShowLoginDrawer] = useState(false);

    // Exchange post-action state
    const [postActionState, setPostActionState] = useState<'idle' | 'success' | 'countered' | 'rejected' | 'negotiating'>('idle');
    const [exchangeCounterCash, setExchangeCounterCash] = useState<string>("");

    useEffect(() => {
        if (!id) {
            setLoading(false);
            return;
        }

        showLoading(TEXTS.common.locatingBatch);

        // --- LIVE SYNC ENGINE (onSnapshot) ---
        const unsub = onSnapshot(doc(db, "trades", id), async (tradeSnap) => {
            if (tradeSnap.exists()) {
                const tradeData = { id: tradeSnap.id, ...tradeSnap.data() } as any;

                // Adaptar al motor legacy (silenciosamente)
                const legacyData = await tradeService.getTradeById(id);
                setOrder(legacyData);

                // Tracking de vistas (Solo la primera vez o cada 5 min para no saturar)
                if (!order) {
                    pushViewItemFromOrder(legacyData);
                    if (legacyData.view_count === 4) pushHotOrderDetected(legacyData, 5);
                }
            } else {
                console.warn("Trade no encontrado en el búnker.");
            }
            setLoading(false);
            hideLoading();
        }, (error) => {
            console.error("Error en LiveSync:", error);
            setLoading(false);
            hideLoading();
        });

        return () => unsub();
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
        if (!id || isExecuting) return;

        setIsExecuting(true);
        showLoading("Confirmando compra...");
        try {
            // INTEGRACIÓN DEL MOTOR TRANSACCIONAL (Soberanía Atómica)
            // Resolvemos el trade usando el manifiesto actual para gatillar descuento de stock y creación de user_assets
            await tradeService.resolveTrade(id, order.manifest);

            // Notificación al Admin (Búnker)
            if (order.is_admin_offer || order.participants?.receiverId === ADMIN_UID || order.participants?.receiverId === "oldiebutgoldie") {
                await addDoc(collection(db, "notifications"), {
                    userId: "oldiebutgoldie",
                    orderId: id,
                    title: "¡Vendido!",
                    message: `El usuario ${user.displayName || user.email || 'Usuario'} ha comprado el ${order.isBatch ? 'lote' : 'vinilo'} "${order.title || 'Sin Título'}".`,
                    type: "sale_completed",
                    read: false,
                    createdAt: serverTimestamp(),
                    sender_email: user.email,
                    sender_name: user.displayName || "Usuario",
                });
            }

            setOrder((prev: any) => ({ ...prev, status: "venta_finalizada" }));

            // ÉXITO: Redirección inmediata para evitar el "Bloqueo Visionario"
            setTimeout(() => {
                navigate('/perfil');
            }, 1500);
        } catch (error: any) {
            console.error("Buy error:", error);
            let errorMessage = "Hubo un error al procesar tu compra. Por favor intenta nuevamente o contáctanos por WhatsApp.";

            if (error.message === "TRADE_ALREADY_PROCESSED") {
                errorMessage = "¡Operación relámpago! Este ítem ya ha sido procesado por otro coleccionista.";
            } else if (error.message?.includes("disponible")) {
                errorMessage = error.message;
            }

            alert(errorMessage);
        } finally {
            setIsExecuting(false);
            hideLoading();
            // Fallback: Si no redirigió antes por algún motivo, forzamos salida tras 2s si el estado es final
            if (order?.status === 'venta_finalizada') {
                setTimeout(() => navigate('/perfil'), 2000);
            }
        }
    };

    const handleQuickBuy = () => {
        if (!user) {
            setShowLoginDrawer(true);
            return;
        }
        addItemFromInventory(order);
        navigate('/revisar-lote');
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
            await updateDoc(doc(db, "trades", id), {
                totalPrice: offerVal,
                status: "counter_offer",
                buyer_uid: user.uid,
                confirmedAt: serverTimestamp(),
                negotiationHistory: arrayUnion({
                    price: offerVal,
                    currency: currentCurrency,
                    sender: "user",
                    timestamp: new Date(),
                    message: `Contraoferta de ${user.displayName || user.email}`
                })
            });
            setOrder((prev: any) => ({
                ...prev,
                totalPrice: offerVal,
                status: "counter_offer",
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

    const { artist: displayArtist, album: displayAlbum, image: coverImage, format, condition, isBatch, itemsCount } = getCleanOrderMetadata(order);
    const isExchange = order?.type === 'exchange';
    const manifestItems = Array.isArray(order.manifest?.items) ? order.manifest.items : [];
    const manifestOffered = manifestItems.filter((i: any) => i.source === 'user_asset');
    const manifestRequested = manifestItems.filter((i: any) => i.source === 'inventory');

    const items = isExchange
        ? manifestItems.map((i: any) => ({
            title: i.title || 'Sin Título',
            artist: i.artist || '',
            cover_image: i.cover_image || '',
            format: i.format || 'N/A',
            condition: i.condition || 'N/A',
            source: i.source
        }))
        : isBatch ? (order.items || []) : [
            {
                title: displayAlbum || order.title || "Detalle del Disco",
                artist: displayArtist,
                album: displayAlbum,
                cover_image: coverImage,
                format: format || "N/A",
                condition: condition || "N/A",
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
                                    to="/comercio"
                                    className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors group"
                                >
                                    <ChevronRight className="h-5 w-5 md:h-6 md:w-6 rotate-180 group-hover:-translate-x-1 transition-transform" />
                                    <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">{TEXTS.navigation.activity}</span>
                                </Link>
                                <span className="bg-primary/10 text-primary text-[8px] md:text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-lg shadow-primary/10 border border-primary/20">
                                    {TEXTS.activity.availableNow}
                                </span>
                            </div>
                        )}

                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex flex-col gap-1 items-start">
                                <h1 className={`text-4xl md:text-5xl font-display font-black tracking-tightest leading-none transition-colors ${isAdminOrder ? 'bg-gradient-to-r from-primary/60 via-primary to-secondary bg-clip-text text-transparent drop-shadow-xl' : 'text-white hover:text-primary'}`}>
                                    {displayArtist || displayAlbum}
                                </h1>
                                {displayAlbum && (displayArtist || isBatch) && (
                                    <h2 className="text-xl md:text-2xl font-bold text-gray-400 uppercase tracking-widest leading-tight opacity-80">
                                        {isBatch ? `LOTE DE ${itemsCount} DISCOS` : displayAlbum}
                                    </h2>
                                )}
                            </div>
                            {isAdminOrder ? (
                                <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-primary/20 to-primary/40 border border-primary/50 text-primary text-[9px] font-black uppercase tracking-widest shadow-[0_0_10px_rgba(255,184,0,0.2)]">
                                    {TEXTS.badges.storeObg}
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/30 text-slate-400 text-[9px] font-black uppercase tracking-widest">
                                    {TEXTS.badges.user_label}
                                </span>
                            )}
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

                        {/* Exchange Trade Items */}
                        {isExchange && manifestItems.length > 0 && (
                            <div className="bg-white/[0.02] rounded-3xl border border-white/10 p-6 md:p-8 space-y-6">
                                <div className="flex items-center gap-3">
                                    <Handshake className="w-5 h-5 text-violet-400" />
                                    <h3 className="text-lg font-display font-black text-white uppercase tracking-tight">Detalle del Intercambio</h3>
                                </div>

                                {manifestOffered.length > 0 && (
                                    <div className="space-y-3">
                                        <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Ofrece ({manifestOffered.length})
                                        </span>
                                        {manifestOffered.map((item: any, idx: number) => (
                                            <div key={`o-${idx}`} className="border-b border-white/5 pb-3 flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 border border-orange-500/20">
                                                    <img src={item.cover_image || 'https://raw.githubusercontent.com/lucianorodriguezproduce/buscadordiscogs2/refs/heads/main/public/obg.png'} alt="" className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-white truncate uppercase">{item.title}</p>
                                                    {item.artist && <p className="text-[9px] text-gray-500 uppercase tracking-widest truncate">{item.artist}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {manifestRequested.length > 0 && (
                                    <div className="space-y-3">
                                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Solicita ({manifestRequested.length})
                                        </span>
                                        {manifestRequested.map((item: any, idx: number) => (
                                            <div key={`r-${idx}`} className="border-b border-white/5 pb-3 flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 border border-emerald-500/20">
                                                    <img src={item.cover_image || 'https://raw.githubusercontent.com/lucianorodriguezproduce/buscadordiscogs2/refs/heads/main/public/obg.png'} alt="" className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-white truncate uppercase">{item.title}</p>
                                                    {item.artist && <p className="text-[9px] text-gray-500 uppercase tracking-widest truncate">{item.artist}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {order.manifest?.cashAdjustment && order.manifest.cashAdjustment !== 0 && (
                                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5">
                                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                                            {order.manifest.cashAdjustment > 0 ? 'Usuario paga' : 'Usuario recibe'}
                                        </span>
                                        <span className={`text-lg font-display font-black ${order.manifest.cashAdjustment > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                            {order.manifest.cashAdjustment > 0 ? '-' : '+'} {order.manifest.currency === 'USD' ? 'US$' : '$'} {Math.abs(order.manifest.cashAdjustment).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

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
                        <div className={`w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden bg-white/5 border shadow-2xl flex-shrink-0 ${isAdminOrder ? 'border-primary/50 shadow-primary/20 scale-110 md:w-48 md:h-48' : 'border-white/10'}`}>
                            <img
                                src={isAdminOrder ? (order.imageUrl || order.details?.cover_image || order.thumbnailUrl) : order.thumbnailUrl}
                                alt="Lote reference"
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                        </div>
                    )}
                </header>

                {!isExchange && (
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
                                                        <span className="text-primary/70">Media: {item.condition.split('/')[0] || item.condition}</span>
                                                        {item.condition.includes('/') && <span className="text-gray-600">|</span>}
                                                        {item.condition.includes('/') && <span className="text-primary/70">Cover: {item.condition.split('/')[1]}</span>}
                                                    </div>
                                                )}

                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    <span className="bg-gray-800 text-gray-300 px-2 py-1 text-[9px] font-black uppercase rounded">{item.format || format}</span>
                                                    {!isAdminOrder && <span className="bg-blue-900/30 text-blue-400 px-2 py-1 text-[9px] font-black uppercase rounded border border-blue-500/20">{item.condition || condition}</span>}
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
                )}

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
                                <div className="p-8 rounded-[2.5rem] bg-secondary/5 border border-secondary/10 flex flex-col justify-between group hover:bg-secondary/10 transition-all">
                                    <p className="text-[10px] uppercase tracking-[0.2em] font-black text-secondary/70 mb-4">
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

                    {/* === EXCHANGE TRADE ACTIONS (FIX-1) === */}
                    {isExchange && (() => {
                        const isFinal = ['completed', 'venta_finalizada'].includes(order.status);
                        const isCancelled = order.status === 'cancelled';
                        const hasCounterOffer = ['counter_offer', 'counteroffered'].includes(order.status);
                        const isPending = order.status === 'pending';

                        if (isFinal) {
                            return (
                                <div className="mt-8 p-6 md:p-8 bg-emerald-500/10 border border-emerald-500/30 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 shadow-inner">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                    <h4 className="text-2xl md:text-3xl font-display font-black text-emerald-400 uppercase tracking-tightest">Intercambio Completado</h4>
                                </div>
                            );
                        }

                        if (isCancelled) {
                            return (
                                <div className="mt-8 p-6 md:p-8 bg-red-500/10 border border-red-500/30 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 shadow-inner">
                                    <XCircle className="w-8 h-8 text-red-400" />
                                    <h4 className="text-2xl md:text-3xl font-display font-black text-red-400 uppercase tracking-tightest">Intercambio Cancelado</h4>
                                </div>
                            );
                        }

                        // User is the owner and there's a counter-offer → show Accept/Reject
                        if (isOwner && hasCounterOffer) {
                            return (
                                <div className="mt-8 space-y-4">
                                    <div className="p-6 md:p-8 bg-gradient-to-br from-violet-500/10 to-primary/10 border border-violet-500/30 rounded-[2.5rem] space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-violet-500/10 rounded-2xl">
                                                <Handshake className="w-6 h-6 text-violet-400" />
                                            </div>
                                            <div>
                                                <h4 className="text-xl font-display font-black text-white uppercase tracking-tight">Contraoferta Recibida</h4>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">El administrador ha modificado los términos del intercambio</p>
                                            </div>
                                        </div>

                                        {order.manifest?.cashAdjustment !== undefined && order.manifest.cashAdjustment !== 0 && (
                                            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5">
                                                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                                                    {order.manifest.cashAdjustment > 0 ? 'Deberías abonar' : 'Recibirías'}
                                                </span>
                                                <span className={`text-2xl font-display font-black ${order.manifest.cashAdjustment > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                    {order.manifest.currency === 'USD' ? 'US$' : '$'} {Math.abs(order.manifest.cashAdjustment).toLocaleString()}
                                                </span>
                                            </div>
                                        )}

                                        {!showRejectConfirm ? (
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <button
                                                    onClick={async () => {
                                                        if (isExecuting) return;
                                                        const confirmed = window.confirm('¿Aceptás esta contraoferta? Se completará el intercambio.');
                                                        if (!confirmed) return;
                                                        setIsExecuting(true);
                                                        showLoading('Completando intercambio...');
                                                        try {
                                                            await tradeService.resolveTrade(id!, order.manifest);
                                                            setOrder((prev: any) => ({ ...prev, status: 'completed' }));
                                                            setPostActionState('success');
                                                        } catch (error: any) {
                                                            console.error('Accept error:', error);
                                                            alert(error.message?.includes('TRADE_ALREADY_PROCESSED')
                                                                ? 'Este intercambio ya fue procesado.'
                                                                : `Error al completar: ${error.message || 'Intenta nuevamente'}`);
                                                        } finally {
                                                            setIsExecuting(false);
                                                            hideLoading();
                                                        }
                                                    }}
                                                    disabled={isExecuting}
                                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    {isExecuting ? 'Procesando...' : 'Aceptar Contraoferta'}
                                                </button>
                                                <button
                                                    onClick={() => setPostActionState('negotiating')}
                                                    disabled={isExecuting}
                                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 font-black uppercase text-[10px] tracking-widest transition-all disabled:opacity-50"
                                                >
                                                    <MessageCircle className="w-4 h-4" />
                                                    Contraofertar
                                                </button>
                                                <button
                                                    onClick={() => setShowRejectConfirm(true)}
                                                    disabled={isExecuting}
                                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl border border-red-500/30 text-red-400 hover:bg-red-500/10 font-black uppercase text-[10px] tracking-widest transition-all disabled:opacity-50"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                    Rechazar
                                                </button>
                                            </div>
                                        ) : postActionState === 'negotiating' ? (
                                            <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4">
                                                <h5 className="text-white font-display font-black uppercase">Nueva Contraoferta</h5>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Ajustá la diferencia en efectivo para tu nueva propuesta:</p>

                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 relative">
                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-black">$</span>
                                                        <input
                                                            type="number"
                                                            placeholder="0"
                                                            value={exchangeCounterCash}
                                                            onChange={(e) => setExchangeCounterCash(e.target.value)}
                                                            className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-8 pr-4 text-white font-black outline-none focus:border-primary/50 transition-colors"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[9px] text-gray-500 uppercase font-black flex items-center gap-1 cursor-pointer">
                                                            <input type="radio" name="counterDirection" value="pay" defaultChecked /> Pago extra
                                                        </label>
                                                        <label className="text-[9px] text-gray-500 uppercase font-black flex items-center gap-1 cursor-pointer">
                                                            <input type="radio" name="counterDirection" value="receive" /> Solicito extra
                                                        </label>
                                                    </div>
                                                </div>

                                                <div className="flex gap-3 pt-2">
                                                    <button
                                                        onClick={async () => {
                                                            setIsExecuting(true);
                                                            showLoading('Enviando contraoferta...');
                                                            try {
                                                                const val = parseFloat(exchangeCounterCash) || 0;
                                                                const isPay = (document.querySelector('input[name="counterDirection"]:checked') as HTMLInputElement).value === 'pay';
                                                                const amount = isPay ? val : -val;

                                                                const newManifest = {
                                                                    ...order.manifest,
                                                                    cashAdjustment: amount
                                                                };

                                                                await tradeService.counterTrade(id!, newManifest, user!.uid);
                                                                setOrder((prev: any) => ({ ...prev, status: 'counteroffered', manifest: newManifest }));
                                                                setPostActionState('countered');
                                                            } catch (error) {
                                                                console.error('Counter-offer error:', error);
                                                                alert('Error al enviar la contraoferta.');
                                                            } finally {
                                                                setIsExecuting(false);
                                                                hideLoading();
                                                            }
                                                        }}
                                                        disabled={isExecuting}
                                                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-black font-black uppercase text-[10px] tracking-widest transition-all hover:opacity-90 disabled:opacity-50"
                                                    >
                                                        Enviar Propuesta
                                                    </button>
                                                    <button
                                                        onClick={() => setPostActionState('idle')}
                                                        className="py-3 px-6 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white font-black uppercase text-[10px] tracking-widest transition-all"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            </div>
                                        ) : postActionState === 'success' ? (
                                            <div className="p-8 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex flex-col items-center justify-center gap-4 text-center">
                                                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
                                                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                                </div>
                                                <div>
                                                    <h5 className="text-xl font-display font-black text-emerald-400 uppercase tracking-tightest">¡Trato Hecho!</h5>
                                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">El intercambio ha sido aceptado y completado.</p>
                                                </div>
                                                <div className="flex gap-3 mt-2">
                                                    <Link to="/perfil" className="px-6 py-3 rounded-xl bg-emerald-500 text-black font-black uppercase text-[10px] tracking-widest hover:bg-emerald-400 transition-colors">
                                                        Ver Mi Perfil
                                                    </Link>
                                                    <button onClick={() => {
                                                        window.open(generateWhatsAppAcceptDealMsg(order), "_blank");
                                                    }} className="px-6 py-3 rounded-xl border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 font-black uppercase text-[10px] tracking-widest transition-colors flex items-center gap-2">
                                                        <MessageCircle className="w-4 h-4" /> WhatsApp
                                                    </button>
                                                </div>
                                            </div>
                                        ) : postActionState === 'countered' ? (
                                            <div className="p-8 bg-primary/10 border border-primary/30 rounded-2xl flex flex-col items-center justify-center gap-4 text-center">
                                                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
                                                    <Clock className="w-8 h-8 text-primary" />
                                                </div>
                                                <div>
                                                    <h5 className="text-xl font-display font-black text-primary uppercase tracking-tightest">Contraoferta Enviada</h5>
                                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">El administrador revisará tu nueva propuesta.</p>
                                                </div>
                                                <Link to="/comercio" className="mt-2 px-6 py-3 rounded-xl bg-white/10 text-white font-black uppercase text-[10px] tracking-widest hover:bg-white/20 transition-colors">
                                                    Volver al Panel
                                                </Link>
                                            </div>
                                        ) : (
                                            <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl space-y-4">
                                                <p className="text-sm text-red-300 font-bold text-center">¿Seguro que querés rechazar esta contraoferta? El intercambio será cancelado.</p>
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={async () => {
                                                            setIsExecuting(true);
                                                            showLoading('Cancelando intercambio...');
                                                            try {
                                                                await tradeService.updateTradeStatus(id!, 'cancelled');
                                                                setOrder((prev: any) => ({ ...prev, status: 'cancelled' }));
                                                                setPostActionState('rejected');
                                                                setShowRejectConfirm(false);
                                                            } catch (error) {
                                                                console.error('Reject error:', error);
                                                                alert('Error al rechazar la contraoferta.');
                                                            } finally {
                                                                setIsExecuting(false);
                                                                hideLoading();
                                                            }
                                                        }}
                                                        disabled={isExecuting}
                                                        className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black uppercase text-[10px] tracking-widest transition-all disabled:opacity-50"
                                                    >
                                                        {isExecuting ? 'Procesando...' : 'Sí, Rechazar'}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setShowRejectConfirm(false);
                                                            setPostActionState('idle');
                                                        }}
                                                        className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white font-black uppercase text-[10px] tracking-widest transition-all"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        }

                        // User is the owner but trade is still pending (waiting for admin review)
                        if (isOwner && isPending) {
                            return (
                                <div className="mt-8 p-6 md:p-8 bg-primary/5 border border-primary/20 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 text-center">
                                    <Clock className="w-8 h-8 text-primary animate-pulse" />
                                    <h4 className="text-xl font-display font-black text-white uppercase tracking-tightest">Tu propuesta está en revisión</h4>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest max-w-sm">El administrador revisará tu propuesta y te responderá con una contraoferta o aceptación</p>
                                </div>
                            );
                        }

                        // Admin viewing the exchange
                        if (isAdmin && (isPending || hasCounterOffer)) {
                            return (
                                <div className="mt-8 p-6 md:p-8 bg-violet-500/5 border border-violet-500/20 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 text-center">
                                    <Handshake className="w-6 h-6 text-violet-400" />
                                    <h4 className="text-lg font-display font-black text-white uppercase tracking-tightest">Intercambio en Curso</h4>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Gestioná esta propuesta desde el panel de admin</p>
                                    <Link to="/admin/trades" className="mt-2 px-6 py-3 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 rounded-xl text-violet-300 font-black uppercase text-[10px] tracking-widest transition-all">
                                        Ir a Consola de Trades
                                    </Link>
                                </div>
                            );
                        }

                        // Non-owner, non-admin viewing an active exchange
                        if (!isOwner && !isAdmin && !isFinal && !isCancelled) {
                            return (
                                <div className="mt-8 p-6 md:p-8 bg-blue-500/10 border border-blue-500/30 rounded-[2.5rem] flex items-center justify-center shadow-inner">
                                    <h4 className="text-2xl md:text-3xl font-display font-black text-blue-500 uppercase tracking-tightest">En Negociación</h4>
                                </div>
                            );
                        }

                        return null;
                    })()}

                    {/* === ADMIN SALE ORDER ACTIONS (original) === */}
                    {isAdminOrder && !isExchange && (() => {
                        const isSold = ['venta_finalizada', 'completed'].includes(order.status);
                        const isNegotiating = ['contraoferta_usuario', 'negotiating', 'quoted', 'counter_offer'].includes(order.status);

                        if (isSold) {
                            return (
                                <div className="mt-8 p-6 md:p-8 bg-red-500/10 border border-red-500/30 rounded-[2.5rem] flex items-center justify-center shadow-inner">
                                    <h4 className="text-2xl md:text-3xl font-display font-black text-red-500 uppercase tracking-tightest">Vendido</h4>
                                </div>
                            );
                        }

                        if (isAdmin) {
                            return (
                                <div className="mt-8 p-6 md:p-8 bg-violet-500/5 border border-violet-500/20 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 text-center">
                                    <ShoppingBag className="w-6 h-6 text-violet-400" />
                                    <h4 className="text-lg font-display font-black text-white uppercase tracking-tightest">Venta en Curso</h4>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Gestioná esta venta o pedido desde tu panel de administrador</p>
                                    <Link to="/admin/trades" className="mt-2 px-6 py-3 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 rounded-xl text-violet-300 font-black uppercase text-[10px] tracking-widest transition-all">
                                        Ir a Ventas / Pedidos
                                    </Link>
                                </div>
                            );
                        }

                        if (isNegotiating && !isOwner) {
                            return (
                                <div className="mt-8 p-6 md:p-8 bg-blue-500/10 border border-blue-500/30 rounded-[2.5rem] flex items-center justify-center shadow-inner">
                                    <h4 className="text-2xl md:text-3xl font-display font-black text-blue-500 uppercase tracking-tightest">En Negociación</h4>
                                </div>
                            );
                        }

                        if (!['cancelled'].includes(order.status)) {
                            return (
                                <div className="fixed bottom-0 left-0 right-0 z-[100] md:static mt-0 md:mt-8 p-4 md:p-8 bg-black/90 md:bg-gradient-to-br md:from-primary/10 md:to-secondary/10 border-t md:border border-white/10 md:border-primary/30 md:rounded-[2.5rem] flex flex-col md:flex-row items-center gap-4 md:gap-6 justify-between shadow-[0_-20px_40px_rgba(0,0,0,0.5)] md:shadow-[0_0_30px_rgba(255,184,0,0.1)] backdrop-blur-md md:backdrop-blur-none transition-all">
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
                                                        className="px-3 md:px-4 py-2 bg-secondary hover:bg-secondary/80 disabled:opacity-50 text-black font-black uppercase tracking-widest text-[9px] md:text-[10px] rounded-xl transition-all"
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
                                                <div className="flex gap-2 flex-grow">
                                                    <button
                                                        onClick={() => addItemFromInventory(order)}
                                                        className={`px-4 md:px-6 py-3 md:py-4 rounded-2xl border transition-all text-center flex-1 md:flex-none whitespace-nowrap flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[9px] md:text-[10px] ${isInLote(order.id)
                                                            ? 'bg-primary border-primary text-black'
                                                            : 'border-primary/30 text-primary hover:bg-primary/10'
                                                            }`}
                                                    >
                                                        {isInLote(order.id) ? (
                                                            <><Check className="w-4 h-4" /> En el Lote</>
                                                        ) : (
                                                            <><Plus className="w-4 h-4" /> Añadir al Lote</>
                                                        )}
                                                    </button>

                                                    {/* Haggle feature deactivated/latent
                                                    <button
                                                        onClick={() => setShowOfferInput(true)}
                                                        className="px-4 md:px-6 py-3 md:py-4 rounded-2xl border border-yellow-500/30 text-yellow-500 font-black uppercase tracking-widest text-[9px] md:text-[10px] hover:bg-yellow-500/10 transition-all text-center flex-1 md:flex-none whitespace-nowrap"
                                                    >
                                                        Regatear
                                                    </button>
                                                    */}
                                                </div>
                                            )}

                                            <button
                                                onClick={handleQuickBuy}
                                                className="px-4 md:px-8 py-3 md:py-4 rounded-2xl bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-black font-black uppercase tracking-widest text-[10px] md:text-xs shadow-xl shadow-secondary/20 hover:shadow-secondary/40 transition-all text-center flex-1 md:flex-none transform hover:-translate-y-1 whitespace-nowrap"
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
                                                onClick={() => {
                                                    handleQuickBuy();
                                                }}
                                                disabled={isExecuting}
                                                className={`w-full md:w-auto px-4 md:px-8 py-3 md:py-4 rounded-2xl bg-gradient-to-r from-primary to-secondary text-black font-black uppercase tracking-widest text-[10px] md:text-xs shadow-xl shadow-secondary/20 transition-all text-center flex-1 md:flex-none transform whitespace-nowrap ${isExecuting ? 'opacity-50 cursor-not-allowed' : 'hover:from-primary/80 hover:to-secondary/80 hover:shadow-secondary/40 hover:-translate-y-1'}`}
                                            >
                                                {isExecuting ? 'Procesando...' : '¡Comprar Ahora!'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        }
                        return null;
                    })()}

                    {/* Metadata Footer */}
                    <div className="p-8 pb-[env(safe-area-inset-bottom)] rounded-[2.5rem] bg-white/[0.02] border border-white/5 flex flex-col md:flex-row justify-between gap-8 items-start md:items-center">
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
                                    ? 'bg-secondary/10 border-secondary/20 text-secondary'
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
