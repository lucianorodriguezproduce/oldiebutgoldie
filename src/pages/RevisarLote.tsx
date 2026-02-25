import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, X, CheckCircle2, MessageCircle, Mail, Layers, ChevronLeft } from "lucide-react";
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
                const q = query(collection(db, "orders"), where("__name__", "in", ids));
                const snapshot = await getDocs(q);

                const soldItems: string[] = [];
                const updatedItemsMap = new Map(snapshot.docs.map(doc => [doc.id, doc.data()]));

                inventoryItems.forEach(item => {
                    const freshData = updatedItemsMap.get(item.id.toString()) as any;
                    if (freshData && ['sold', 'venta_finalizada', 'completed'].includes(freshData.status)) {
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

    const calculatedTotal = loteItems.reduce((acc, item) => acc + (item.price || 0), 0);
    const hasInventoryItems = loteItems.some(item => item.source === 'INVENTORY');

    const generateOrderNumber = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return `#LOTE-${result}`;
    };

    const performSubmission = async (uid: string) => {
        const currentUser = user || { email: "Sin email", displayName: "Usuario Registrado", photoURL: "" };

        const payload: any = {
            user_id: uid,
            user_email: currentUser?.email || "Sin email",
            user_name: currentUser?.displayName || "Usuario Registrado",
            user_photo: currentUser?.photoURL || "",
            thumbnailUrl: loteItems[0]?.cover_image || "https://raw.githubusercontent.com/lucianorodriguezproduce/buscadordiscogs2/refs/heads/main/public/obg.png",
            order_number: generateOrderNumber(),
            isBatch: true,
            status: 'pending',
            type: batchIntent === 'COMPRAR' ? 'buy' : 'sell',
            totalPrice: batchIntent === 'VENDER' ? Number(totalPrice) : null,
            currency: batchIntent === 'VENDER' ? currency : null,
            timestamp: serverTimestamp(),
            createdAt: serverTimestamp(),
            items: loteItems.map(item => ({
                id: item.id || Math.floor(Math.random() * 1000000),
                discogs_id: item.id,
                title: item.album || item.title || "Sin Título",
                artist: item.artist || "Varios",
                album: item.album || item.title || "Sin Título",
                cover_image: item.cover_image || "https://raw.githubusercontent.com/lucianorodriguezproduce/buscadordiscogs2/refs/heads/main/public/obg.png",
                format: item.format || "No especificado",
                condition: item.condition || "No especificado",
                price: item.price || 0,
                currency: item.currency || "ARS",
            })),
            details: {
                intent: batchIntent,
            },
        };

        // Clean payload to prevent undefined errors in Firestore
        if (!payload.type) {
            alert(TEXTS.common.batchReview.systemError);
            return;
        }

        // Deep clean function to recursively remove undefined
        const cleanObject = (obj: any): any => {
            if (Array.isArray(obj)) return obj.map(cleanObject);
            if (obj !== null && typeof obj === 'object') {
                return Object.entries(obj).reduce((acc, [key, value]) => {
                    if (value !== undefined) {
                        acc[key] = cleanObject(value);
                    }
                    return acc;
                }, {} as any);
            }
            return obj;
        };

        const safePayload = cleanObject(payload);

        // Wait for DB insertion
        const docRef = await addDoc(collection(db, "orders"), safePayload);

        // Inject the created UUID so WhatsApp module can build /orden/:id
        const completeOrder = { id: docRef.id, ...safePayload };
        setSubmittedOrder(completeOrder);
        clearLote();
    };

    const handleCheckout = async () => {
        if (isSubmitting) return; // Prevent double clicks

        if (!batchIntent) {
            alert(TEXTS.common.batchReview.confirmIntent);
            return;
        }
        if (batchIntent === 'VENDER' && (!totalPrice || Number(totalPrice) <= 0)) {
            alert(TEXTS.common.batchReview.validPriceRequired);
            return;
        }
        if (user) {
            showLoading(TEXTS.common.batchReview.processingOrder);
            try {
                await performSubmission(user.uid);
                setIsSuccess(true);
            } catch (error) {
                console.error("Submission error:", error);
                alert(TEXTS.common.batchReview.submissionError);
            } finally {
                hideLoading();
            }
        }
    };

    const handleGoogleSignIn = async () => {
        if (!batchIntent) {
            alert(TEXTS.common.batchReview.confirmIntent);
            return;
        }
        if (batchIntent === 'VENDER' && (!totalPrice || Number(totalPrice) <= 0)) {
            alert(TEXTS.common.batchReview.validPriceRequired);
            return;
        }
        showLoading(TEXTS.common.batchReview.syncingGoogle);
        try {
            const googleUser = await signInWithGoogle();
            if (googleUser) {
                await performSubmission(googleUser.uid);
                setIsSuccess(true);
            }
        } catch (error) {
            console.error("Google Auth error:", error);
            alert(TEXTS.common.batchReview.googleLinkError);
        } finally {
            hideLoading();
        }
    };

    const handleAuthAction = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!email || !password) return;
        if (!batchIntent) {
            alert(TEXTS.common.batchReview.confirmIntent);
            return;
        }
        if (batchIntent === 'VENDER' && (!totalPrice || Number(totalPrice) <= 0)) {
            alert(TEXTS.common.batchReview.validPriceRequired);
            return;
        }

        showLoading(TEXTS.common.batchReview.authenticatingUser);
        try {
            const loggedUser = await authenticateUser(email, password);
            if (loggedUser) {
                await performSubmission(loggedUser.uid);
                setIsSuccess(true);
            }
        } catch (error) {
            console.error("Manual Auth error:", error);
            alert(TEXTS.common.batchReview.authError);
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
                    <h2 className="text-4xl md:text-6xl font-display font-black text-white uppercase tracking-tighter">{TEXTS.common.batchReview.batchRegistered}</h2>
                    <p className="text-gray-500 text-lg md:text-xl max-w-md mx-auto font-medium">
                        {TEXTS.common.batchReview.intentionsRegistered.split('Oldie but Goldie')[0]}<span className="text-primary">Oldie but Goldie</span>{TEXTS.common.batchReview.intentionsRegistered.split('Oldie but Goldie')[1]}
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
                            {TEXTS.common.batchReview.contactWhatsApp}
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/')}
                        className="w-full bg-white/5 border border-white/10 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-white/10 transition-all"
                    >
                        {TEXTS.common.batchReview.backToStart}
                    </button>
                </div>
            </div>
        );
    }

    if (totalCount === 0) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
                <ShoppingBag className="h-20 w-20 text-white/10 mb-6" />
                <h2 className="text-3xl font-display font-black text-white uppercase tracking-tighter mb-4">{TEXTS.common.batchReview.batchEmpty}</h2>
                <button
                    onClick={() => navigate('/')}
                    className="bg-primary text-black px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all"
                >
                    {TEXTS.common.batchReview.exploreCatalog}
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
                    {TEXTS.common.batchReview.reviewBatch.split(' ').slice(0, -1).join(' ')} <span className="text-primary">{TEXTS.common.batchReview.reviewBatch.split(' ').slice(-1)}</span>
                </h1>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* List Items Column */}
                <div className="lg:col-span-3 space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 italic">{TEXTS.common.batchReview.selectedDiscs} ({totalCount})</h3>
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
                                    <h4 className="text-white font-bold truncate leading-tight">{item.title}</h4>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${item.source === 'INVENTORY'
                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                            : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                            }`}>
                                            {item.source === 'INVENTORY' ? 'ENTREGA INMEDIATA' : 'PEDIDO INTERNACIONAL'}
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
                                    title={TEXTS.common.close}
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
                                <h3 className="text-2xl font-display font-black text-white uppercase tracking-tighter">{TEXTS.common.batchReview.processOrder}</h3>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-relaxed">
                                    {TEXTS.common.batchReview.processDescription}
                                </p>
                            </div>

                            {/* Total Summary for Hybrid Items */}
                            <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Resumen del Lote</span>
                                    <p className="text-[10px] text-white/60 leading-tight">
                                        {loteItems.length} {loteItems.length === 1 ? 'Ítem' : 'Ítems'} registrados
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="text-[8px] font-black text-primary uppercase tracking-widest block mb-1">Total Estimado</span>
                                    <span className="text-2xl font-display font-black text-white">
                                        ${calculatedTotal.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl space-y-4">
                            <h4 className="text-white font-black uppercase text-[10px] tracking-widest text-center">{TEXTS.common.batchReview.batchIntent}</h4>
                            <div className="flex bg-black/50 p-1.5 rounded-xl">
                                <button
                                    onClick={() => setBatchIntent('COMPRAR')}
                                    className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${batchIntent === 'COMPRAR'
                                        ? 'bg-green-600 text-white shadow-[0_0_20px_rgba(22,163,74,0.4)]'
                                        : 'text-gray-500 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {TEXTS.common.batchReview.iWantToBuy}
                                </button>
                                <button
                                    onClick={() => setBatchIntent('VENDER')}
                                    className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${batchIntent === 'VENDER'
                                        ? 'bg-orange-600 text-white shadow-[0_0_20px_rgba(234,88,12,0.4)]'
                                        : 'text-gray-500 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {TEXTS.common.batchReview.iWantToSell}
                                </button>
                            </div>

                            {batchIntent === 'VENDER' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="pt-4 space-y-2 border-t border-white/5"
                                >
                                    <h4 className="text-white font-black uppercase text-[10px] tracking-widest text-center">{TEXTS.common.batchReview.intendedPrice}</h4>
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
                            <button
                                onClick={handleCheckout}
                                disabled={isSubmitting || !batchIntent || (batchIntent === 'VENDER' && (!totalPrice || Number(totalPrice) <= 0))}
                                className="w-full bg-primary text-black py-6 rounded-2xl font-black uppercase text-sm tracking-widest shadow-[0_0_40px_rgba(204,255,0,0.2)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <div className="h-4 w-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                                ) : (
                                    <> <ShoppingBag className="w-4 h-4" /> {TEXTS.common.batchReview.confirmAndSend} </>
                                )}
                            </button>
                        ) : (
                            <div className="space-y-6">
                                <button
                                    onClick={handleGoogleSignIn}
                                    disabled={!batchIntent || (batchIntent === 'VENDER' && (!totalPrice || Number(totalPrice) <= 0))}
                                    className="w-full bg-white text-black py-4 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 hover:bg-primary transition-all shadow-lg disabled:opacity-50"
                                >
                                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-4 h-4" />
                                    {TEXTS.common.batchReview.linkGoogle}
                                </button>

                                <div className="relative flex items-center gap-4 py-2">
                                    <div className="flex-1 h-px bg-white/10" />
                                    <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">{TEXTS.common.batchReview.manualAuth}</span>
                                    <div className="flex-1 h-px bg-white/10" />
                                </div>

                                <form onSubmit={handleAuthAction} className="space-y-4">
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-700" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            placeholder={`${TEXTS.common.auth.emailPlaceholder}...`}
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
                                        {isSubmitting ? TEXTS.common.batchReview.connecting : TEXTS.common.batchReview.registerAndSend}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
