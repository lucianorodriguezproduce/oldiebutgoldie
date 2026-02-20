import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, CheckCircle2, Mail, Layers, DollarSign, TrendingUp } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useDebounce } from "@/hooks/useDebounce";
import { discogsService, type DiscogsSearchResult } from "@/lib/discogs";
import { authenticateUser, signInWithGoogle } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";

type Intent = "COMPRAR" | "VENDER";
type Format = "CD" | "VINILO" | "CASSETTE" | "OTROS";
type Condition = "NUEVO" | "USADO";
type Currency = "ARS" | "USD";

export default function Home() {
    const { user } = useAuth();

    const [intent, setIntent] = useState<Intent | null>(null);
    const [query, setQuery] = useState("");
    const [format, setFormat] = useState<Format | null>(null);
    const [condition, setCondition] = useState<Condition | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [step, setStep] = useState(1);

    // Sell-specific states
    const [price, setPrice] = useState("");
    const [currency, setCurrency] = useState<Currency>("ARS");
    const [marketPrice, setMarketPrice] = useState<number | null>(null);
    const [isLoadingMarket, setIsLoadingMarket] = useState(false);

    const [searchResults, setSearchResults] = useState<DiscogsSearchResult[]>([]);
    const [isLoadingSearch, setIsLoadingSearch] = useState(false);
    const [selectedItem, setSelectedItem] = useState<DiscogsSearchResult | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    // Local Auth UI states (only for the manual form)
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const debouncedQuery = useDebounce(query, 500);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Auto-scroll on step change
    useEffect(() => {
        scrollToTop();
    }, [step, selectedItem]);

    // Effect for real-time Discogs search
    useEffect(() => {
        const performSearch = async () => {
            if (debouncedQuery.trim().length >= 3 && !selectedItem) {
                setIsLoadingSearch(true);
                try {
                    const { results, pagination } = await discogsService.searchReleases(debouncedQuery, 1);
                    setSearchResults(results);
                    setHasMore(pagination.pages > 1);
                    setCurrentPage(1);
                    setShowDropdown(true);
                } catch (error) {
                    console.error("Search error:", error);
                } finally {
                    setIsLoadingSearch(false);
                }
            } else if (!selectedItem) {
                setSearchResults([]);
                setShowDropdown(false);
                setHasMore(false);
            }
        };
        performSearch();
    }, [debouncedQuery, selectedItem]);

    const handleLoadMore = async () => {
        if (isLoadingSearch || !hasMore) return;
        setIsLoadingSearch(true);
        try {
            const nextPage = currentPage + 1;
            const { results, pagination } = await discogsService.searchReleases(debouncedQuery, nextPage);
            setSearchResults(prev => [...prev, ...results]);
            setCurrentPage(nextPage);
            setHasMore(pagination.page < pagination.pages);
        } catch (error) {
            console.error("Load more error:", error);
        } finally {
            setIsLoadingSearch(false);
        }
    };

    const handleSelectResult = (result: DiscogsSearchResult) => {
        setSelectedItem(result);
        setShowDropdown(false);
    };

    const handleResetSelection = () => {
        setSelectedItem(null);
        setQuery("");
        setFormat(null);
        setCondition(null);
        setIntent(null);
        setPrice("");
        setCurrency("ARS");
        setMarketPrice(null);
        setIsLoadingMarket(false);
        setSearchResults([]);
        setShowDropdown(false);
        setHasMore(false);
        setStep(1);
    };

    const generateOrderNumber = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return `#ORD-${result}`;
    };

    const buildOrderPayload = (uid: string) => {
        if (!selectedItem || !format || !condition || !intent) return null;

        const currentUser = auth.currentUser;

        const payload: any = {
            user_id: uid,
            user_email: currentUser?.email || "Sin email",
            user_name: currentUser?.displayName || "Usuario Registrado",
            user_photo: currentUser?.photoURL || "",
            order_number: generateOrderNumber(),
            item_id: selectedItem.id,
            details: {
                format,
                condition,
                intent,
                artist: selectedItem.title.split(' - ')[0],
                album: selectedItem.title.split(' - ')[1] || selectedItem.title,
                cover_image: selectedItem.cover_image || selectedItem.thumb || '',
            },
            timestamp: serverTimestamp(),
            status: 'pending'
        };

        // Add pricing info for VENDER orders
        if (intent === "VENDER" && price) {
            payload.details.price = parseFloat(price);
            payload.details.currency = currency;
        }

        // Attach market reference for margin analysis
        payload.market_reference = marketPrice;

        return payload;
    };

    const performSubmission = async (uid: string) => {
        const payload = buildOrderPayload(uid);
        if (!payload) return;
        await addDoc(collection(db, "orders"), payload);
    };

    // Fetch market price from Discogs for the selected release
    const fetchMarketPrice = async () => {
        if (!selectedItem) return;
        setIsLoadingMarket(true);
        try {
            const releaseData = await discogsService.getReleaseDetails(selectedItem.id.toString());
            if (releaseData?.lowest_price) {
                setMarketPrice(releaseData.lowest_price);
            } else {
                setMarketPrice(null);
            }
        } catch (error) {
            console.error("Market price fetch error:", error);
            setMarketPrice(null);
        } finally {
            setIsLoadingMarket(false);
        }
    };

    // Handle intent selection — if user is logged in, skip auth
    const handleIntentSelect = async (selectedIntent: Intent) => {
        setIntent(selectedIntent);

        // For VENDER, fetch market price and go to pricing step
        if (selectedIntent === "VENDER") {
            fetchMarketPrice();
            setStep(2); // price step
            return;
        }

        // For COMPRAR: if already logged in, submit directly
        if (user) {
            setIsSubmitting(true);
            try {
                await performSubmission(user.uid);
                setIsSuccess(true);
                scrollToTop();
            } catch (error) {
                console.error("Submission error:", error);
                alert("Error al procesar el pedido.");
            } finally {
                setIsSubmitting(false);
            }
        } else {
            setStep(3); // auth step
        }
    };

    // Handle price confirmation for VENDER
    const handlePriceConfirm = async () => {
        if (!price || parseFloat(price) <= 0) {
            alert("Ingresa un precio válido.");
            return;
        }

        // If already logged in, submit directly
        if (user) {
            setIsSubmitting(true);
            try {
                await performSubmission(user.uid);
                setIsSuccess(true);
                scrollToTop();
            } catch (error) {
                console.error("Submission error:", error);
                alert("Error al procesar el pedido.");
            } finally {
                setIsSubmitting(false);
            }
        } else {
            setStep(3); // auth step
        }
    };

    const handleGoogleSignIn = async () => {
        setIsSubmitting(true);
        try {
            const googleUser = await signInWithGoogle();
            if (googleUser) {
                await performSubmission(googleUser.uid);
                setIsSuccess(true);
                scrollToTop();
            }
        } catch (error) {
            console.error("Google Auth error:", error);
            alert("Error al vincular con Google.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAuthAction = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!email || !password) return;

        setIsSubmitting(true);
        try {
            const loggedUser = await authenticateUser(email, password);
            if (loggedUser) {
                await performSubmission(loggedUser.uid);
                setIsSuccess(true);
                scrollToTop();
            }
        } catch (error) {
            console.error("Manual Auth error:", error);
            alert("Error en autenticación. Verifique sus credenciales.");
        } finally {
            setIsSubmitting(false);
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
                    <h2 className="text-4xl md:text-6xl font-display font-black text-white uppercase tracking-tighter">Pedido Vinculado</h2>
                    <p className="text-gray-500 text-lg md:text-xl max-w-md mx-auto font-medium">
                        Tu intención ha sido registrada. <span className="text-primary">Oldie but Goldie</span> procesará tu pedido vinculado a su cuenta.
                    </p>
                </div>
                <button
                    onClick={() => {
                        setIsSuccess(false);
                        handleResetSelection();
                    }}
                    className="bg-white/5 border border-white/10 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-white/10 transition-all"
                >
                    Nueva Búsqueda
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 md:py-20 flex flex-col items-center justify-center min-h-[80vh] px-4 font-sans">
            <AnimatePresence mode="wait">
                {!selectedItem ? (
                    <motion.div
                        key="step1-search-container"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full space-y-12 text-center"
                    >
                        <header className="space-y-4">
                            <div className="flex items-center justify-center gap-3 mb-2">
                                <div className="h-2 w-2 bg-primary animate-pulse rounded-full" />
                                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/60">Sistema de Intención v4.5</span>
                            </div>
                            <h1 className="text-4xl md:text-7xl font-display font-black text-white uppercase tracking-tightest leading-[0.85]">
                                Protocolo <br />
                                <span className="text-primary text-5xl md:text-8xl">Buscador</span>
                            </h1>
                        </header>

                        <div className="relative group w-full">
                            <Search className="absolute left-6 md:left-8 top-1/2 -translate-y-1/2 h-5 md:h-6 w-5 md:w-6 text-gray-500 group-focus-within:text-primary transition-colors" />
                            <input
                                id="searchQuery"
                                name="searchQuery"
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Artista, Álbum o Referencia..."
                                className="w-full bg-white/5 border-2 border-white/5 hover:border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] py-8 md:py-10 pl-16 md:pl-20 pr-8 md:pr-10 text-xl md:text-2xl font-bold text-white placeholder:text-gray-700 focus:outline-none focus:border-primary/50 transition-all focus:bg-black/40 shadow-2xl"
                            />

                            <AnimatePresence>
                                {showDropdown && searchResults.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute left-0 right-0 top-full mt-2 bg-[#0A0A0A] border-2 border-white/10 rounded-[1.5rem] md:rounded-3xl overflow-hidden z-50 shadow-[0_30px_60px_rgba(0,0,0,0.9)]"
                                    >
                                        <div className="max-h-[350px] md:max-h-[400px] overflow-y-auto custom-scrollbar">
                                            {searchResults.map((result) => (
                                                <button
                                                    key={`${result.id}-${result.type}`}
                                                    type="button"
                                                    onClick={() => handleSelectResult(result)}
                                                    className="w-full p-5 md:p-6 flex items-center gap-4 md:gap-6 hover:bg-primary/5 transition-colors border-b border-white/5 last:border-0 text-left group"
                                                >
                                                    <div className="w-12 md:w-16 h-12 md:h-16 rounded-lg md:rounded-xl overflow-hidden bg-white/5 flex-shrink-0 border border-white/10">
                                                        <img src={result.thumb} alt="" className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-base md:text-lg font-bold text-white truncate group-hover:text-primary transition-colors">{result.title}</h4>
                                                    </div>
                                                    <ChevronRight className="h-4 md:h-5 w-4 md:w-5 text-gray-800 group-hover:text-primary transition-colors" />
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="steps-container"
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-12 md:space-y-16 w-full"
                    >
                        <header className="text-center md:text-left">
                            <h2 className="text-3xl md:text-5xl font-display font-black text-white uppercase tracking-tighter">Detalle de Obra</h2>
                        </header>

                        {/* Selection Card */}
                        <div className="bg-[#050505] border-2 border-primary rounded-[1.5rem] md:rounded-[3rem] overflow-hidden shadow-[0_0_80px_rgba(204,255,0,0.12)] group relative w-full">
                            <div className="flex flex-col md:flex-row">
                                <div className="w-full md:w-2/5 aspect-square relative overflow-hidden">
                                    <img
                                        src={selectedItem.cover_image || selectedItem.thumb}
                                        alt={selectedItem.title}
                                        className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-700"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                                </div>
                                <div className="flex-1 p-8 md:p-12 space-y-8 flex flex-col justify-center">
                                    <h3 className="text-3xl lg:text-4xl font-display font-black text-white uppercase tracking-tighter leading-none">{selectedItem.title}</h3>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Año</p>
                                            <p className="text-white font-bold">{selectedItem.year || "N/A"}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Género</p>
                                            <p className="text-primary font-bold">{selectedItem.genre?.[0] || "N/A"}</p>
                                        </div>
                                    </div>
                                    <button onClick={handleResetSelection} className="text-[10px] font-black uppercase tracking-widest text-gray-700 hover:text-primary transition-colors underline decoration-primary/20">Cambiar Selección</button>
                                </div>
                            </div>
                        </div>

                        {/* Step 1: Format, Condition, Intent */}
                        {step === 1 && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-12"
                            >
                                <div className="space-y-6">
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 italic block px-4"> [ 01 ] Seleccionar Formato </label>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                        {(["VINILO", "CD", "CASSETTE", "OTROS"] as Format[]).map(f => (
                                            <button
                                                key={f}
                                                onClick={() => setFormat(f)}
                                                className={`py-5 rounded-2xl text-xs font-black tracking-widest border-2 transition-all ${format === f ? 'bg-primary border-primary text-black' : 'bg-white/5 border-white/5 text-gray-500'}`}
                                            >
                                                {f}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 italic block px-4"> [ 02 ] Estado </label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {(["NUEVO", "USADO"] as Condition[]).map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setCondition(c)}
                                                className={`py-5 rounded-2xl text-xs font-black tracking-widest border-2 transition-all ${condition === c ? 'bg-primary border-primary text-black' : 'bg-white/5 border-white/5 text-gray-500'}`}
                                            >
                                                {c === "NUEVO" ? "NUEVO / MINT" : "USADO / VG+"}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {format && condition && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-8 border-t border-white/5">
                                        <button
                                            onClick={() => handleIntentSelect("COMPRAR")}
                                            disabled={isSubmitting}
                                            className="bg-white/10 hover:bg-primary hover:text-black py-8 rounded-[1.5rem] font-black uppercase tracking-tighter text-2xl md:text-3xl transition-all disabled:opacity-50"
                                        >
                                            {isSubmitting && intent === "COMPRAR" ? "Procesando..." : "Comprar"}
                                        </button>
                                        <button
                                            onClick={() => handleIntentSelect("VENDER")}
                                            className="bg-white/10 hover:bg-primary hover:text-black py-8 rounded-[1.5rem] font-black uppercase tracking-tighter text-2xl md:text-3xl transition-all"
                                        >
                                            Vender
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Step 2: (VENDER only) Price & Currency */}
                        {step === 2 && intent === "VENDER" && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-[#0A0A0A] border-2 border-primary/40 rounded-[2rem] p-8 md:p-12 space-y-10 shadow-2xl"
                            >
                                <div className="text-center space-y-4">
                                    <h3 className="text-3xl md:text-4xl font-display font-black text-white uppercase tracking-tighter">Precio de Venta</h3>
                                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest italic">Establecer valor de mercado para tu pieza</p>
                                </div>

                                {/* Market Price Anchor */}
                                {isLoadingMarket ? (
                                    <div className="flex items-center justify-center gap-3 py-4 px-6 bg-white/[0.02] border border-white/5 rounded-xl">
                                        <div className="h-3 w-3 border-2 border-yellow-500/40 border-t-yellow-500 rounded-full animate-spin" />
                                        <span className="text-[10px] font-mono font-bold text-gray-600 uppercase tracking-widest">Consultando valor de mercado global...</span>
                                    </div>
                                ) : marketPrice !== null && (
                                    <div className="flex items-center gap-3 py-4 px-6 bg-yellow-500/[0.04] border border-yellow-500/10 rounded-xl">
                                        <TrendingUp className="h-4 w-4 text-yellow-500/70 flex-shrink-0" />
                                        <span className="text-[11px] font-mono font-bold text-yellow-500/80 uppercase tracking-wider">
                                            Valor de referencia global (Discogs): US$ {marketPrice.toFixed(2)}
                                        </span>
                                    </div>
                                )}

                                <div className="space-y-6">
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 italic block px-4"> [ 03 ] Moneda </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {(["ARS", "USD"] as Currency[]).map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setCurrency(c)}
                                                className={`py-5 rounded-2xl text-xs font-black tracking-widest border-2 transition-all flex items-center justify-center gap-2 ${currency === c ? 'bg-primary border-primary text-black' : 'bg-white/5 border-white/5 text-gray-500'}`}
                                            >
                                                <DollarSign className="h-4 w-4" />
                                                {c === "ARS" ? "Pesos Argentinos" : "Dólares USD"}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 italic block px-4"> [ 04 ] Precio </label>
                                    <div className="relative">
                                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500 font-black text-lg">
                                            {currency === "ARS" ? "$" : "US$"}
                                        </span>
                                        <input
                                            id="sell_price"
                                            name="price"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={price}
                                            onChange={e => setPrice(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-6 pl-16 pr-8 text-white text-2xl font-black focus:border-primary/40 focus:outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handlePriceConfirm}
                                    disabled={isSubmitting || !price}
                                    className="w-full bg-primary text-black py-8 rounded-2xl font-black uppercase text-xs tracking-widest shadow-[0_0_40px_rgba(204,255,0,0.2)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? "PROCESANDO..." : "CONFIRMAR PRECIO Y PUBLICAR"}
                                </button>

                                <button onClick={() => { setIntent(null); setStep(1); }} className="w-full text-[10px] font-black uppercase text-gray-700 hover:text-white transition-colors">Atrás</button>
                            </motion.div>
                        )}

                        {/* Step 3: Auth (only if NOT logged in) */}
                        {step === 3 && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-[#0A0A0A] border-2 border-primary/40 rounded-[2rem] p-8 md:p-12 space-y-10 shadow-2xl"
                            >
                                <div className="text-center space-y-4">
                                    <h3 className="text-3xl md:text-4xl font-display font-black text-white uppercase tracking-tighter">Vincular Red</h3>
                                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest italic">Protocolo de seguridad para persistir intención</p>
                                </div>

                                <div className="space-y-6">
                                    <button
                                        onClick={handleGoogleSignIn}
                                        className="w-full bg-white text-black py-6 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-4 hover:bg-primary transition-all"
                                    >
                                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5" />
                                        Continuar con Google
                                    </button>

                                    <div className="relative flex items-center gap-4 py-2">
                                        <div className="flex-1 h-px bg-white/10" />
                                        <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">O Credenciales Manuales</span>
                                        <div className="flex-1 h-px bg-white/10" />
                                    </div>

                                    <form onSubmit={handleAuthAction} className="space-y-4">
                                        <div className="relative">
                                            <Mail className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-700" />
                                            <input
                                                id="auth_email"
                                                name="email"
                                                type="email"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                placeholder="Email de Terminal..."
                                                className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-6 pl-16 pr-8 text-white focus:border-primary/40 focus:outline-none transition-all"
                                            />
                                        </div>
                                        <div className="relative">
                                            <Layers className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-700" />
                                            <input
                                                id="auth_password"
                                                name="password"
                                                type="password"
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                                placeholder="Clave Técnica..."
                                                className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-6 pl-16 pr-8 text-white focus:border-primary/40 focus:outline-none transition-all"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="w-full bg-primary text-black py-8 rounded-2xl font-black uppercase text-xs tracking-widest shadow-[0_0_40px_rgba(204,255,0,0.2)] hover:scale-[1.02] active:scale-95 transition-all"
                                        >
                                            {isSubmitting ? "CONECTANDO..." : "REGISTRARSE Y VINCULAR"}
                                        </button>
                                    </form>

                                    <button onClick={() => setStep(intent === "VENDER" ? 2 : 1)} className="w-full text-[10px] font-black uppercase text-gray-700 hover:text-white transition-colors">Atrás</button>
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
