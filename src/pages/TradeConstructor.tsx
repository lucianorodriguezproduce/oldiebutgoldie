import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Disc, ShoppingBag, DollarSign, Search, X, Plus, Minus, MessageCircle, AlertCircle, User, Users, Star } from "lucide-react";
import { serverTimestamp, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useLoading } from "@/context/LoadingContext";
import { userAssetService } from "@/services/userAssetService";
import { inventoryService } from "@/services/inventoryService";
import { tradeService } from "@/services/tradeService";
import { whatsappService } from "@/services/whatsappService";
import { ADMIN_UIDS } from "@/constants/admin";
import { LazyImage } from "@/components/ui/LazyImage";
import UsernameClaimModal from "@/components/Profile/UsernameClaimModal";
import type { UserAsset, InventoryItem } from "@/types/inventory";
import type { DbUser } from "@/types/user";

type Step = 0 | 1 | 2 | 3;
type CashDirection = "PAGAR" | "RECIBIR";
type Modality = "exchange" | "direct_sale" | "auction";

export default function TradeConstructor() {
    const { user, dbUser, isAdmin } = useAuth();
    const navigate = useNavigate();
    const { showLoading, hideLoading } = useLoading();
    const [searchParams] = useSearchParams();
    const location = useLocation();

    const [siteConfig, setSiteConfig] = useState<any>(null);
    const [viewMode, setViewMode] = useState<"official" | "community">("official");
    const [communityUsers, setCommunityUsers] = useState<DbUser[]>([]);
    const [selectedCommunityUser, setSelectedCommunityUser] = useState<DbUser | null>(null);
    const [communityAssets, setCommunityAssets] = useState<UserAsset[]>([]);
    const [loadingCommunity, setLoadingCommunity] = useState(false);
    const [receiverUid, setReceiverUid] = useState<string | null>(null);

    // Initial Load: Config
    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, "settings", "site_config"), (snap) => {
            if (snap.exists()) setSiteConfig(snap.data());
        });
        return () => unsubscribe();
    }, []);

    // Load Community Users
    useEffect(() => {
        if ((siteConfig?.p2p_global_enabled || siteConfig?.allow_p2p_public_offers) && viewMode === 'community') {
            const loadUsers = async () => {
                try {
                    const users = await userAssetService.getUsersWithAssets();
                    setCommunityUsers(users.filter(u => u.uid !== user?.uid));
                } catch (err) {
                    console.error("Error loading community users:", err);
                }
            };
            loadUsers();
        }
    }, [siteConfig?.p2p_global_enabled, viewMode, user?.uid]);

    // Load selected user assets
    useEffect(() => {
        if (selectedCommunityUser) {
            const loadAssets = async () => {
                setLoadingCommunity(true);
                try {
                    const assets = await userAssetService.getUserAssets(selectedCommunityUser.uid);
                    setCommunityAssets(assets);
                } catch (err) {
                    console.error("Error loading community assets:", err);
                } finally {
                    setLoadingCommunity(false);
                }
            };
            loadAssets();
        }
    }, [selectedCommunityUser]);

    const targetTradeId = searchParams.get("targetTrade");

    // Wizard state
    const [step, setStep] = useState<Step>(0);
    const [modalidad, setModalidad] = useState<Modality>("exchange");

    // Auction Specifics
    const [auctionEndDate, setAuctionEndDate] = useState("");
    const [startingPrice, setStartingPrice] = useState("");

    // Identity Guard State
    const [showIdentityGuard, setShowIdentityGuard] = useState(false);

    // Step 1: Items from user's collection to OFFER
    const [userAssets, setUserAssets] = useState<UserAsset[]>([]);
    const [selectedOffered, setSelectedOffered] = useState<Set<string>>(new Set());
    const [loadingAssets, setLoadingAssets] = useState(true);

    // Step 2: Items from store to REQUEST
    const [storeItems, setStoreItems] = useState<InventoryItem[]>([]);
    const [selectedRequested, setSelectedRequested] = useState<Set<string>>(new Set());
    const [storeSearch, setStoreSearch] = useState("");
    const [loadingStore, setLoadingStore] = useState(true);

    // Step 3: Cash adjustment
    const [cashAmount, setCashAmount] = useState("");
    const [cashCurrency, setCashCurrency] = useState<"ARS" | "USD">("ARS");
    const [cashDirection, setCashDirection] = useState<CashDirection>("PAGAR");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [createdTradeId, setCreatedTradeId] = useState<string | null>(null);

    // Handle initial state / admin_negotiation (V74.1)
    useEffect(() => {
        const state = location.state as { requestedItem?: any, admin_negotiation?: boolean };
        const isAdminNegotiationQuery = searchParams.get("mode") === "admin_negotiation";
        
        if (state?.admin_negotiation || isAdminNegotiationQuery) {
            setReceiverUid(ADMIN_UIDS[0]);
            setModalidad("exchange");
            setStep(1); // Start offering items
            return;
        }

        if (state?.requestedItem) {
            const item = state.requestedItem;
            setSelectedRequested(new Set([item.id]));
            if (item.source === 'user_assets' || item.ownerId) {
                setModalidad("direct_sale");
                setViewMode("community");
                setReceiverUid(item.sellerId || item.ownerId);
            } else {
                setReceiverUid(ADMIN_UIDS[0]);
            }
            setStep(1);
        }
    }, [location.state, searchParams]);

    // Load user's collection
    useEffect(() => {
        if (!user) return;
        setLoadingAssets(true);
        userAssetService.getUserAssets(user.uid)
            .then(setUserAssets)
            .catch(err => console.error("Error loading assets:", err))
            .finally(() => setLoadingAssets(false));
    }, [user]);

    // Load store inventory
    useEffect(() => {
        setLoadingStore(true);
        const unsubscribe = inventoryService.onSnapshotInventory((items) => {
            setStoreItems(items);
            setLoadingStore(false);
        });
        return () => unsubscribe();
    }, []);

    // Filtered store items
    const filteredStore = storeSearch
        ? storeItems.filter(item =>
            item.metadata.title.toLowerCase().includes(storeSearch.toLowerCase()) ||
            item.metadata.artist.toLowerCase().includes(storeSearch.toLowerCase())
        )
        : storeItems;

    const toggleOffered = (id: string) => {
        setSelectedOffered(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleRequested = (id: string) => {
        setSelectedRequested(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSubmit = async () => {
        if (!user || isSubmitting) return;

        // --- IDENTITY GUARD FOR V2 P2P ---
        if (!dbUser?.username) {
            setShowIdentityGuard(true);
            return;
        }

        if (selectedOffered.size === 0 && selectedRequested.size === 0) {
            alert("Debes seleccionar al menos un ítem para ofrecer o solicitar.");
            return;
        }

        setIsSubmitting(true);
        showLoading("Enviando propuesta de intercambio...");

        try {
            const cashValue = parseFloat(cashAmount) || 0;
            const adjustedCash = cashDirection === "RECIBIR" ? -cashValue : cashValue;

            // Build detailed item list for the trade
            const offeredDetails = Array.from(selectedOffered).map(id => {
                const asset = userAssets.find(a => a.id === id);
                return {
                    id: asset?.originalInventoryId || id,
                    title: asset?.metadata?.title || "Item",
                    artist: asset?.metadata?.artist || "",
                    cover_image: asset?.media?.thumbnail || "",
                    format: asset?.metadata?.format_description || "Vinyl",
                    condition: "VG+",
                    source: "user_asset" as const,
                    userAssetId: id
                };
            });

            const requestedDetails = modalidad === "exchange"
                ? Array.from(selectedRequested).map(id => {
                    const item = storeItems.find(i => i.id === id);
                    return {
                        id,
                        title: item?.metadata?.title || "Item",
                        artist: item?.metadata?.artist || "",
                        cover_image: item?.media?.thumbnail || item?.media?.full_res_image_url || "",
                        format: item?.metadata?.format_description || "Vinyl",
                        condition: item?.logistics?.condition || "VG+",
                        source: "inventory" as const
                    };
                })
                : [];

            const isP2PPublicListing = modalidad !== "exchange";
            const finalReceiverId = isP2PPublicListing ? null : (receiverUid || ADMIN_UIDS[0]);

            if (targetTradeId) {
                // PHASE III: PROPOSAL SYSTEM
                await tradeService.createProposal(targetTradeId, {
                    senderId: user.uid,
                    senderName: dbUser?.username || user.displayName || user.email,
                    manifest: {
                        items: [...offeredDetails, ...requestedDetails],
                        offeredItems: offeredDetails.map(i => i.userAssetId || i.id),
                        requestedItems: requestedDetails.map(i => i.id),
                        cashAdjustment: adjustedCash,
                        currency: cashCurrency
                    },
                    timestamp: serverTimestamp()
                });
                setCreatedTradeId(targetTradeId);
            } else {
                const tradeData: any = {
                    participants: {
                        senderId: user.uid,
                        receiverId: finalReceiverId
                    },
                    manifest: {
                        items: [...offeredDetails, ...requestedDetails],
                        offeredItems: offeredDetails.map(i => i.userAssetId || i.id),
                        requestedItems: requestedDetails.map(i => i.id),
                        cashAdjustment: adjustedCash,
                        currency: cashCurrency
                    },
                    type: modalidad,
                    tradeOrigin: requestedDetails.length > 0 ? 'INVENTORY' : 'DISCOGS',
                    isPublicOrder: isP2PPublicListing || siteConfig?.allow_p2p_public_offers === true,
                    status: 'pending_publish_fee' // V24.2 requirement
                };

                if (modalidad === "auction") {
                    tradeData.auction_end_date = auctionEndDate ? new Date(auctionEndDate) : null;
                    tradeData.starting_price = parseFloat(startingPrice) || 0;
                }

                const tradeId = await tradeService.createTrade(tradeData);
                setCreatedTradeId(tradeId);

                // Redirect to Checkout if it's a P2P sale/auction
                if (modalidad !== "exchange") {
                    navigate(`/checkout/publication/${tradeId}`);
                    return;
                }
            }
            setIsSuccess(true);
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error: any) {
            console.error("Error creating trade:", error);
            if (error.message?.includes("ASSET_LOCKED")) {
                alert("Algunos ítems ya están en una negociación activa. Intenta con otros.");
            } else {
                alert("Error al crear el intercambio: " + (error.message || "Error desconocido"));
            }
        } finally {
            setIsSubmitting(false);
            hideLoading();
        }
    };

    if (!user) {
        navigate('/login');
        return null;
    }

    const offeredAssets = userAssets.filter(a => selectedOffered.has(a.id));
    const requestedItemsList = storeItems.filter(i => selectedRequested.has(i.id));

    // ─── SUCCESS SCREEN ───
    if (isSuccess) {
        return (
            <div className="min-h-screen py-10 flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    className="w-full max-w-lg space-y-8"
                >
                    {/* Success Icon */}
                    <div className="flex flex-col items-center text-center space-y-6">
                        <div className="relative">
                            <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(204,255,0,0.3)]">
                                <CheckCircle2 className="w-12 h-12 text-black" />
                            </div>
                            <motion.div
                                initial={{ scale: 1 }}
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                                className="absolute inset-0 w-24 h-24 bg-primary/20 rounded-full -z-10"
                            />
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-3xl md:text-4xl font-display font-black text-white uppercase tracking-tighter">
                                ¡Propuesta Enviada!
                            </h1>
                            <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">
                                Tu solicitud de intercambio fue recibida
                            </p>
                        </div>
                    </div>

                    {/* Trade Summary Card */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">ID de Operación</span>
                            <span className="text-[10px] font-mono text-primary">#{createdTradeId?.slice(-8).toUpperCase()}</span>
                        </div>

                        {offeredAssets.length > 0 && (
                            <div className="pt-3 border-t border-white/5 space-y-2">
                                <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Ofrecés ({offeredAssets.length})
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {offeredAssets.map(a => (
                                        <div key={a.id} className="flex items-center gap-2 bg-orange-500/5 border border-orange-500/20 rounded-lg px-2 py-1">
                                            <div className="w-6 h-6 rounded overflow-hidden">
                                                <LazyImage src={a.media?.thumbnail || ''} alt="" className="w-full h-full object-cover" />
                                            </div>
                                            <span className="text-[10px] font-bold text-white truncate max-w-[100px]">{a.metadata?.title}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {requestedItemsList.length > 0 && (
                            <div className="pt-3 border-t border-white/5 space-y-2">
                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Querés Recibir ({requestedItemsList.length})
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {requestedItemsList.map(i => (
                                        <div key={i.id} className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-2 py-1">
                                            <div className="w-6 h-6 rounded overflow-hidden">
                                                <LazyImage src={i.media?.thumbnail || ''} alt="" className="w-full h-full object-cover" />
                                            </div>
                                            <span className="text-[10px] font-bold text-white truncate max-w-[100px]">{i.metadata?.title}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Estado</span>
                            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-[9px] font-black uppercase tracking-widest animate-pulse">
                                Pendiente de Revisión
                            </span>
                        </div>
                    </div>

                    {/* Info Notice */}
                    <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 text-center">
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                            El administrador revisará tu propuesta y te notificará el resultado
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                        <Link
                            to="/perfil"
                            className="w-full flex items-center justify-center gap-2 bg-primary text-black py-5 rounded-2xl font-black uppercase text-sm tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_40px_rgba(204,255,0,0.15)]"
                        >
                            Ver Mi Actividad
                        </Link>
                        <Link
                            to={`/orden/${createdTradeId}`}
                            className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all"
                        >
                            <Search className="w-4 h-4" /> Ver Orden Pública
                        </Link>
                        <button
                            onClick={() => {
                                window.open(whatsappService.generateTradeLink(createdTradeId || ''), '_blank');
                            }}
                            className="w-full flex items-center justify-center gap-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/20 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
                        >
                            <MessageCircle className="w-4 h-4" /> Consultar por WhatsApp
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <>
            <div className="min-h-screen py-10 space-y-10">
                {/* Header */}
                <header className="space-y-6">
                    <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">
                        <ArrowLeft className="w-4 h-4" /> Volver
                    </button>
                    <div>
                        <h1 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-tighter">
                            Proponer <span className="text-primary">Intercambio</span>
                        </h1>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-2">
                            Seleccioná lo que ofrecés, lo que querés y ajustá el saldo
                        </p>
                    </div>

                    {/* Step Indicator */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {[0, 1, 2, 3].map(s => {
                            if (modalidad !== "exchange" && s === 2) return null; // Skip "Quiero" step for Sale/Auction
                            return (
                                <button
                                    key={s}
                                    onClick={() => setStep(s as Step)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${step === s
                                        ? 'bg-primary text-black'
                                        : step > s
                                            ? 'bg-primary/10 text-primary border border-primary/20'
                                            : 'bg-white/5 text-gray-600 border border-white/10'
                                        }`}
                                >
                                    {step > s ? <CheckCircle2 className="w-3 h-3" /> : null}
                                    {s === 0 ? "Modalidad" : s === 1 ? "Ofrezco" : s === 2 ? "Quiero" : modalidad === "exchange" ? "Saldo" : "Precio"}
                                </button>
                            );
                        })}
                    </div>
                </header>

                {/* Step 0: Modality Selection */}
                <AnimatePresence mode="wait">
                    {step === 0 && (
                        <motion.div
                            key="step0"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="space-y-8"
                        >
                            <div className="space-y-1">
                                <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">
                                    ¿Qué querés hacer?
                                </h2>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                    Elegí cómo querés comercializar tus discos
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Intercambio */}
                                <button
                                    onClick={() => { setModalidad("exchange"); setStep(1); }}
                                    className="group relative bg-white/[0.03] border border-white/10 rounded-[2rem] p-8 text-left hover:border-primary/40 transition-all hover:-translate-y-2 overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <MessageCircle size={80} />
                                    </div>
                                    <h3 className="text-2xl font-display font-black text-white uppercase tracking-tighter mb-2">🤝 Intercambio</h3>
                                    <p className="text-gray-500 text-[10px] font-bold uppercase leading-relaxed">Ofrece tus discos y pide otros a cambio. El flujo tradicional de trueque.</p>
                                    <div className="mt-6 flex items-center gap-2 text-primary text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                        Seleccionar <ArrowRight size={14} />
                                    </div>
                                </button>

                                {/* Venta Directa */}
                                <button
                                    onClick={() => { setModalidad("direct_sale"); setStep(1); }}
                                    className="group relative bg-white/[0.03] border border-white/10 rounded-[2rem] p-8 text-left hover:border-emerald-500/40 transition-all hover:-translate-y-2 overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <DollarSign size={80} />
                                    </div>
                                    <h3 className="text-2xl font-display font-black text-white uppercase tracking-tighter mb-2">🏷️ Venta Directa</h3>
                                    <p className="text-gray-500 text-[10px] font-bold uppercase leading-relaxed">Publica un disco con precio fijo para que cualquiera pueda comprarlo directamente.</p>
                                    <div className="mt-6 flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                        Seleccionar <ArrowRight size={14} />
                                    </div>
                                </button>

                                {/* Subasta */}
                                <button
                                    onClick={() => { setModalidad("auction"); setStep(1); }}
                                    className="group relative bg-white/[0.03] border border-white/10 rounded-[2rem] p-8 text-left hover:border-orange-500/40 transition-all hover:-translate-y-2 overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Disc size={80} />
                                    </div>
                                    <h3 className="text-2xl font-display font-black text-white uppercase tracking-tighter mb-2">⏱️ Subasta</h3>
                                    <p className="text-gray-500 text-[10px] font-bold uppercase leading-relaxed">Inicia una puja abierta. El mejor postor se lleva el disco al finalizar el tiempo.</p>
                                    <div className="mt-6 flex items-center gap-2 text-orange-400 text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                        Seleccionar <ArrowRight size={14} />
                                    </div>
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 1: Offer from Collection */}
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="space-y-6"
                        >
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">
                                        <Disc className="w-5 h-5 inline mr-2 text-orange-400" />
                                        ¿Qué ofrecés?
                                    </h2>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                        Seleccioná ítems de tu colección para ofrecer en el intercambio
                                    </p>
                                </div>
                                {selectedOffered.size > 0 && (
                                    <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] font-black uppercase">
                                        {selectedOffered.size} seleccionados
                                    </span>
                                )}
                            </div>

                            {loadingAssets ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {Array.from({ length: 8 }).map((_, i) => (
                                        <div key={i} className="aspect-square bg-white/5 rounded-2xl animate-pulse" />
                                    ))}
                                </div>
                            ) : userAssets.length === 0 ? (
                                <div className="py-20 text-center border-2 border-dashed border-white/10 rounded-[2rem] space-y-4">
                                    <Disc className="w-12 h-12 text-gray-700 mx-auto" />
                                    <p className="text-white font-black uppercase tracking-widest">Tu batea está vacía</p>
                                    <p className="text-gray-600 text-xs font-bold uppercase max-w-xs mx-auto">
                                        Buscá discos en el Home y añadilos a tu batea para poder ofrecerlos
                                    </p>
                                    <button onClick={() => navigate('/')} className="bg-primary text-black px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest">
                                        Ir al Home
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {userAssets.map(asset => {
                                        const isSelected = selectedOffered.has(asset.id);
                                        return (
                                            <button
                                                key={asset.id}
                                                onClick={() => toggleOffered(asset.id)}
                                                className={`relative group text-left rounded-2xl border overflow-hidden transition-all ${isSelected
                                                    ? 'border-orange-500 ring-2 ring-orange-500/30 bg-orange-500/5'
                                                    : 'border-white/10 bg-white/[0.03] hover:border-white/30'
                                                    }`}
                                            >
                                                <div className="aspect-square overflow-hidden">
                                                    <LazyImage
                                                        src={asset.media?.thumbnail || asset.media?.full_res_image_url || ''}
                                                        alt={asset.metadata?.title}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                    />
                                                </div>
                                                <div className="p-3 space-y-1">
                                                    <h4 className="text-xs font-black text-white truncate">{asset.metadata?.title}</h4>
                                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">{asset.metadata?.artist}</p>
                                                </div>
                                                {isSelected && (
                                                    <div className="absolute top-2 right-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                                                        <CheckCircle2 className="w-4 h-4 text-black" />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="flex justify-between pt-6 border-t border-white/5">
                                <button onClick={() => setStep(0)} className="flex items-center gap-2 px-6 py-3 text-gray-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
                                    <ArrowLeft className="w-4 h-4" /> Atrás
                                </button>
                                <button
                                    onClick={() => setStep(modalidad === "exchange" ? 2 : 3)}
                                    className="flex items-center gap-2 px-8 py-4 bg-primary text-black rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-[1.02] transition-all"
                                >
                                    Siguiente <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 2: Request from Store / Community */}
                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="space-y-6"
                        >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">
                                        <ShoppingBag className="w-5 h-5 inline mr-2 text-emerald-400" />
                                        {selectedCommunityUser ? `Colección de @${selectedCommunityUser.username}` : "¿Qué querés recibir?"}
                                    </h2>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed">
                                        {selectedCommunityUser 
                                            ? `Explorando los discos disponibles de ${selectedCommunityUser.display_name}`
                                            : "Elegí de la tienda oficial o de la comunidad los discos que buscás"}
                                    </p>
                                </div>
                                {selectedRequested.size > 0 && (
                                    <div className="flex items-center gap-2">
                                        <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest">
                                            {selectedRequested.size} seleccionados
                                        </span>
                                        <button 
                                            onClick={() => {
                                                setSelectedRequested(new Set());
                                                setReceiverUid(null);
                                            }}
                                            className="p-1 px-2 text-[9px] font-black uppercase text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-red-500/20"
                                        >
                                            Limpiar
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* View Mode Toggle (Official vs Community) - Only if p2p_global_enabled is true */}
                            {!selectedCommunityUser && siteConfig?.p2p_global_enabled && (
                                <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 max-w-sm">
                                    <button
                                        onClick={() => setViewMode("official")}
                                        className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === "official" ? 'bg-primary text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
                                    >
                                        Batea OBG (Oficial)
                                    </button>
                                    <button
                                        onClick={() => setViewMode("community")}
                                        className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === "community" ? 'bg-primary text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
                                    >
                                        Comunidad (P2P)
                                    </button>
                                </div>
                            )}

                            {/* BACK BUTTON FOR DIRECTORY */}
                            {selectedCommunityUser && (
                                <button 
                                    onClick={() => setSelectedCommunityUser(null)}
                                    className="inline-flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest hover:translate-x-[-4px] transition-transform"
                                >
                                    <ArrowLeft size={14} /> Volver al Directorio
                                </button>
                            )}

                            {/* SEARCH BAR (Official Mode Only) */}
                            {viewMode === "official" && !selectedCommunityUser && (
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                                    <input
                                        type="text"
                                        value={storeSearch}
                                        onChange={e => setStoreSearch(e.target.value)}
                                        placeholder="Buscar en la tienda oficial..."
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-primary/40 outline-none transition-all"
                                    />
                                    {storeSearch && (
                                        <button onClick={() => setStoreSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <X className="w-4 h-4 text-gray-500 hover:text-white" />
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* CONTENT RENDERING */}
                            {viewMode === "official" ? (
                                /* OFFICIAL STORE LISTING */
                                <>
                                    {loadingStore ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {Array.from({ length: 8 }).map((_, i) => (
                                                <div key={i} className="aspect-square bg-white/5 rounded-2xl animate-pulse" />
                                            ))}
                                        </div>
                                    ) : filteredStore.length === 0 ? (
                                        <div className="py-12 text-center border border-dashed border-white/10 rounded-2xl">
                                            <p className="text-gray-500 text-xs font-bold uppercase">No se encontraron ítems en la tienda oficial</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                                            {filteredStore.map(item => {
                                                const isSelected = selectedRequested.has(item.id);
                                                return (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => {
                                                            // Logic overlap check: If there are P2P items, can't mix? Or just set receiverUid
                                                            if (receiverUid && !ADMIN_UIDS.includes(receiverUid) && selectedRequested.size > 0) {
                                                                alert("No podés mezclar discos de distintos usuarios de la comunidad o de la tienda oficial en un mismo intercambio.");
                                                                return;
                                                            }
                                                            toggleRequested(item.id);
                                                            setReceiverUid(ADMIN_UIDS[0]);
                                                        }}
                                                        className={`relative group text-left rounded-2xl border overflow-hidden transition-all ${isSelected
                                                            ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-500/5'
                                                            : 'border-white/10 bg-white/[0.03] hover:border-white/30'
                                                            }`}
                                                    >
                                                        <div className="aspect-square overflow-hidden">
                                                            <LazyImage
                                                                src={item.media?.thumbnail || item.media?.full_res_image_url || ''}
                                                                alt={item.metadata?.title}
                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                            />
                                                        </div>
                                                        <div className="p-3 space-y-1">
                                                            <h4 className="text-xs font-black text-white truncate">{item.metadata?.title}</h4>
                                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">{item.metadata?.artist}</p>
                                                            <p className="text-[10px] font-mono text-primary">${item.logistics?.price?.toLocaleString()}</p>
                                                        </div>
                                                        {isSelected && (
                                                            <div className="absolute top-2 right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                                                                <CheckCircle2 className="w-4 h-4 text-black" />
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            ) : selectedCommunityUser ? (
                                /* SELECTED USER ASSETS LISTING */
                                <>
                                    {loadingCommunity ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {Array.from({ length: 4 }).map((_, i) => (
                                                <div key={i} className="aspect-square bg-white/5 rounded-2xl animate-pulse" />
                                            ))}
                                        </div>
                                    ) : communityAssets.length === 0 ? (
                                        <div className="py-12 text-center border border-dashed border-white/10 rounded-2xl">
                                            <p className="text-gray-500 text-xs font-bold uppercase">Este usuario no tiene discos públicos en su batea</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                                            {communityAssets.map(asset => {
                                                const isSelected = selectedRequested.has(asset.id);
                                                return (
                                                    <button
                                                        key={asset.id}
                                                        onClick={() => {
                                                            if (receiverUid && receiverUid !== selectedCommunityUser.uid && selectedRequested.size > 0) {
                                                                alert("Solo podés proponer trueques a un usuario a la vez.");
                                                                return;
                                                            }
                                                            toggleRequested(asset.id);
                                                            setReceiverUid(selectedCommunityUser.uid);
                                                        }}
                                                        className={`relative group text-left rounded-2xl border overflow-hidden transition-all ${isSelected
                                                            ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-500/5'
                                                            : 'border-white/10 bg-white/[0.03] hover:border-white/30'
                                                            }`}
                                                    >
                                                        <div className="aspect-square overflow-hidden">
                                                            <LazyImage
                                                                src={asset.media?.thumbnail || asset.media?.full_res_image_url || ''}
                                                                alt={asset.metadata?.title}
                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                            />
                                                        </div>
                                                        <div className="p-3 space-y-1">
                                                            <h4 className="text-xs font-black text-white truncate">{asset.metadata?.title}</h4>
                                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">{asset.metadata?.artist}</p>
                                                            {asset.valuation && (
                                                                <p className="text-[10px] font-mono text-primary">Valor: ${asset.valuation.toLocaleString()}</p>
                                                            )}
                                                        </div>
                                                        {isSelected && (
                                                            <div className="absolute top-2 right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                                                                <CheckCircle2 className="w-4 h-4 text-black" />
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            ) : (
                                /* COMMUNITY DIRECTORY (USER LIST) */
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {communityUsers.map(u => (
                                            <button
                                                key={u.uid}
                                                onClick={() => setSelectedCommunityUser(u)}
                                                className="flex items-center gap-4 bg-white/[0.03] border border-white/10 hover:border-primary/50 p-4 rounded-2xl transition-all group text-left"
                                            >
                                                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center group-hover:bg-primary/10 transition-colors shrink-0">
                                                    <User className="w-6 h-6 text-gray-400 group-hover:text-primary transition-colors" />
                                                </div>
                                                <div className="overflow-hidden flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-white font-black uppercase tracking-tight text-sm truncate">@{u.username || 'anon'}</p>
                                                        {u.stats?.rating_count > 0 ? (
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <Star className="w-2.5 h-2.5 fill-primary text-primary" />
                                                                <span className="text-[9px] font-black text-white">{u.stats.rating_average.toFixed(1)}</span>
                                                                <span className="text-[9px] font-bold text-gray-500">({u.stats.rating_count})</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[8px] font-black text-primary/40 uppercase tracking-widest bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">Nuevo</span>
                                                        )}
                                                    </div>
                                                    <p className="text-gray-500 font-bold text-[9px] tracking-widest uppercase truncate">{u.display_name}</p>
                                                    <p className="text-primary font-black text-[9px] uppercase tracking-widest mt-1">
                                                        {u.stats?.collectionItemCount || 0} discos en batea
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                        {communityUsers.length === 0 && (
                                            <div className="col-span-full py-12 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-3xl">
                                                <p className="text-gray-500 text-xs font-bold uppercase">No hay otros coleccionistas activos con discos aún.</p>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            <div className="flex justify-between pt-6 border-t border-white/5">
                                <button onClick={() => setStep(1)} className="flex items-center gap-2 px-6 py-3 text-gray-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
                                    <ArrowLeft className="w-4 h-4" /> Atrás
                                </button>
                                <button
                                    onClick={() => setStep(3)}
                                    className="flex items-center gap-2 px-8 py-4 bg-primary text-black rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-[1.02] transition-all"
                                >
                                    Siguiente <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 3: Cash Adjustment + Confirmation */}
                    {step === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="space-y-8"
                        >
                            <div className="space-y-1">
                                <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">
                                    <DollarSign className="w-5 h-5 inline mr-2 text-primary" />
                                    {modalidad === "exchange" ? "Ajuste de Saldo" : modalidad === "direct_sale" ? "Configurar Precio" : "Configurar Subasta"}
                                </h2>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                    {modalidad === "exchange" 
                                        ? "Si hay diferencia de valor, indicá el monto a pagar o recibir"
                                        : modalidad === "direct_sale"
                                            ? "Ingresá el precio final por el cual querés vender el ítem"
                                            : "Indicá el precio base y la fecha en la que termina la subasta"
                                    }
                                </p>
                            </div>

                            {modalidad === "exchange" ? (
                                <>
                                    {/* Cash Direction Toggle */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setCashDirection("PAGAR")}
                                            className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${cashDirection === "PAGAR"
                                                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                                : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'
                                                }`}
                                        >
                                            <Minus className="w-5 h-5" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Yo Pago</span>
                                        </button>
                                        <button
                                            onClick={() => setCashDirection("RECIBIR")}
                                            className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${cashDirection === "RECIBIR"
                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                                : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'
                                                }`}
                                        >
                                            <Plus className="w-5 h-5" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Quiero Recibir</span>
                                        </button>
                                    </div>

                                    {/* Amount Input */}
                                    <div className="flex gap-3">
                                        <select
                                            value={cashCurrency}
                                            onChange={e => setCashCurrency(e.target.value as "ARS" | "USD")}
                                            className="bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary/40 cursor-pointer"
                                        >
                                            <option value="ARS">ARS $</option>
                                            <option value="USD">USD $</option>
                                        </select>
                                        <div className="relative flex-1">
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                                            <input
                                                type="number"
                                                min="0"
                                                value={cashAmount}
                                                onChange={e => setCashAmount(e.target.value)}
                                                placeholder="0"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-lg font-mono text-white focus:border-primary/40 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest px-1">
                                        Dejá en 0 si es un intercambio equitativo sin diferencia de dinero
                                    </p>
                                </>
                            ) : modalidad === "direct_sale" ? (
                                <div className="space-y-4">
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-black">ARS $</span>
                                        <input
                                            type="number"
                                            value={cashAmount}
                                            onChange={e => setCashAmount(e.target.value)}
                                            placeholder="Precio de Venta"
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-20 pr-4 py-5 text-2xl font-mono text-white focus:border-primary/40 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-1">Precio Base (ARS)</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400 font-black">$</span>
                                                <input
                                                    type="number"
                                                    value={startingPrice}
                                                    onChange={e => setStartingPrice(e.target.value)}
                                                    placeholder="0"
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-4 text-xl font-mono text-white focus:border-orange-500/40 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-1">Fecha de Finalización</label>
                                            <input
                                                type="datetime-local"
                                                value={auctionEndDate}
                                                onChange={e => setAuctionEndDate(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-sm font-mono text-white fill-white focus:border-orange-500/40 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Summary */}
                            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-4">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                                    {modalidad === "exchange" ? "Resumen del Intercambio" : modalidad === "direct_sale" ? "Resumen de Venta" : "Resumen de Subasta"}
                                </h3>

                                {offeredAssets.length > 0 && (
                                    <div className="space-y-2">
                                        <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Ofrezco ({offeredAssets.length})
                                        </span>
                                        <div className="flex flex-wrap gap-2">
                                            {offeredAssets.map(a => (
                                                <div key={a.id} className="flex items-center gap-2 bg-orange-500/5 border border-orange-500/20 rounded-lg px-2 py-1">
                                                    <div className="w-6 h-6 rounded overflow-hidden">
                                                        <LazyImage src={a.media?.thumbnail || ''} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-white truncate max-w-[120px]">{a.metadata?.title}</span>
                                                    <button onClick={() => toggleOffered(a.id)} className="text-orange-400 hover:text-white">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {requestedItemsList.length > 0 && (
                                    <div className="space-y-2">
                                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Quiero Recibir ({requestedItemsList.length})
                                        </span>
                                        <div className="flex flex-wrap gap-2">
                                            {requestedItemsList.map((i: InventoryItem) => (
                                                <div key={i.id} className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-2 py-1">
                                                    <div className="w-6 h-6 rounded overflow-hidden">
                                                        <LazyImage src={i.media?.thumbnail || ''} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-white truncate max-w-[120px]">{i.metadata?.title}</span>
                                                    <button onClick={() => toggleRequested(i.id)} className="text-emerald-400 hover:text-white">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {modalidad === "exchange" && (parseFloat(cashAmount) || 0) > 0 && (
                                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                                            {cashDirection === "PAGAR" ? "Yo pago" : "Quiero recibir"}
                                        </span>
                                        <span className={`text-lg font-display font-black ${cashDirection === "PAGAR" ? 'text-red-400' : 'text-emerald-400'}`}>
                                            {cashDirection === "PAGAR" ? "-" : "+"} {cashCurrency === "USD" ? "US$" : "$"} {parseFloat(cashAmount).toLocaleString()}
                                        </span>
                                    </div>
                                )}

                                {modalidad === "direct_sale" && (parseFloat(cashAmount) || 0) > 0 && (
                                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Precio de Venta</span>
                                        <span className="text-lg font-display font-black text-emerald-400">
                                            $ {parseFloat(cashAmount).toLocaleString()}
                                        </span>
                                    </div>
                                )}

                                {modalidad === "auction" && (
                                    <div className="pt-3 border-t border-white/5 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Precio Base</span>
                                            <span className="text-sm font-display font-black text-orange-400">
                                                $ {(parseFloat(startingPrice) || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Finaliza el</span>
                                            <span className="text-[10px] font-mono text-white">
                                                {auctionEndDate ? new Date(auctionEndDate).toLocaleString() : "No definida"}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {selectedOffered.size === 0 && selectedRequested.size === 0 && (
                                    <p className="text-[10px] text-gray-600 font-bold text-center py-4">
                                        No seleccionaste ningún ítem todavía
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-between pt-6 border-t border-white/5">
                                <button onClick={() => setStep(modalidad === "exchange" ? 2 : 1)} className="flex items-center gap-2 px-6 py-3 text-gray-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
                                    <ArrowLeft className="w-4 h-4" /> Atrás
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || selectedOffered.size === 0 || (modalidad === 'exchange' && selectedRequested.size === 0)}
                                    className="flex items-center gap-2 px-8 py-4 bg-primary text-black rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_30px_rgba(204,255,0,0.15)] disabled:opacity-50 disabled:hover:scale-100"
                                >
                                    {isSubmitting ? (
                                        <div className="h-4 w-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                                    ) : (
                                        <> <CheckCircle2 className="w-4 h-4" /> {modalidad === 'exchange' ? 'Enviar Propuesta' : 'Publicar Offer'} </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <UsernameClaimModal
                isOpen={showIdentityGuard}
                onSuccess={() => {
                    setShowIdentityGuard(false);
                    handleSubmit(); // Auto-continue the submission
                }}
                onClose={() => setShowIdentityGuard(false)}
            />
        </>
    );
}
