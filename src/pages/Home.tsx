import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, CheckCircle2, Mail, Layers, DollarSign, TrendingUp, MessageCircle } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useDebounce } from "@/hooks/useDebounce";
import { discogsService, type DiscogsSearchResult } from "@/lib/discogs";
import { authenticateUser, signInWithGoogle } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import { generateWhatsAppLink } from "@/utils/whatsapp";

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
    const [submittedOrder, setSubmittedOrder] = useState<any>(null);

    // Sell-specific states
    const [price, setPrice] = useState("");
    const [currency, setCurrency] = useState<Currency>("ARS");
    const [marketPrice, setMarketPrice] = useState<number | null>(null);
    const [isLoadingMarket, setIsLoadingMarket] = useState(false);

    const [isSearchActive, setIsSearchActive] = useState(false);
    const [searchFilter, setSearchFilter] = useState<"todo" | "artistas" | "álbumes">("todo");
    const [searchResults, setSearchResults] = useState<DiscogsSearchResult[]>([]);
    const [isLoadingSearch, setIsLoadingSearch] = useState(false);
    const [selectedItem, setSelectedItem] = useState<DiscogsSearchResult | null>(null);
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
                    let typeParam = "release,master,artist";
                    if (searchFilter === "artistas") typeParam = "artist";
                    if (searchFilter === "álbumes") typeParam = "release,master";

                    const { results, pagination } = await discogsService.searchReleases(debouncedQuery, 1, undefined, typeParam);
                    setSearchResults(results);
                    setHasMore(pagination.pages > 1);
                    setCurrentPage(1);
                } catch (error) {
                    console.error("Search error:", error);
                } finally {
                    setIsLoadingSearch(false);
                }
            } else if (!selectedItem) {
                setSearchResults([]);
                setHasMore(false);
            }
        };
        performSearch();
    }, [debouncedQuery, selectedItem, searchFilter]);

    const handleLoadMore = async () => {
        if (isLoadingSearch || !hasMore) return;
        setIsLoadingSearch(true);
        try {
            const nextPage = currentPage + 1;
            let typeParam = "release,master,artist";
            if (searchFilter === "artistas") typeParam = "artist";
            if (searchFilter === "álbumes") typeParam = "release,master";

            const { results, pagination } = await discogsService.searchReleases(debouncedQuery, nextPage, undefined, typeParam);
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
        setIsSearchActive(false);
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
        setHasMore(false);
        setStep(1);
        setIsSearchActive(false);
    };

    const generateOrderNumber = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return `#ORD-${result}`;
    };

    const buildOrderPayload = (uid: string, intentOverride?: Intent) => {
        const resolvedIntent = intentOverride || intent;
        if (!selectedItem || !format || !condition || !resolvedIntent) return null;

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
                intent: resolvedIntent,
                artist: selectedItem.title.split(' - ')[0],
                album: selectedItem.title.split(' - ')[1] || selectedItem.title,
                cover_image: selectedItem.cover_image || selectedItem.thumb || '',
            },
            timestamp: serverTimestamp(),
            status: 'pending'
        };

        // Add pricing info for VENDER orders
        if (resolvedIntent === "VENDER" && price) {
            payload.details.price = parseFloat(price);
            payload.details.currency = currency;
        }

        // Attach market reference for margin analysis
        payload.market_reference = marketPrice;

        return payload;
    };

    const performSubmission = async (uid: string, intentOverride?: Intent) => {
        const payload = buildOrderPayload(uid, intentOverride);
        if (!payload) return;
        await addDoc(collection(db, "orders"), payload);
        setSubmittedOrder(payload);
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
                await performSubmission(user.uid, selectedIntent);
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
                    <h2 className="text-4xl md:text-6xl font-display font-black text-white uppercase tracking-tighter">Pedido Registrado</h2>
                    <p className="text-gray-500 text-lg md:text-xl max-w-md mx-auto font-medium">
                        Tu intención ha sido registrada. Contacta a <span className="text-primary">Oldie but Goldie</span> para procesar tu pedido.
                    </p>
                </div>
                <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto">
                    {submittedOrder && (
                        <button
                            onClick={() => window.open(generateWhatsAppLink(submittedOrder), "_blank")}
                            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-green-500/20"
                        >
                            <MessageCircle className="h-5 w-5" />
                            Contactar por WhatsApp
                        </button>
                    )}
                    <button
                        onClick={() => {
                            setIsSuccess(false);
                            setSubmittedOrder(null);
                            handleResetSelection();
                        }}
                        className="w-full bg-white/5 border border-white/10 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-white/10 transition-all"
                    >
                        Nueva Búsqueda
                    </button>
                </div>
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
                        <AnimatePresence mode="wait">
                            {!isSearchActive ? (
                                <motion.header
                                    key="header-default"
                                    initial={{ opacity: 0, y: -20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20, height: 0 }}
                                    className="space-y-4 overflow-hidden"
                                >
                                    <div className="flex items-center justify-center gap-3 mb-2">
                                        <div className="h-2 w-2 bg-primary animate-pulse rounded-full" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/60">Sistema de Intención v4.5</span>
                                    </div>
                                    <h1 className="text-4xl md:text-7xl font-display font-black text-white uppercase tracking-tightest leading-[0.85]">
                                        Protocolo <br />
                                        <span className="text-primary text-5xl md:text-8xl">Buscador</span>
                                    </h1>
                                </motion.header>
                            ) : (
                                <motion.header
                                    key="header-active"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-center md:text-left mb-8 md:mb-12"
                                >
                                    <h1 className="text-5xl md:text-7xl font-display font-black text-white italic uppercase tracking-tighter">
                                        RESULTADOS
                                    </h1>
                                </motion.header>
                            )}
                        </AnimatePresence>

                        <motion.div layout className="relative group w-full mb-8">
                            <Search className="absolute left-6 md:left-8 top-1/2 -translate-y-1/2 h-5 md:h-6 w-5 md:w-6 text-gray-500 group-focus-within:text-primary transition-colors" />
                            <input
                                id="searchQuery"
                                name="searchQuery"
                                type="text"
                                onFocus={() => setIsSearchActive(true)}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Artista, Álbum o Referencia..."
                                className="w-full bg-white/5 border-2 border-white/5 hover:border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] py-8 md:py-10 pl-16 md:pl-20 pr-16 md:pr-20 text-xl md:text-2xl font-bold text-white placeholder:text-gray-700/50 focus:outline-none focus:border-primary/50 transition-all focus:bg-black/40 shadow-2xl"
                            />
                            <AnimatePresence>
                                {query && (
                                    <motion.button
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        onClick={() => {
                                            setQuery("");
                                            setIsSearchActive(false);
                                            setSearchResults([]);
                                            setHasMore(false);
                                        }}
                                        className="absolute right-6 md:right-8 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full"
                                    >
                                        <X className="h-5 md:h-6 w-5 md:w-6" />
                                    </motion.button>
                                )}
                            </AnimatePresence>
                        </motion.div>

                        <AnimatePresence>
                            {isSearchActive && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, height: 0 }}
                                    animate={{ opacity: 1, y: 0, height: "auto" }}
                                    exit={{ opacity: 0, y: -10, height: 0 }}
                                    className="flex items-center justify-center md:justify-start gap-3 overflow-x-auto pb-6 hide-scrollbar"
                                >
                                    {["todo", "artistas", "álbumes"].map((f) => (
                                        <button
                                            key={f}
                                            onClick={() => setSearchFilter(f as any)}
                                            className={`px-8 py-3 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border-2 ${searchFilter === f
                                                ? "bg-primary border-primary text-black shadow-[0_0_20px_rgba(204,255,0,0.3)]"
                                                : "bg-transparent border-white/20 text-white hover:border-white/40 hover:bg-white/5"
                                                }`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <AnimatePresence>
                            {isSearchActive && searchResults.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="space-y-4 text-left mt-4"
                                >
                                    {searchResults.map((result, i) => (
                                        <motion.button
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            key={`${result.id}-${result.type}`}
                                            type="button"
                                            onClick={() => handleSelectResult(result)}
                                            className="w-full relative overflow-hidden bg-white/[0.03] border-2 border-white/10 rounded-2xl md:rounded-[2rem] hover:border-primary/40 transition-all group active:scale-[0.98]"
                                        >
                                            <div className="absolute left-0 top-0 bottom-0 w-2 bg-transparent group-hover:bg-primary transition-colors" />
                                            <div className="p-4 md:p-6 flex items-center gap-4 md:gap-6 ml-1">
                                                <div className="w-16 md:w-20 h-16 md:h-20 rounded-xl md:rounded-2xl overflow-hidden bg-black flex-shrink-0 border border-white/10 shadow-lg">
                                                    <img src={result.thumb || result.cover_image} alt="" className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500" />
                                                </div>
                                                <div className="flex-1 min-w-0 flex flex-col items-start gap-1 text-left">
                                                    <h4 className="text-xl md:text-2xl font-bold font-display italic text-white truncate w-full group-hover:text-primary transition-colors">
                                                        {result.title.split(' - ')[1] || result.title}
                                                    </h4>
                                                    <span className="text-xs md:text-sm font-black text-gray-400 uppercase tracking-widest leading-none truncate w-full">
                                                        {result.title.split(' - ')[0]}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 font-mono mt-2 tracking-widest uppercase">
                                                        {result.year || "N/A"} • {result.type}
                                                    </span>
                                                </div>
                                                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-primary/10 group-hover:border-primary/30 transition-all">
                                                    <ChevronRight className="h-5 w-5 text-gray-500 group-hover:text-primary transition-colors" />
                                                </div>
                                            </div>
                                        </motion.button>
                                    ))}

                                    {hasMore && (
                                        <div className="pt-8 text-center pb-20">
                                            <button
                                                onClick={handleLoadMore}
                                                disabled={isLoadingSearch}
                                                className="bg-black hover:bg-white/5 border border-white/20 text-white px-8 py-4 rounded-full font-black uppercase text-xs tracking-widest transition-all hover:border-white/40 flex items-center justify-center gap-3 mx-auto min-w-[200px]"
                                            >
                                                {isLoadingSearch ? (
                                                    <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                                ) : "Cargar Más"}
                                            </button>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {isSearchActive && isLoadingSearch && searchResults.length === 0 && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 flex flex-col items-center justify-center gap-4 text-center">
                                    <div className="h-8 w-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                                    <span className="text-xs font-black uppercase tracking-widest text-gray-500">Analizando base de datos...</span>
                                </motion.div>
                            )}

                            {isSearchActive && !isLoadingSearch && debouncedQuery.length >= 3 && searchResults.length === 0 && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 text-center space-y-4">
                                    <p className="text-gray-500 font-medium text-lg">No se encontraron resultados para "{query}"</p>
                                    <button onClick={() => setQuery("")} className="text-primary text-xs font-black uppercase tracking-widest hover:underline hover:text-white transition-colors">Limpiar búsqueda</button>
                                </motion.div>
                            )}
                        </AnimatePresence>
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
