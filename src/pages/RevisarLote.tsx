import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, X, CheckCircle2, MessageCircle, Mail, Layers, ChevronLeft, Disc } from "lucide-react";
import { useLote } from "@/context/LoteContext";
import { useAuth } from "@/context/AuthContext";
import { useLoading } from "@/context/LoadingContext";
import { authenticateUser, signInWithGoogle } from "@/lib/auth";
import { db, auth } from "@/lib/firebase";
import { LazyImage } from "@/components/ui/LazyImage";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { pushWhatsAppContactFromOrder } from "@/utils/analytics";
import { generateWhatsAppLink } from "@/utils/whatsapp";
import { TEXTS } from "@/constants/texts";
import { inventoryService } from "@/services/inventoryService";
import { tradeService } from "@/services/tradeService";
import { userAssetService } from "@/services/userAssetService";
import { ADMIN_UID } from "@/constants/admin";
import { useEffect as useReactEffect } from "react";

export default function RevisarLote() {
    const { loteItems, toggleItem, clearLote, totalCount } = useLote();
    const { user } = useAuth();
    const { showLoading, hideLoading, isLoading: isSubmitting } = useLoading();
    const navigate = useNavigate();

    const [isSuccess, setIsSuccess] = useState(false);
    const [submittedOrder, setSubmittedOrder] = useState<any>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [batchIntent, setBatchIntent] = useState<'COMPRAR' | 'VENDER' | null>(null);
    const [totalPrice, setTotalPrice] = useState("");
    const [currency, setCurrency] = useState<'ARS' | 'USD'>("ARS");

    // Stock Validation for Inventory Items
    useReactEffect(() => {
        const validateInventoryItems = async () => {
            const inventoryItems = loteItems.filter(item => item.source === 'INVENTORY');
            if (inventoryItems.length === 0) return;

            const ids = inventoryItems.map(item => item.id.toString()).slice(0, 30); // Firestore 'in' limit

            try {
                const q = query(collection(db, "inventory"), where("__name__", "in", ids));
                const snapshot = await getDocs(q);

                const soldItems: string[] = [];
                const updatedItemsMap = new Map(snapshot.docs.map(doc => [doc.id, doc.data()]));

                inventoryItems.forEach(item => {
                    const freshData = updatedItemsMap.get(item.id.toString()) as any;
                    if (freshData && freshData.logistics?.status !== 'active') {
                        soldItems.push(item.title);
                        toggleItem(item);
                    }
                });

                if (soldItems.length > 0) {
                    alert(`Atención: Los siguientes discos del inventario ya no están disponibles y fueron removidos: \n\n${soldItems.map(t => `• ${t}`).join('\n')}`);
                }
            } catch (error) {
                console.warn("Stock validation error:", error);
            }
        };

        validateInventoryItems();
    }, []);

    const totalInventory = loteItems.filter(i => i.source === 'INVENTORY').reduce((acc, item) => acc + (item.price || 0), 0);
    const totalEstimated = loteItems.filter(i => i.source === 'DISCOGS').reduce((acc, item) => acc + (item.price || 0), 0);
    const calculatedTotal = totalInventory + totalEstimated;

    const hasInventoryItems = loteItems.some(item => item.source === 'INVENTORY');
    const hasDiscogsItems = loteItems.some(item => item.source === 'DISCOGS');
    const inventoryOnly = loteItems.every(item => item.source === 'INVENTORY');

    // Auto-set intent and step if it's only inventory items
    useReactEffect(() => {
        if (inventoryOnly && loteItems.length > 0) {
            setBatchIntent('COMPRAR');
        }
    }, [inventoryOnly, loteItems.length]);

    const generateOrderNumber = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return `#LOTE-${result}`;
    };

    const performSubmission = async (uid: string) => {
        const currentUser = user || { email: "Sin email", displayName: "Usuario Registrado", photoURL: "" };

        try {
            showLoading("Ingresando al Búnker...");

            // Split items by origin
            const inventoryItems = loteItems.filter(i => i.source === 'INVENTORY');
            const discogsItems = loteItems.filter(i => i.source === 'DISCOGS');

            const tradeIds: string[] = [];

            // --- CAMINO A: Inventory items → Direct Sale (auto-resolved) ---
            if (inventoryItems.length > 0) {
                const inventoryIds = inventoryItems.map(item => item.id.toString());
                const manifestInventory = {
                    requestedItems: batchIntent === 'COMPRAR' ? inventoryIds : [],
                    offeredItems: batchIntent === 'VENDER' ? inventoryIds : [],
                    cashAdjustment: totalInventory
                };

                const invTradeId = await tradeService.createTrade({
                    participants: { senderId: uid, receiverId: ADMIN_UID },
                    manifest: manifestInventory,
                    tradeOrigin: 'INVENTORY'
                });
                tradeIds.push(invTradeId);
            }

            // --- CAMINO B: Discogs items → Exchange (negotiation, pending) ---
            if (discogsItems.length > 0) {
                const discogsIds = await Promise.all(discogsItems.map(async (item) => {
                    return await inventoryService.importFromDiscogs(
                        {
                            id: item.id,
                            title: item.title || `${item.artist} - ${item.album}`,
                            thumb: item.cover_image,
                            cover_image: item.cover_image
                        } as any,
                        {
                            stock: 0,
                            price: item.price || 0,
                            condition: item.condition,
                            status: 'archived'
                        }
                    );
                }));

                const manifestDiscogs = {
                    requestedItems: batchIntent === 'COMPRAR' ? discogsIds : [],
                    offeredItems: batchIntent === 'VENDER' ? discogsIds : [],
                    cashAdjustment: batchIntent === 'VENDER' ? Number(totalPrice) : totalEstimated
                };

                const discogsTradeId = await tradeService.createTrade({
                    participants: { senderId: uid, receiverId: ADMIN_UID },
                    manifest: manifestDiscogs,
                    tradeOrigin: 'DISCOGS'
                });
                tradeIds.push(discogsTradeId);
            }

            // --- REDIRECT ---
            clearLote();
            if (tradeIds.length === 1) {
                // Single order → go straight to the order page
                navigate(`/orden/${tradeIds[0]}`);
            } else {
                // Mixed lote → 2 orders created, go to activity feed
                navigate('/comercio');
            }

        } catch (error) {
            console.error("Submission error:", error);
            alert(TEXTS.revisarLote.batchReview.submissionError);
        } finally {
            hideLoading();
        }
    };

    // Handle "Añadir a Batea" — Save all lote items to user's personal collection
    const handleAddToBatea = async () => {
        if (!user) return;

        showLoading("Añadiendo a tu batea...");
        try {
            for (const item of loteItems) {
                // Parse artist from title if needed
                let parsedArtist = item.artist || '';
                let parsedTitle = item.title || item.album || '';
                if (!parsedArtist && parsedTitle.includes(' - ')) {
                    const parts = parsedTitle.split(' - ');
                    parsedArtist = parts[0].trim();
                    parsedTitle = parts.slice(1).join(' - ').trim();
                }

                await userAssetService.addAsset(user.uid, {
                    metadata: {
                        title: parsedTitle,
                        artist: parsedArtist || 'Desconocido',
                        year: 0,
                        genres: [],
                        styles: [],
                        format_description: item.format || 'Vinyl'
                    },
                    media: {
                        thumbnail: item.cover_image || '',
                        full_res_image_url: item.cover_image || ''
                    },
                    originalInventoryId: String(item.id),
                    valuation: item.price || 0
                });
            }

            clearLote();
            navigate('/perfil');
        } catch (error) {
            console.error('Error adding to batea:', error);
            alert('Error al añadir a tu batea. Inténtalo de nuevo.');
        } finally {
            hideLoading();
        }
    };

    const handleCheckout = async () => {
        if (isSubmitting) return; // Prevent double clicks

        if (!batchIntent) {
            alert(TEXTS.revisarLote.batchReview.confirmIntent);
            return;
        }
        if (batchIntent === 'VENDER' && (!totalPrice || Number(totalPrice) <= 0)) {
            alert(TEXTS.revisarLote.batchReview.validPriceRequired);
            return;
        }
        if (user) {
            await performSubmission(user.uid);
        }
    };

    const handleGoogleSignIn = async () => {
        if (!batchIntent) {
            alert(TEXTS.revisarLote.batchReview.confirmIntent);
            return;
        }
        if (batchIntent === 'VENDER' && (!totalPrice || Number(totalPrice) <= 0)) {
            alert(TEXTS.revisarLote.batchReview.validPriceRequired);
            return;
        }
        showLoading(TEXTS.revisarLote.batchReview.syncingGoogle);
        try {
            const googleUser = await signInWithGoogle();
            if (googleUser) {
                await performSubmission(googleUser.uid);
                setIsSuccess(true);
            }
        } catch (error) {
            console.error("Google Auth error:", error);
            alert(TEXTS.revisarLote.batchReview.googleLinkError);
        } finally {
            hideLoading();
        }
    };

    const handleAuthAction = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!email || !password) return;
        if (!batchIntent) {
            alert(TEXTS.revisarLote.batchReview.confirmIntent);
            return;
        }
        if (batchIntent === 'VENDER' && (!totalPrice || Number(totalPrice) <= 0)) {
            alert(TEXTS.revisarLote.batchReview.validPriceRequired);
            return;
        }

        showLoading(TEXTS.revisarLote.batchReview.authenticatingUser);
        try {
            const loggedUser = await authenticateUser(email, password);
            if (loggedUser) {
                await performSubmission(loggedUser.uid);
                setIsSuccess(true);
            }
        } catch (error) {
            console.error("Manual Auth error:", error);
            alert(TEXTS.revisarLote.batchReview.authError);
        } finally {
            hideLoading();
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center space-y-8 px-4 font-sans">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-24 h-24 bg-primary rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(204,255,0,0.3)]"
                >
                    <CheckCircle2 className="h-12 w-12 text-black" />
                </motion.div>
                <div className="space-y-4">
                    <h2 className="text-4xl md:text-6xl font-display font-black text-white uppercase tracking-tighter">{TEXTS.revisarLote.batchReview.batchRegistered}</h2>
                    <p className="text-gray-500 text-lg md:text-xl max-w-md mx-auto font-medium">
                        {TEXTS.revisarLote.batchReview.intentionsRegistered.split('Oldie but Goldie')[0]}<span className="text-primary">Oldie but Goldie</span>{TEXTS.revisarLote.batchReview.intentionsRegistered.split('Oldie but Goldie')[1]}
                    </p>
                </div>
                <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto">
                    {submittedOrder && (
                        <button
                            onClick={() => {
                                pushWhatsAppContactFromOrder(submittedOrder);
                                window.open(generateWhatsAppLink(submittedOrder), "_blank");
                            }}
                            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-green-500/20"
                        >
                            <MessageCircle className="h-5 w-5" />
                            {TEXTS.revisarLote.batchReview.contactWhatsApp}
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/')}
                        className="w-full bg-white/5 border border-white/10 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-white/10 transition-all"
                    >
                        {TEXTS.revisarLote.batchReview.backToStart}
                    </button>
                </div>
            </div>
        );
    }

    if (totalCount === 0) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
                <ShoppingBag className="h-20 w-20 text-white/10 mb-6" />
                <h2 className="text-3xl font-display font-black text-white uppercase tracking-tighter mb-4">{TEXTS.revisarLote.batchReview.batchEmpty}</h2>
                <button
                    onClick={() => navigate('/')}
                    className="bg-primary text-black px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all"
                >
                    {TEXTS.revisarLote.batchReview.exploreCatalog}
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 md:py-16 px-4 font-sans space-y-12">

            <header className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate('/')}
                    className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all text-white"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <h1 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-tighter">
                    {TEXTS.revisarLote.batchReview.reviewBatch.split(' ').slice(0, -1).join(' ')} <span className="text-primary">{TEXTS.revisarLote.batchReview.reviewBatch.split(' ').slice(-1)}</span>
                </h1>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* List Items Column */}
                <div className="lg:col-span-3 space-y-4">
                    {/* Mixed Lote Banner */}
                    {hasInventoryItems && hasDiscogsItems && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-gradient-to-r from-blue-500/10 to-emerald-500/10 border border-white/10 rounded-2xl p-4 flex items-start gap-3"
                        >
                            <Layers className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-white text-sm font-bold">Lote Mixto Detectado</p>
                                <p className="text-gray-400 text-xs mt-1">
                                    Se crearán <span className="text-emerald-400 font-bold">1 orden de compra directa</span> (entrega inmediata) y <span className="text-blue-400 font-bold">1 orden de intercambio</span> (negociación) de forma paralela.
                                </p>
                            </div>
                        </motion.div>
                    )}
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 italic">{TEXTS.revisarLote.batchReview.selectedDiscs} ({totalCount})</h3>
                    <AnimatePresence>
                        {loteItems.map((item) => (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                                className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center gap-4 relative pr-12 group"
                            >
                                <div className="w-16 h-16 rounded-xl overflow-hidden bg-black flex-shrink-0">
                                    <LazyImage
                                        src={item.cover_image}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-white font-bold truncate leading-tight">{item.title || (item.artist && item.album ? `${item.artist} - ${item.album}` : (item.album || "Sin Título"))}</h4>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border transition-all ${item.source === 'INVENTORY'
                                            ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-700/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                                            : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                            }`}>
                                            {item.source === 'INVENTORY' ? '🟢 ENTREGA INMEDIATA' : '🔵 PEDIDO'}
                                        </div>
                                        <span className="text-xs text-gray-500 font-bold">{item.format} • {item.condition}</span>
                                        {item.price && (
                                            <span className="text-xs text-primary font-mono ml-auto">
                                                {item.currency === "USD" ? "US$" : "$"}{item.price.toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => toggleItem(item)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                                    title={TEXTS.global.common.close}
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Checkout / Auth Column */}
                <div className="lg:col-span-2">
                    <div className="bg-[#0A0A0A] border-2 border-primary/40 rounded-[2rem] p-6 md:p-8 space-y-6 sticky top-24 shadow-2xl">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <h3 className="text-2xl font-display font-black text-white uppercase tracking-tighter">{TEXTS.revisarLote.batchReview.processOrder}</h3>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-relaxed">
                                    {TEXTS.revisarLote.batchReview.processDescription}
                                </p>
                            </div>

                            {/* Total Summary for Hybrid Items */}
                            <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5">
                                <div className="p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Resumen del Lote</span>
                                        <span className="text-[10px] font-black text-gray-400 bg-white/5 px-2 py-0.5 rounded italic">
                                            {loteItems.length} {loteItems.length === 1 ? 'Ítem' : 'Ítems'}
                                        </span>
                                    </div>

                                    {hasInventoryItems && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black text-emerald-400/80 uppercase tracking-widest flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                En Stock
                                            </span>
                                            <span className="text-xs font-mono text-white/90">
                                                ${totalInventory.toLocaleString()}
                                            </span>
                                        </div>
                                    )}

                                    {hasDiscogsItems && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black text-blue-400/80 uppercase tracking-widest flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                Pedidos (Est.)
                                            </span>
                                            <span className="text-xs font-mono text-white/90">
                                                ${totalEstimated.toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 bg-primary/5 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-primary uppercase tracking-[0.2em] mb-1">Total Final del Lote</span>
                                        <span className="text-xs text-white/40 font-bold uppercase tracking-widest leading-none">A Confirmar</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-2xl font-display font-black text-white drop-shadow-2xl">
                                            ${calculatedTotal.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Global Action Selector - ONLY show if there are Discogs items */}
                        {hasDiscogsItems ? (
                            <div className="space-y-3">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] block mb-2 px-1">
                                    ¿Qué quieres hacer con tus pedidos?
                                </span>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setBatchIntent('COMPRAR')}
                                        className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-1.5 ${batchIntent === 'COMPRAR'
                                            ? 'bg-primary/20 border-primary text-primary'
                                            : 'bg-white/[0.03] border-white/10 text-gray-400 hover:border-white/20'
                                            }`}
                                    >
                                        <div className={`p-1.5 rounded-lg ${batchIntent === 'COMPRAR' ? 'bg-primary text-black' : 'bg-white/5 text-gray-500'}`}>
                                            <ShoppingBag className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Quiero Comprar</span>
                                    </button>
                                    <button
                                        onClick={() => setBatchIntent('VENDER')}
                                        className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-1.5 ${batchIntent === 'VENDER'
                                            ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                                            : 'bg-white/[0.03] border-white/10 text-gray-400 hover:border-white/20'
                                            }`}
                                    >
                                        <div className={`p-1.5 rounded-lg ${batchIntent === 'VENDER' ? 'bg-orange-500 text-black' : 'bg-white/5 text-gray-500'}`}>
                                            <Disc className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Quiero Vender</span>
                                    </button>
                                </div>
                                {batchIntent === null && (
                                    <p className="text-[9px] text-orange-400 font-bold px-1 animate-pulse">
                                        ⚠️ Por favor, define si quieres comprar o vender tus pedidos para continuar.
                                    </p>
                                )}
                            </div>
                        ) : (
                            // No intent selection needed for inventory-only, but inform the user or keep it silent
                            <div className="px-1 py-1">
                                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                    Venta Directa: {totalCount} {totalCount === 1 ? 'ítem' : 'ítems'} listos para el Búnker
                                </span>
                            </div>
                        )}

                        {batchIntent === 'VENDER' && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="pt-4 space-y-2 border-t border-white/5"
                            >
                                <h4 className="text-white font-black uppercase text-[10px] tracking-widest text-center">{TEXTS.revisarLote.batchReview.intendedPrice}</h4>
                                <div className="flex flex-col md:flex-row bg-black/50 p-1.5 rounded-xl gap-2 w-full">
                                    <select
                                        value={currency}
                                        onChange={(e) => setCurrency(e.target.value as 'ARS' | 'USD')}
                                        className="w-full md:w-[30%] bg-[#111] border border-white/10 text-white rounded-lg px-3 py-3 md:py-4 text-xs font-bold focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/40 text-center cursor-pointer"
                                    >
                                        <option value="ARS">ARS $</option>
                                        <option value="USD">USD $</option>
                                    </select>
                                    <input
                                        type="number"
                                        min="0"
                                        value={totalPrice}
                                        onChange={(e) => setTotalPrice(e.target.value)}
                                        placeholder="Ej: 50000"
                                        className="w-full md:w-[70%] bg-white/5 border border-white/10 text-white rounded-lg px-4 py-3 md:py-4 text-sm font-bold focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/40 text-center"
                                    />
                                </div>
                            </motion.div>
                        )}
                    </div>

                    {user ? (
                        <div className="space-y-3">
                            <button
                                onClick={handleCheckout}
                                disabled={isSubmitting || (hasDiscogsItems && !batchIntent) || (batchIntent === 'VENDER' && (!totalPrice || Number(totalPrice) <= 0))}
                                className="w-full bg-primary text-black py-6 rounded-2xl font-black uppercase text-sm tracking-widest shadow-[0_0_40px_rgba(204,255,0,0.2)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <div className="h-4 w-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                                ) : (
                                    <> <ShoppingBag className="w-4 h-4" /> {TEXTS.revisarLote.batchReview.confirmAndSend} </>
                                )}
                            </button>

                            <div className="relative flex items-center gap-4 py-1">
                                <div className="flex-1 h-px bg-white/10" />
                                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">o bien</span>
                                <div className="flex-1 h-px bg-white/10" />
                            </div>

                            <button
                                onClick={handleAddToBatea}
                                disabled={isSubmitting}
                                className="w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/30 text-violet-400 hover:from-violet-500/20 hover:to-purple-500/20 hover:text-violet-300 disabled:opacity-50"
                            >
                                <Disc className="w-4 h-4" />
                                AÑADIR TODO A MI BATEA
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <button
                                onClick={handleGoogleSignIn}
                                disabled={!batchIntent || (batchIntent === 'VENDER' && (!totalPrice || Number(totalPrice) <= 0))}
                                className="w-full bg-white text-black py-4 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 hover:bg-primary transition-all shadow-lg disabled:opacity-50"
                            >
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-4 h-4" />
                                {TEXTS.revisarLote.batchReview.linkGoogle}
                            </button>

                            <div className="relative flex items-center gap-4 py-2">
                                <div className="flex-1 h-px bg-white/10" />
                                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">{TEXTS.revisarLote.batchReview.manualAuth}</span>
                                <div className="flex-1 h-px bg-white/10" />
                            </div>

                            <form onSubmit={handleAuthAction} className="space-y-4">
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-700" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder={`${TEXTS.login.auth.emailPlaceholder}...`}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-sm text-white focus:border-primary/40 focus:outline-none transition-all"
                                    />
                                </div>
                                <div className="relative">
                                    <Layers className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-700" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="Clave..."
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-sm text-white focus:border-primary/40 focus:outline-none transition-all"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !batchIntent || (batchIntent === 'VENDER' && (!totalPrice || Number(totalPrice) <= 0))}
                                    className="w-full bg-primary text-black py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? TEXTS.revisarLote.batchReview.connecting : TEXTS.revisarLote.batchReview.registerAndSend}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
