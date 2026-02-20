import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, CheckCircle2, Mail, Layers, DollarSign, TrendingUp, MessageCircle, X, Share } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query as firestoreQuery, where, getDocs, limit } from "firebase/firestore";
import { useDebounce } from "@/hooks/useDebounce";
import { discogsService, type DiscogsSearchResult } from "@/lib/discogs";
import { authenticateUser, signInWithGoogle } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import { generateWhatsAppLink } from "@/utils/whatsapp";
import { SEO } from "@/components/SEO";

type Intent = "COMPRAR" | "VENDER";
type Format = "CD" | "VINILO" | "CASSETTE" | "OTROS";
type Condition = "NUEVO" | "USADO";
type Currency = "ARS" | "USD";

export default function Home() {
    const { user } = useAuth();
    const { type: routeType, id: routeId } = useParams<{ type: string, id: string }>();
    const navigate = useNavigate();

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
    const [recommendations, setRecommendations] = useState<DiscogsSearchResult[]>([]);
    const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
    const [publicOrder, setPublicOrder] = useState<any>(null); // For rendering the Collector Receipt
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    // Local Auth UI states (only for the manual form)
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const debouncedQuery = useDebounce(query, 500);
    const resultsContainerRef = useRef<HTMLDivElement>(null);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Auto-scroll on step change
    useEffect(() => {
        scrollToTop();
    }, [step, selectedItem]);

    // Handle initial route loading if hitting /item/:type/:id directly
    useEffect(() => {
        const loadItemFromRoute = async () => {
            if (routeId && routeType && !selectedItem) {
                setIsLoadingSearch(true);
                try {
                    let data;
                    if (routeType === 'release') {
                        data = await discogsService.getReleaseDetails(routeId);
                    } else if (routeType === 'master') {
                        data = await discogsService.getMasterDetails(routeId);
                    }

                    if (data) {
                        setSelectedItem({
                            id: data.id,
                            title: data.title || (data.artists ? `${data.artists[0]?.name} - ${data.title}` : 'Desconocido'),
                            cover_image: data.images?.[0]?.uri || data.thumb || '',
                            thumb: data.thumb || '',
                            type: routeType,
                            uri: data.uri || '',
                            resource_url: data.resource_url || '',
                            genre: data.genres || [],
                            year: data.year?.toString() || ''
                        });
                        setIsSearchActive(false);

                        // If user accessed a direct item, it might be an order link from /actividad
                        // We check Firebase to see if there's a recent order for this item
                        try {
                            const numericalRouteId = Number(routeId || 0);

                            const q = firestoreQuery(
                                collection(db, "orders"),
                                where("item_id", "==", numericalRouteId),
                                limit(1)
                            );
                            const orderSnap = await getDocs(q);
                            if (!orderSnap.empty) {
                                // Extract and scrub sensitive user info before dropping into state
                                const orderData = orderSnap.docs[0].data() as any;
                                setPublicOrder({
                                    id: orderSnap.docs[0].id,
                                    order_number: orderData.order_number,
                                    status: orderData.status || 'pending',
                                    format: orderData.details?.format,
                                    condition: orderData.details?.condition,
                                    intent: orderData.details?.intent,
                                    price: orderData.details?.price || null,
                                    timestamp: orderData.timestamp?.toDate() || new Date(),
                                    isOwner: auth.currentUser?.uid === orderData.user_id
                                });
                            }
                        } catch (err) {
                            console.error("Failed to cross-reference order record:", err);
                        }
                    }
                } catch (error) {
                    console.error("Failed to load item from route:", error);
                    navigate('/');
                } finally {
                    setIsLoadingSearch(false);
                }
            }
        };

        loadItemFromRoute();
    }, [routeId, routeType]);

    // Auto-scroll logic for results container (Mobile Keyboard Fix)
    useEffect(() => {
        if (isSearchActive && searchResults.length > 0 && resultsContainerRef.current) {
            // Slight delay to ensure DOM is ready and keyboard has settled on iOS
            setTimeout(() => {
                resultsContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 100);
        }
    }, [searchResults, isSearchActive]);

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

    const handleEntityDrillDown = async (result: DiscogsSearchResult) => {
        if (result.type === "release" || result.type === "master") {
            // Use Client-Side Routing to preserve UX, which also updates the URL for sharing/SEO
            navigate(`/item/${result.type}/${result.id}`);
            return;
        }

        setIsLoadingSearch(true);
        // Force the filter visual state to 'álbumes' as we dive into entities' discographies
        setSearchFilter("álbumes");
        // Re-brand the input query text to denote the user is now browsing this entity
        setQuery(result.title);

        try {
            let drillDownData;
            if (result.type === "artist") {
                drillDownData = await discogsService.getArtistReleases(result.id.toString(), 1);
            } else if (result.type === "label") {
                drillDownData = await discogsService.getLabelReleases(result.id.toString(), 1);
            } else if (result.type === "master") {
                drillDownData = await discogsService.getMasterVersions(result.id.toString(), 1);
            }

            if (drillDownData) {
                setSearchResults(drillDownData.results);
                setHasMore(drillDownData.pagination?.pages > 1);
                setCurrentPage(1);
            }
        } catch (error) {
            console.error("Entity drill-down error:", error);
        } finally {
            setIsLoadingSearch(false);
        }
    };

    // Recommendation Engine Effect
    useEffect(() => {
        const fetchRecommendations = async () => {
            if (!selectedItem) {
                setRecommendations([]);
                return;
            }

            // Don't fetch if it's an artist (we don't show recommendations on artist level in Home, though we shouldn't get here unless it's a direct route load or order view)
            if (selectedItem.type === 'artist') return;

            setIsLoadingRecommendations(true);
            try {
                let genreToSearch = "Electronic"; // Default fallback
                if (selectedItem.genre && selectedItem.genre.length > 0) {
                    genreToSearch = selectedItem.genre[0];
                }
                const results = await discogsService.getCuratedRecommendations(genreToSearch);

                // Strictly filter out the currently selected item, and remove items with no cover_image or no "Artist - Album" format
                const cleanResults = results.filter(r =>
                    r.id !== selectedItem.id &&
                    r.cover_image &&
                    !r.cover_image.includes('spacer') &&
                    r.title &&
                    r.title.includes(' - ')
                ).slice(0, 4);

                setRecommendations(cleanResults);
            } catch (error) {
                console.error("Recommendations error:", error);
            } finally {
                setIsLoadingRecommendations(false);
            }
        };

        fetchRecommendations();
    }, [selectedItem]);

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

        // Clean URL if we are coming from a dynamic route
        if (routeId) {
            navigate('/', { replace: true });
        }
    };

    const handleShare = async () => {
        if (!selectedItem) return;

        const artist = selectedItem.title.split(' - ')[0];
        const album = selectedItem.title.split(' - ')[1] || selectedItem.title;
        const text = `Mira este hallazgo en Oldie but Goldie: ${album} de ${artist}. ¿Qué te parece?`;

        // Use the absolute URL of the item
        const url = `${window.location.origin}/item/${selectedItem.type}/${selectedItem.id}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Oldie but Goldie',
                    text: text,
                    url: url,
                });
            } catch (error) {
                console.error('Error sharing:', error);
            }
        } else {
            navigator.clipboard.writeText(`${text} ${url}`);
            alert('Enlace copiado al portapapeles');
        }
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
        <div className={`mx-auto font-sans w-full transition-all duration-300 ${isSearchActive && !selectedItem ? 'h-[100dvh] flex flex-col overflow-hidden bg-neutral-950' : 'max-w-4xl py-8 md:py-20 flex flex-col items-center justify-center min-h-[80vh] px-4'}`}>
            {/* Dynamic SEO Injection for Individual Items */}
            {selectedItem && (
                <SEO
                    title={`${selectedItem.title} - Oldie but Goldie`}
                    description={publicOrder
                        ? `Orden de ${selectedItem.title} generada en Oldie but Goldie. Estado: ${publicOrder.status.toUpperCase()}. Especialistas en formato físico.`
                        : `Compra, vende o cotiza ${selectedItem.title} de forma instantánea.`}
                    image={selectedItem.cover_image || selectedItem.thumb}
                    url={`https://oldie-but-goldie.vercel.app/item/${selectedItem.type}/${selectedItem.id}`}
                    type="product"
                    schema={{
                        "@context": "https://schema.org",
                        "@type": "Product",
                        "name": selectedItem.title,
                        "image": [selectedItem.cover_image || selectedItem.thumb],
                        "description": `Formato físico de ${selectedItem.title}.`,
                        ...(marketPrice ? {
                            "offers": {
                                "@type": "Offer",
                                "priceCurrency": "USD",
                                "price": marketPrice.toString(),
                                "availability": "https://schema.org/InStock"
                            }
                        } : {})
                    }}
                />
            )}

            <AnimatePresence mode="wait">
                {!selectedItem ? (
                    <motion.div
                        key="step1-search-container"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        // Fixed vertical alignment: justify-start ensures top alignment when active, removing the dead space above the header
                        className={`w-full flex flex-col items-center ${isSearchActive ? 'h-full flex-1 justify-start' : 'justify-center gap-12 md:gap-16 text-center'}`}
                    >
                        {/* BLOQUE SUPERIOR (Header Fijo) */}
                        <div className={`w-full transition-all flex flex-col items-center ${isSearchActive ? 'flex-none shrink-0 z-10 bg-neutral-950 pt-[env(safe-area-inset-top,1rem)] md:pt-8 pb-4 px-4 border-b border-white/5 shadow-2xl' : ''}`}>
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
                                        className="w-full text-center md:text-left mb-2 md:mb-4 max-w-4xl mx-auto"
                                    >
                                        <h1 className="text-5xl md:text-7xl font-display font-black text-white italic uppercase tracking-tighter pt-2 md:pt-0">
                                            RESULTADOS
                                        </h1>
                                    </motion.header>
                                )}
                            </AnimatePresence>

                            <motion.div layout className={`relative group w-full flex items-center justify-center ${isSearchActive ? 'max-w-4xl mx-auto' : ''}`}>
                                <Search className="absolute left-6 md:left-8 top-1/2 -translate-y-1/2 h-5 md:h-6 w-5 md:w-6 text-gray-500 group-focus-within:text-primary transition-colors" />
                                <input
                                    id="searchQuery"
                                    name="searchQuery"
                                    type="text"
                                    onFocus={() => setIsSearchActive(true)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            e.currentTarget.blur();
                                        }
                                    }}
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Artista, Álbum o Referencia..."
                                    className="w-full bg-white/5 border-2 border-white/5 hover:border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] py-6 md:py-8 pl-14 md:pl-20 pr-16 md:pr-20 text-xl md:text-2xl font-bold text-white placeholder:text-gray-700/50 focus:outline-none focus:ring-0 focus:border-primary/50 transition-all focus:bg-neutral-900 shadow-2xl"
                                />
                                <AnimatePresence>
                                    {query && (
                                        <div className="absolute right-4 md:right-6 top-0 bottom-0 flex items-center justify-center z-10">
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
                                                className="w-8 h-8 md:w-10 md:h-10 text-gray-400 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center"
                                            >
                                                <X className="h-4 md:h-5 w-4 md:w-5" />
                                            </motion.button>
                                        </div>
                                    )}
                                </AnimatePresence>
                            </motion.div>

                            <AnimatePresence>
                                {isSearchActive && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, height: 0 }}
                                        animate={{ opacity: 1, y: 0, height: "auto" }}
                                        exit={{ opacity: 0, y: -10, height: 0 }}
                                        className="flex items-center justify-start md:justify-center gap-2 md:gap-3 overflow-x-auto pb-4 pt-5 px-4 -mx-4 md:px-0 md:mx-0 w-[calc(100%+2rem)] md:w-full hide-scrollbar snap-x max-w-4xl mx-auto"
                                    >
                                        {["todo", "artistas", "álbumes"].map((f) => (
                                            <button
                                                key={f}
                                                onClick={() => setSearchFilter(f as any)}
                                                className={`px-8 py-3 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border-2 snap-center shrink-0 ${searchFilter === f
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
                        </div>

                        {/* BLOQUE INFERIOR (Resultados Scrollables Independentemente) */}
                        <div className={`w-full ${isSearchActive ? 'flex-1 overflow-y-auto overscroll-contain p-4 pb-[env(safe-area-inset-bottom,2rem)] block bg-[#050505]' : 'hidden'}`}>
                            <div className="max-w-4xl mx-auto w-full pb-[10vh]">
                                <AnimatePresence>
                                    {isSearchActive && searchResults.length > 0 && (
                                        <motion.div
                                            ref={resultsContainerRef}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            // Removed massive margins/padding as flex-1 container handles scrolling now
                                            className="space-y-3 md:space-y-4 text-left"
                                        >
                                            {searchResults.map((result, i) => (
                                                <motion.button
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: i * 0.05 }}
                                                    key={`${result.id}-${result.type}`}
                                                    type="button"
                                                    onClick={() => handleEntityDrillDown(result)}
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
                                                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                                {result.type === 'artist' ? (
                                                                    <span className="text-[10px] text-primary/80 font-mono tracking-widest uppercase border border-primary/20 bg-primary/5 px-2 py-0.5 rounded">
                                                                        Ver Discografía
                                                                    </span>
                                                                ) : (
                                                                    <>
                                                                        {result.year && result.year !== "0" && result.year.toUpperCase() !== "N/A" && (
                                                                            <span className="text-[10px] text-gray-400 font-mono tracking-widest uppercase">
                                                                                {result.year}
                                                                            </span>
                                                                        )}
                                                                        {(result.format && result.format.length > 0) ? (
                                                                            <>
                                                                                {result.year && result.year !== "0" && result.year.toUpperCase() !== "N/A" && (
                                                                                    <span className="text-[10px] text-gray-600 font-mono">•</span>
                                                                                )}
                                                                                <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">
                                                                                    {result.format[0]}
                                                                                </span>
                                                                            </>
                                                                        ) : (
                                                                            <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase ml-1">
                                                                                {result.type}
                                                                            </span>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-primary/10 group-hover:border-primary/30 transition-all">
                                                            <ChevronRight className="h-5 w-5 text-gray-500 group-hover:text-primary transition-colors" />
                                                        </div>
                                                    </div>
                                                </motion.button>
                                            ))}

                                            {hasMore && (
                                                <div className="pt-8 text-center pb-8">
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
                            </div>
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

                        {/* Collector Receipt View Extracted Logic */}
                        {publicOrder ? (
                            <div className="bg-[#050505] border-2 border-white/5 rounded-[1.5rem] md:rounded-[3rem] overflow-hidden group relative w-full shadow-2xl">
                                <div className="absolute top-0 right-0 p-8 z-30 flex items-center gap-3">
                                    <button
                                        onClick={handleShare}
                                        className="h-10 px-4 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 backdrop-blur-md flex items-center justify-center gap-2 transition-all group"
                                        title="Compartir"
                                    >
                                        <Share className="h-4 w-4 text-gray-300 group-hover:text-white transition-colors" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-300 group-hover:text-white transition-colors hidden sm:block">Compartir</span>
                                    </button>
                                    <div className={`px-4 py-2 rounded-full border backdrop-blur-md flex items-center gap-2 ${publicOrder.status === 'sold' ? 'bg-primary/10 border-primary/20 text-primary' :
                                        publicOrder.status === 'quoted' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                            'bg-white/5 border-white/10 text-gray-300'
                                        }`}>
                                        <div className={`w-2 h-2 rounded-full ${publicOrder.status === 'sold' ? 'bg-primary' :
                                            publicOrder.status === 'quoted' ? 'bg-blue-400' :
                                                'bg-gray-400'
                                            } animate-pulse`} />
                                        <span className="text-xs font-black uppercase tracking-widest">
                                            {publicOrder.status === 'sold' ? 'Vendido' :
                                                publicOrder.status === 'quoted' ? 'Cotizado' :
                                                    'En Análisis'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-col md:flex-row relative">
                                    <div className="w-full md:w-1/2 aspect-square relative overflow-hidden bg-black/50 p-8 md:p-12 flex items-center justify-center">
                                        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />
                                        <img
                                            src={selectedItem.cover_image || selectedItem.thumb}
                                            alt={selectedItem.title}
                                            className="w-full h-full max-w-[400px] max-h-[400px] object-cover shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-10 transition-transform duration-700 hover:scale-[1.02]"
                                        />
                                        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[#050505] via-transparent to-transparent z-10" />
                                    </div>

                                    <div className="flex-1 p-8 md:p-12 space-y-10 flex flex-col justify-center border-l border-white/5 z-20 bg-[#0A0A0A]">
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Recibo de Actividad</h4>
                                            <h3 className="text-3xl lg:text-5xl font-display font-black text-white uppercase tracking-tighter leading-none">{selectedItem.title}</h3>
                                            <p className="text-primary font-mono tracking-widest text-sm">{publicOrder.order_number}</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-8 py-8 border-y border-white/5">
                                            <div className="space-y-2">
                                                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Fecha Registro</p>
                                                <p className="text-white font-mono">{publicOrder.timestamp.toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                            </div>
                                            {publicOrder.isOwner && (
                                                <div className="space-y-2">
                                                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Precio Usuario</p>
                                                    <p className="text-primary font-bold font-mono text-lg">{publicOrder.price ? `$${publicOrder.price.toLocaleString('es-AR')}` : "A Confirmar"}</p>
                                                </div>
                                            )}
                                            <div className="space-y-2">
                                                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Formato</p>
                                                <p className="text-white font-bold">{publicOrder.format || "N/A"}</p>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Condición Reportada</p>
                                                <p className="text-white font-bold">{publicOrder.condition || "N/A"}</p>
                                            </div>
                                            <div className="space-y-2 flex flex-col items-start">
                                                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Operación</p>
                                                <div className={`px-2 py-0.5 rounded-[4px] border backdrop-blur-md ${publicOrder.intent === 'VENDER' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
                                                    <span className="text-[10px] uppercase tracking-widest font-black">
                                                        {publicOrder.intent === 'VENDER' ? 'EN VENTA' : 'EN COMPRA'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-4 space-y-4">
                                            {publicOrder.isOwner && publicOrder.status === 'quoted' ? (
                                                <button
                                                    onClick={() => window.open(generateWhatsAppLink(publicOrder), "_blank")}
                                                    className="w-full bg-primary text-black py-6 rounded-xl font-black uppercase text-xs tracking-widest shadow-[0_0_30px_rgba(204,255,0,0.15)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <MessageCircle className="w-4 h-4" />
                                                    Contactar por esta orden
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setPublicOrder(null)} // Returns to standard step 1 logic
                                                    className="w-full bg-white/10 hover:bg-white/20 text-white py-6 rounded-xl font-black uppercase text-xs tracking-widest transition-all"
                                                >
                                                    Consultar similar
                                                </button>
                                            )}

                                            <div className="text-center pt-2">
                                                <button onClick={handleResetSelection} className="text-[10px] font-black uppercase tracking-widest text-gray-700 hover:text-white transition-colors underline decoration-white/20">Cambiar de Título</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
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
                                    <div className="flex-1 p-8 md:p-12 space-y-8 flex flex-col justify-center relative">
                                        <div className="absolute top-6 md:top-8 right-6 md:right-8 z-10">
                                            <button
                                                onClick={handleShare}
                                                className="h-10 px-4 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 backdrop-blur-md flex items-center justify-center gap-2 transition-all group"
                                                title="Compartir"
                                            >
                                                <Share className="h-4 w-4 text-gray-300 group-hover:text-white transition-colors" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-300 group-hover:text-white transition-colors hidden sm:block">Compartir</span>
                                            </button>
                                        </div>
                                        <h3 className="text-3xl lg:text-4xl font-display font-black text-white uppercase tracking-tighter leading-none mt-4 md:mt-0">{selectedItem.title}</h3>
                                        <div className="grid grid-cols-2 gap-6">
                                            {selectedItem.year && selectedItem.year !== "0" && selectedItem.year.toUpperCase() !== "N/A" && (
                                                <div>
                                                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Año</p>
                                                    <p className="text-white font-bold">{selectedItem.year}</p>
                                                </div>
                                            )}
                                            {selectedItem.genre && selectedItem.genre.length > 0 && selectedItem.genre[0].toUpperCase() !== "N/A" && (
                                                <div>
                                                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Género</p>
                                                    <p className="text-primary font-bold">{selectedItem.genre[0]}</p>
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={handleResetSelection} className="text-[10px] font-black uppercase tracking-widest text-gray-700 hover:text-primary transition-colors underline decoration-primary/20">Cambiar Selección</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 1: Format, Condition, Intent */}
                        {step === 1 && !publicOrder && (
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

                        {/* Recommendations Section - Repositioned at the bottom */}
                        {selectedItem && recommendations.length > 0 && (
                            <div className="pt-16 pb-8 md:pt-24 md:pb-12 fade-in w-full border-t border-white/5 mt-16">
                                <h4 className="text-xl md:text-2xl font-display font-black text-white italic uppercase tracking-tighter mb-4 md:mb-6 pl-2 border-l-4 border-primary">
                                    Otros tesoros que podrían interesarte
                                </h4>
                                <div className="flex overflow-x-auto gap-4 md:gap-6 pb-6 hide-scrollbar snap-x snap-mandatory">
                                    {recommendations.map((rec) => (
                                        <button
                                            key={`rec-${rec.id}`}
                                            onClick={() => navigate(`/item/${rec.type}/${rec.id}`)}
                                            className="w-[280px] md:w-[320px] flex-shrink-0 relative overflow-hidden bg-white/[0.03] border-2 border-white/5 hover:border-white/20 rounded-2xl md:rounded-[2rem] transition-all group snap-start text-left flex flex-col items-start p-4 hover:bg-white/[0.05]"
                                        >
                                            <div className="w-full aspect-square rounded-xl overflow-hidden bg-black mb-4 relative shadow-lg">
                                                <img src={rec.cover_image || rec.thumb} alt={rec.title} className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-transform duration-700 group-hover:scale-105" />
                                            </div>
                                            <h5 className="text-lg font-bold font-display italic text-white truncate w-full group-hover:text-primary transition-colors">
                                                {rec.title.split(' - ')[1] || rec.title}
                                            </h5>
                                            <span className="text-xs font-black text-gray-500 uppercase tracking-widest leading-none truncate w-full mt-1">
                                                {rec.title.split(' - ')[0]}
                                            </span>
                                        </button>
                                    ))}
                                    {isLoadingRecommendations && (
                                        <div className="w-[280px] md:w-[320px] flex-shrink-0 flex items-center justify-center snap-start">
                                            <div className="h-6 w-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
