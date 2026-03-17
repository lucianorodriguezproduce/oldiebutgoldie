import { useState, useEffect, lazy, Suspense } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, increment, arrayUnion, serverTimestamp, addDoc, collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { SEO } from "@/components/SEO";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Music, Disc, Lock, Clock, Eye, ChevronDown, Share2, ChevronRight, Plus, Check, ShoppingBag, Handshake, CheckCircle2, XCircle, MessageCircle, Trash2, Trophy, Star, Flame, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLote } from "@/context/LoteContext";
import { useLoading } from "@/context/LoadingContext";
import { formatDate, getReadableDate } from "@/utils/date";
import { TEXTS } from "@/constants/texts";
import { pushViewItemFromOrder, pushHotOrderDetected } from "@/utils/analytics";
import UsernameClaimModal from "@/components/Profile/UsernameClaimModal";
import { getCleanOrderMetadata } from "@/utils/orderMetadata";
import { tradeService } from "@/services/tradeService";
import { generateWhatsAppAcceptDealMsg } from "@/utils/whatsapp";
import { ADMIN_UID, isAdminEmail } from "@/constants/admin";
import { siteConfigService } from "@/services/siteConfigService";
import type { SiteConfig } from "@/services/siteConfigService";
import TradeChat from "@/components/Trade/TradeChat";
import AuctionWinnerModal from "@/components/Trades/AuctionWinnerModal";
const ArchivoItem = lazy(() => import("@/pages/ArchivoItem"));

export default function PublicOrderView() {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const { user, dbUser, isAdmin } = useAuth();
    const { showLoading, hideLoading } = useLoading();
    const navigate = useNavigate();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isItemsExpanded, setIsItemsExpanded] = useState(false);
    const { addItemFromInventory, isInLote } = useLote();
    const [isExecuting, setIsExecuting] = useState(false);
    const [showRejectConfirm, setShowRejectConfirm] = useState(false);
    const [isWinnerModalOpen, setIsWinnerModalOpen] = useState(false);

    const [offerAmount, setOfferAmount] = useState<string>("");
    const [showOfferInput, setShowOfferInput] = useState(false);
    const [showLoginDrawer, setShowLoginDrawer] = useState(false);
    const [showIdentityGuard, setShowIdentityGuard] = useState(false);
    const [postActionState, setPostActionState] = useState<'idle' | 'success' | 'countered' | 'rejected' | 'negotiating'>('idle');
    const [exchangeCounterCash, setExchangeCounterCash] = useState<string>("");
    const [config, setConfig] = useState<SiteConfig | null>(null);
    const [proposals, setProposals] = useState<any[]>([]);
    const [loadingProposals, setLoadingProposals] = useState(false);

    useEffect(() => {
        if (!id) {
            setLoading(false);
            return;
        }
        showLoading(TEXTS.global.common.locatingBatch);
        const unsub = onSnapshot(doc(db, "trades", id), async (tradeSnap) => {
            if (tradeSnap.exists()) {
                const data = { id: tradeSnap.id, ...tradeSnap.data() };
                const legacyData = await tradeService.bateaToLegacy(data);
                setOrder(legacyData);
                if (!order) {
                    pushViewItemFromOrder(legacyData);
                    if (legacyData.view_count === 4) pushHotOrderDetected(legacyData, 5);
                }
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

    useEffect(() => {
        if (!id || order?.type !== 'auction') return;
        setLoadingProposals(true);
        const q = query(collection(db, "trades", id, "proposals"), orderBy("timestamp", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            const props = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setProposals(props);
            setLoadingProposals(false);
        });
        return () => unsub();
    }, [id, order?.type]);

    if (loading || !order) return null;

    const isOwner = user?.uid === order?.user_id;
    const isAdminOrder = order?.user_id === ADMIN_UID || order?.user_id === "oldiebutgoldie" || isAdminEmail(order?.user_email);
    const canSeePrice = isAdmin || isOwner || isAdminOrder || (order?.isPublicOrder && order?.type === 'direct_sale');

    const items = order.manifest?.items || [];
    const isBatch = order?.isBatch || items.length > 1;
    const itemsCount = items.length;
    const displayArtist = order?.artist || (items[0]?.artist) || "Varios Artistas";
    const displayAlbum = order?.title || (items[0]?.title) || "Sin Título";
    const format = order?.format || items[0]?.format || 'Vinyl';
    const condition = order?.condition || items[0]?.condition || 'M/M';
    const coverImage = order?.imageUrl || order?.thumbnailUrl || items[0]?.cover_image || items[0]?.image;

    const manifestItems = items;
    const manifestOffered = order.manifest?.offeredItems || [];
    const manifestRequested = order.manifest?.requestedItems || [];
    const isExchange = order.type === 'exchange';

    const generateDescription = () => `${TEXTS.global.common.initiatedBy} ${order.user_name || TEXTS.global.common.registeredCollector}. ${itemsCount} discos disponibles.`;
    const titleStr = `${displayArtist} - ${displayAlbum} | Oldie But Goldie`;
    const ogImage = coverImage || "https://oldiebutgoldie.com.ar/og-image.png";

    const schemaMarkup = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": titleStr,
        "image": ogImage,
        "description": generateDescription(),
        "brand": { "@type": "Brand", "name": "Oldie But Goldie" }
    };

    const handleAcceptWinningBid = async () => {
        if (!id || isExecuting) return;
        setIsExecuting(true);
        showLoading("Cerrando subasta...");
        try {
            await tradeService.acceptWinningBid(id!, user!.uid);
            setIsWinnerModalOpen(true);
        } catch (err: any) {
            alert(err.message || "Error al cerrar.");
        } finally {
            setIsExecuting(false);
            hideLoading();
        }
    };

    const handleQuickBuy = async () => {
        if (!user) { setShowLoginDrawer(true); return; }
        if (isInLote(order.id)) { navigate("/checkout"); return; }
        showLoading("Añadiendo al lote...");
        try {
            await addItemFromInventory(order);
            navigate("/checkout");
        } catch (err) {
            console.error(err);
        } finally {
            hideLoading();
        }
    };

    // --- UI BLOCKS ---
    const visitorCountBlock = (order.unique_visitors?.length || 0) > 0 && (
        <div className="flex items-center gap-1.5 text-gray-500/50 text-[9px] font-black uppercase tracking-widest mt-1">
            <Eye className="h-3 w-3" /> Visto por {order.unique_visitors.length} persona{order.unique_visitors.length !== 1 ? 's' : ''} en las últimas 24hs
        </div>
    );

    const userBalanceBlock = (() => {
        const historyUserOffer = order.negotiationHistory?.filter((h: any) => h.sender === 'user').pop();
        const userPrice = historyUserOffer?.price || order.totalPrice || order.details?.price;
        const userCurrency = historyUserOffer?.currency || order.currency || order.details?.currency || "ARS";
        if (!userPrice) return null;
        return (
            <div className="p-8 rounded-[2.5rem] bg-secondary/5 border border-secondary/10 flex flex-col justify-between group hover:bg-secondary/10 transition-all">
                <p className="text-[10px] uppercase tracking-[0.2em] font-black text-secondary/70 mb-4">
                    {historyUserOffer ? TEXTS.global.common.latestUserOffer : TEXTS.global.common.initialUserOffer}
                </p>
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-display font-black text-white">
                        {canSeePrice ? `${userCurrency === "USD" ? "US$" : "$"} ${userPrice.toLocaleString()}` : (
                            <span className="text-gray-700 flex items-center gap-2 italic opacity-40"><Lock className="h-4 w-4" /> {TEXTS.global.common.private}</span>
                        )}
                    </span>
                </div>
            </div>
        );
    })();

    const adminBalanceBlock = (() => {
        const historyAdminOffer = order.negotiationHistory?.filter((h: any) => h.sender === 'admin').pop();
        const adminPrice = historyAdminOffer?.price || order.adminPrice;
        const adminCurrency = historyAdminOffer?.currency || order.adminCurrency || "ARS";
        if (!adminPrice) return null;
        return (
            <div className="p-8 rounded-[2.5rem] bg-primary/10 border border-primary/20 flex flex-col justify-between shadow-2xl shadow-primary/5 group hover:bg-primary/20 transition-all">
                <p className="text-[10px] uppercase tracking-[0.2em] font-black text-primary mb-4">
                    {historyAdminOffer ? TEXTS.global.common.latestObgOffer : TEXTS.global.common.obgOffer}
                </p>
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-display font-black text-white">
                        {canSeePrice ? `${adminCurrency === "USD" ? "US$" : "$"} ${adminPrice.toLocaleString()}` : (
                            <span className="text-gray-700 flex items-center gap-2 italic opacity-40"><Lock className="h-4 w-4" /> {TEXTS.global.common.private}</span>
                        )}
                    </span>
                </div>
            </div>
        );
    })();

    const coordinationChatBlock = (order.status === 'accepted' || order.status === 'completed' || order.status === 'completed_unpaid' || (order.status === 'pending' && order.highest_bidder_uid)) && (user?.uid === order.user_id || user?.uid === order.highest_bidder_uid) && (
        <div className="mt-12 space-y-6 pt-6 border-t border-white/5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 italic mb-4">Chat de Coordinación</h3>
            <TradeChat 
                tradeId={id!} 
                chatId={id!} 
                currentUser={user} 
                trade={order} 
                otherParticipantName={user?.uid === order.user_id ? order.highest_bidder_name : order.user_name} 
            />
        </div>
    );

    const auctionHandlersBlock = (() => {
        if (order.type !== 'auction') return null;
        const now = Date.now();
        const endDate = order.auction_end_date?.toMillis ? order.auction_end_date.toMillis() : new Date(order.auction_end_date).getTime();
        const isFinished = now > endDate;
        const hasWinner = !!order.highest_bidder_uid;
        const isAccepted = order.status === 'accepted';
        if (isOwner && isFinished && !isAccepted && hasWinner) {
            return (
                <div className="mt-8 p-8 bg-primary/10 border border-primary/30 rounded-[2.5rem] flex flex-col items-center gap-6 text-center shadow-2xl shadow-primary/10">
                    <div className="space-y-2">
                        <h4 className="text-2xl font-display font-black text-white uppercase tracking-tight">¡Subasta Finalizada!</h4>
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                            Oferta Ganadora: <span className="text-primary">${order.current_highest_bid?.toLocaleString()}</span> por <span className="text-white">@{order.highest_bidder_name}</span>
                        </p>
                    </div>
                    <button onClick={handleAcceptWinningBid} disabled={isExecuting} className="w-full md:w-auto px-10 py-5 bg-primary text-black font-black uppercase tracking-widest text-sm rounded-2xl hover:scale-105 transition-all shadow-xl shadow-primary/20">
                        {isExecuting ? "Procesando..." : "Aceptar Oferta Ganadora"}
                    </button>
                </div>
            );
        }
        if (isFinished && !hasWinner && !isAccepted) {
            return (
                <div className="mt-8 p-8 bg-white/5 border border-white/10 rounded-[2.5rem] flex flex-col items-center gap-3 text-center opacity-50">
                    <Disc className="w-8 h-8 text-white/20" />
                    <h4 className="text-xl font-display font-black text-white uppercase tracking-tight">Subasta Cerrada sin ofertas</h4>
                </div>
            );
        }
        return null;
    })();

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
                                    <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">{TEXTS.global.navigation.activity}</span>
                                </Link>
                                <span className="bg-primary/10 text-primary text-[8px] md:text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-lg shadow-primary/10 border border-primary/20">
                                    {TEXTS.comercio.activity.availableNow}
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
                                    {TEXTS.global.badges.storeObg}
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/30 text-slate-400 text-[9px] font-black uppercase tracking-widest">
                                    {TEXTS.global.badges.user_label}
                                </span>
                            )}
                            <button
                                onClick={() => {
                                    if (navigator.share) {
                                        navigator.share({
                                            title: titleStr,
                                            text: TEXTS.album.item.share,
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
                                                    <img src={item.cover_image || item.thumbnailUrl || item.image || item.thumb || 'https://raw.githubusercontent.com/lucianorodriguezproduce/buscadordiscogs2/refs/heads/main/public/obg.png'} alt="" className="w-full h-full object-cover" />
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
                                                    <img src={item.cover_image || item.thumbnailUrl || item.image || item.thumb || 'https://raw.githubusercontent.com/lucianorodriguezproduce/buscadordiscogs2/refs/heads/main/public/obg.png'} alt="" className="w-full h-full object-cover" />
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

                        <div className="flex flex-col gap-1 mt-6">
                            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">ID: {order.id}</p>
                            <p className="text-sm text-gray-400 font-bold uppercase">
                                {TEXTS.perfil.profile.date}: {order?.createdAt?.seconds
                                    ? new Date(order.createdAt.seconds * 1000).toLocaleString('es-AR')
                                    : (order?.timestamp?.seconds
                                        ? new Date(order.timestamp.seconds * 1000).toLocaleString('es-AR')
                                        : TEXTS.global.common.loadingGeneric)}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">
                                    {TEXTS.admin.admin.statusOptions[order.status as keyof typeof TEXTS.admin.admin.statusOptions] || order.status}
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
                            {TEXTS.global.common.itemsInvolved} ({items.length})
                        </h3>
                        {items.length === 0 ? (
                            <div className="bg-white/5 border border-dashed border-white/10 rounded-2xl p-12 text-center">
                                <Music className="w-12 h-12 text-white/10 mx-auto mb-4" />
                                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">{TEXTS.global.common.noDiscsInBatch}</p>
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
                                                {item.artist && <p className="text-gray-500 text-xs font-bold uppercase tracking-widest truncate">{item.artist}</p>}
                                                {isAdminOrder && item.condition && (
                                                    <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-gray-400">
                                                        <span className="text-primary/70">Media: {item.condition.split('/')[0] || item.condition}</span>
                                                        {item.condition.includes('/') && <span className="text-gray-600">|</span>}
                                                        {item.condition.includes('/') && <span className="text-primary/70">Cover: {item.condition.split('/')[1]}</span>}
                                                    </div>
                                                )}
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    <span className="bg-gray-800 text-gray-300 px-2 py-1 text-[9px] font-black uppercase rounded">{item.format}</span>
                                                    {!isAdminOrder && <span className="bg-blue-900/30 text-blue-400 px-2 py-1 text-[9px] font-black uppercase rounded border border-blue-500/20">{item.condition}</span>}
                                                </div>
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
                                        {isItemsExpanded ? TEXTS.album.details.showLess : `${TEXTS.album.details.showAll} (+${items.length - 3})`}
                                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isItemsExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {order.type === 'auction' ? (
                    <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="relative group rounded-[3rem] overflow-hidden bg-[#0A0A0A] border border-white/10 shadow-2xl transition-all">
                                {coverImage ? (
                                    <img src={coverImage} className="w-full aspect-square object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                                ) : (
                                    <div className="w-full aspect-square flex items-center justify-center bg-white/[0.02]">
                                        <Disc className="w-24 h-24 text-white/5 animate-pulse" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60" />
                                <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
                                    <div className="px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-primary animate-pulse" />
                                        {(() => {
                                            const now = Date.now();
                                            const endDate = order.auction_end_date?.toMillis ? order.auction_end_date.toMillis() : new Date(order.auction_end_date).getTime();
                                            const isFinished = now > endDate;
                                            return (
                                                <span className={`text-xs font-black uppercase tracking-widest ${isFinished ? 'text-red-400' : 'text-white'}`}>
                                                    {isFinished ? 'CERRADA' : 'EN VIVO'}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <div className="px-4 py-2 bg-primary text-black rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20">
                                        Subasta
                                    </div>
                                </div>
                            </div>
                            <div className="p-8 bg-white/[0.03] border border-white/10 rounded-[2.5rem] space-y-4">
                                <div className="flex flex-col">
                                    <h2 className="text-4xl font-display font-black text-white uppercase tracking-tighter leading-none">{displayAlbum || 'Sin Título'}</h2>
                                    <h3 className="text-xl font-bold text-gray-500 uppercase tracking-widest mt-2">{displayArtist || 'Varios Artistas'}</h3>
                                </div>
                                <div className="flex flex-wrap gap-2 pt-4">
                                    <span className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-gray-400 uppercase tracking-widest">{format}</span>
                                    <span className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-gray-400 uppercase tracking-widest">{condition}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {order.status === 'accepted' ? (
                                <div className="h-full flex flex-col justify-center">
                                    <div className="p-12 text-center space-y-4 bg-emerald-500/5 border border-dashed border-emerald-500/20 rounded-[3rem]">
                                        <Trophy className="w-16 h-16 text-emerald-400 mx-auto" />
                                        <h4 className="text-3xl font-display font-black text-white uppercase tracking-tighter">Subasta Adjudicada</h4>
                                        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Coordinando entrega en el chat inferior</p>
                                    </div>
                                </div>
                            ) : isOwner ? (
                                <div className="flex flex-col h-full bg-[#0E0E0E] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl">
                                    <div className="p-8 border-b border-white/5 flex items-center justify-between">
                                        <h4 className="text-xl font-display font-black text-white uppercase tracking-tight">Panel de Martillero</h4>
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                            <span className="text-[10px] font-black text-primary uppercase tracking-widest">En Vivo</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[400px]">
                                        {loadingProposals ? (
                                            <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-50">
                                                <Clock className="w-8 h-8 text-primary animate-spin" />
                                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Escaneando pujas...</p>
                                            </div>
                                        ) : proposals.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center space-y-6 opacity-30 text-center px-8">
                                                <Disc className="w-16 h-16 text-white" />
                                                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Esperando al primer postor del coliseo</p>
                                            </div>
                                        ) : (
                                            proposals.map((prop, idx) => (
                                                <motion.div 
                                                    initial={{ opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    key={prop.id} 
                                                    className={`p-5 rounded-[2rem] border transition-all ${idx === 0 ? 'bg-primary/10 border-primary/30 shadow-lg shadow-primary/5' : 'bg-white/[0.02] border-white/10'}`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-black text-white text-xs">
                                                                {prop.senderName?.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{idx === 0 ? 'OFERTA LÍDER' : 'ANTERIOR'}</p>
                                                                <p className="text-white font-black">@{prop.senderName}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-2xl font-display font-black text-primary">
                                                                ${prop.manifest?.cashAdjustment?.toLocaleString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button onClick={handleAcceptWinningBid} disabled={isExecuting} className="w-full mt-4 py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-primary transition-all active:scale-95 shadow-xl shadow-black/20">
                                                        Aceptar Oferta y Cerrar
                                                    </button>
                                                </motion.div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col h-full bg-[#0E0E0E] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl">
                                    <div className="p-8 border-b border-white/5 space-y-1">
                                        <h4 className="text-xl font-display font-black text-white uppercase tracking-tight">Coliseo de Subastas</h4>
                                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Pujar en tiempo real</p>
                                    </div>
                                    <div className="p-8 space-y-8 flex-1">
                                        <div className="p-6 bg-primary/10 border border-primary/20 rounded-[2rem] flex items-center justify-between shadow-inner">
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-primary/60 uppercase tracking-widest">Oferta más alta</p>
                                                <p className="text-4xl font-display font-black text-white">
                                                    ${(order.current_highest_bid || order.starting_price || 0).toLocaleString()}
                                                </p>
                                            </div>
                                            <Flame className="w-12 h-12 text-primary opacity-20" />
                                        </div>
                                        <div className="space-y-4">
                                            <div className="relative">
                                                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-display font-black text-gray-600">$</span>
                                                <input 
                                                    type="number"
                                                    placeholder={`Superar $${(order.current_highest_bid || order.starting_price || 0).toLocaleString()}`}
                                                    value={offerAmount}
                                                    onChange={(e) => setOfferAmount(e.target.value)}
                                                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-6 pl-12 pr-6 text-2xl font-display font-black text-white outline-none focus:border-primary transition-all placeholder:text-gray-800"
                                                />
                                            </div>
                                            <button 
                                                onClick={async () => {
                                                    if (!user) { setShowLoginDrawer(true); return; }
                                                    if (!dbUser?.username) { setShowIdentityGuard(true); return; }
                                                    const amount = parseFloat(offerAmount);
                                                    const currentMin = order.current_highest_bid || order.starting_price || 0;
                                                    if (isNaN(amount) || (order.current_highest_bid ? amount <= currentMin : amount < currentMin)) {
                                                        alert(`La puja debe superar los $${currentMin.toLocaleString()}`);
                                                        return;
                                                    }
                                                    setIsExecuting(true);
                                                    showLoading("Enviando Puja...");
                                                    try {
                                                        await tradeService.submitBid(id!, user.uid, amount, dbUser.username);
                                                        setOfferAmount("");
                                                    } catch (err: any) {
                                                        alert(err.message || "Error al pujar.");
                                                    } finally {
                                                        setIsExecuting(false);
                                                        hideLoading();
                                                    }
                                                }}
                                                disabled={isExecuting}
                                                className="w-full py-6 bg-primary text-black rounded-2xl font-black uppercase text-sm tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                            >
                                                {isExecuting ? 'Procesando...' : 'Elevar Puja'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 pt-6 border-t border-white/5">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 italic">{TEXTS.global.common.negotiationSummary}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {userBalanceBlock}
                            {adminBalanceBlock}
                        </div>
                    </div>
                )}

                {coordinationChatBlock}
                {auctionHandlersBlock}

                <div className="p-8 pb-[env(safe-area-inset-bottom)] rounded-[2.5rem] bg-white/[0.02] border border-white/5 flex flex-col md:flex-row justify-between gap-8 items-start md:items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                            <span className="text-xl text-primary font-black uppercase">{(order.user_name || "C").charAt(0)}</span>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-1">{TEXTS.global.common.initiatedBy}</p>
                            <p className="text-white text-lg font-black tracking-tight">{order.user_name || TEXTS.global.common.registeredCollector}</p>
                        </div>
                    </div>
                    <div className="space-y-4 w-full md:w-auto">
                        <div className="flex flex-col md:items-end">
                            <p className="text-[10px] uppercase tracking-widest font-black text-gray-600 mb-2">{TEXTS.global.common.orderStatus}</p>
                            <span className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border transition-all ${order.status === 'pending_acceptance' ? 'bg-secondary/10 border-secondary/20 text-secondary' : 'bg-white/5 border-white/10 text-white'}`}>
                                {order.status === 'pending_acceptance' ? TEXTS.global.common.waitingAcceptance : (TEXTS.admin.admin.statusOptions[order.status as keyof typeof TEXTS.admin.admin.statusOptions] || order.status)}
                            </span>
                        </div>
                        <div className="flex flex-col items-end md:justify-end gap-2 mt-2 md:mt-0">
                            <div className="flex items-center gap-2 text-gray-700 text-[10px] font-black uppercase tracking-widest">
                                <Clock className="h-3.5 w-3.5" />
                                {getReadableDate(order.createdAt || order.timestamp)}
                            </div>
                            {visitorCountBlock}
                        </div>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showLoginDrawer && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm" onClick={() => setShowLoginDrawer(false)} />
                        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed bottom-0 left-0 right-0 z-[1000] bg-zinc-950 rounded-t-[2.5rem] p-8 border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
                            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-8" />
                            <h3 className="text-3xl font-display font-black text-white text-center mb-3 tracking-tight">Acceso Requerido</h3>
                            <button onClick={async () => { showLoading("Sincronizando..."); try { await signInWithPopup(auth, new GoogleAuthProvider()); setShowLoginDrawer(false); } catch (e) {} finally { hideLoading(); } }} className="w-full h-16 bg-white text-black font-black uppercase text-xs rounded-2xl flex items-center justify-center gap-3">Identificarse con Google</button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
            {showIdentityGuard && dbUser && <UsernameClaimModal isOpen={showIdentityGuard} onClose={() => setShowIdentityGuard(false)} onSuccess={() => { setShowIdentityGuard(false); navigate(`/trade/new?targetTrade=${id}`); }} />}
            <AuctionWinnerModal isOpen={isWinnerModalOpen} onClose={() => setIsWinnerModalOpen(false)} order={order} />
        </div>
    );
}