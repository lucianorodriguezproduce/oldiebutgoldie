import { useState, useEffect, useRef } from "react";
import { TEXTS } from "@/constants/texts";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { LazyImage } from "@/components/ui/LazyImage";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, CheckCircle2, Mail, Layers, DollarSign, TrendingUp, MessageCircle, X, Share, ArrowLeft } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query as firestoreQuery, where, getDocs, limit } from "firebase/firestore";
import { useDebounce } from "@/hooks/useDebounce";
import { discogsService, type DiscogsSearchResult } from "@/lib/discogs";
import { authenticateUser, signInWithGoogle } from "@/lib/auth";
import { trackEvent } from "@/components/AnalyticsProvider";
import { useAuth } from "@/context/AuthContext";
import { useLoading } from "@/context/LoadingContext";
import { generateWhatsAppLink } from "@/utils/whatsapp";
import type { OrderData } from "@/utils/whatsapp";
import { pushViewItem, pushViewItemFromOrder, pushWhatsAppContactFromOrder } from "@/utils/analytics";
import { SEO } from "@/components/SEO";
import { useLote } from "@/context/LoteContext";
import { PremiumShowcase } from "@/components/PremiumShowcase";
import React, { memo } from "react";

// --- COMPACT SEARCH CARD (MOBILE OPTIMIZED) ---
const CompactSearchCard = memo(({ result, idx, onClick }: { result: DiscogsSearchResult, idx: number, onClick: () => void }) => {
    return (
        <motion.button
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.03, 0.3) }}
            onClick={onClick}
            className="group relative flex flex-col items-start bg-white/[0.03] border border-white/5 hover:border-primary/40 rounded-xl overflow-hidden transition-all text-left aspect-square md:aspect-[3/4]"
        >
            <div className="w-full h-full relative">
                <LazyImage
                    src={result.cover_image || result.thumb}
                    alt={result.title}
                    className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-80 group-hover:opacity-40 transition-opacity" />

                <div className="absolute inset-x-0 bottom-0 p-2 md:p-6 space-y-0.5">
                    <h5 className="text-[9px] md:text-lg font-bold font-display italic text-white leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                        {(result as any).normalizedAlbum || (result.title.includes(' - ') ? result.title.split(' - ')[1] : result.title)}
                    </h5>
                    <span className="text-[7px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none truncate block">
                        {(result as any).normalizedArtist || (result.title.includes(' - ') ? result.title.split(' - ')[0] : result.title)}
                    </span>
                </div>

                {/* Mobile Type Indicator - More discreet */}
                {result.type && (
                    <div className="absolute top-1.5 left-1.5 px-1 py-0.5 rounded-sm bg-black/60 backdrop-blur-md border border-white/5 md:top-4 md:left-4 md:px-2 md:py-1">
                        <span className="text-[5px] md:text-[8px] font-black uppercase tracking-tighter text-white/60">{result.type}</span>
                    </div>
                )}
            </div>
        </motion.button>
    );
});

const SearchChip = ({ name, onRemove }: { name: string, onRemove: () => void }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.9, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -10 }}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/10 rounded-full backdrop-blur-md transition-all group hover:bg-white/15"
    >
        <span className="text-[10px] font-black uppercase tracking-widest text-primary/80 group-hover:text-primary transition-colors">{name}</span>
        <button
            onClick={(e) => {
                e.stopPropagation();
                onRemove();
            }}
            className="p-1 hover:bg-white/10 rounded-full transition-colors"
        >
            <X className="h-3 w-3 text-white/40 hover:text-white" />
        </button>
    </motion.div>
);

CompactSearchCard.displayName = "CompactSearchCard";

type Intent = "COMPRAR" | "VENDER";
type Format = "CD" | "VINILO" | "CASSETTE" | "OTROS";
type Condition = "NUEVO" | "USADO";
type Currency = "ARS" | "USD";

export default function Home() {
    const { user } = useAuth();
    const { type: routeType, id: routeId } = useParams<{ type: string, id: string }>();
    const navigate = useNavigate();
    const { addItemToBatch, isInLote, totalCount, loteItems } = useLote();

    const [intent, setIntent] = useState<Intent | null>(null);
    const [query, setQuery] = useState("");
    const [format, setFormat] = useState<Format | null>(null);
    const [condition, setCondition] = useState<Condition | null>(null);
    const { showLoading, hideLoading, isLoading: isSubmitting } = useLoading();
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
    const observerTarget = useRef<HTMLDivElement>(null);
    const [searchHistory, setSearchHistory] = useState<any[]>([]); // To allow "Go Back" in drill-downs
    const [selectedArtist, setSelectedArtist] = useState<{ id: number, name: string } | null>(null);

    // Start of the block to be replaced/modified
    // Local Auth UI states (only for the manual form)
    const debouncedQuery = useDebounce(query, 300);
    const resultsContainerRef = useRef<HTMLDivElement>(null);
    const conditionRef = useRef<HTMLDivElement>(null);
    const actionsRef = useRef<HTMLDivElement>(null);
    const priceInputRef = useRef<HTMLInputElement>(null);

    const scrollToElement = (ref: React.RefObject<HTMLElement | null>, offset = 100) => {
        if (ref.current && window.innerWidth < 1024) {
            const top = ref.current.getBoundingClientRect().top + window.pageYOffset - offset;
            window.scrollTo({ top, behavior: "smooth" });
        }
    };
    // End of the instruction's provided code block

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Analytics tracking for Item Views
    useEffect(() => {
        if (publicOrder) {
            pushViewItemFromOrder(publicOrder);
        } else if (selectedItem) {
            pushViewItem(selectedItem, intent || "OBSERVANDO");
        }
    }, [selectedItem?.id, publicOrder?.order_number, intent]);

    // Automatic Addition Effect - Zero Confirmation Flow
    useEffect(() => {
        if (selectedItem && format && condition) {
            const existing = loteItems.find(i => i.id === selectedItem.id);

            if (!existing ||
                existing.format !== format ||
                existing.condition !== condition ||
                (price && existing.price !== parseFloat(price))) {

                addItemToBatch({
                    id: selectedItem.id,
                    title: selectedItem.title,
                    artist: (selectedItem as any).normalizedArtist,
                    album: (selectedItem as any).normalizedAlbum,
                    cover_image: selectedItem.cover_image || selectedItem.thumb,
                    format,
                    condition,
                    price: price ? parseFloat(price) : undefined,
                    currency,
                    source: 'DISCOGS'
                });
            }
        }
    }, [format, condition, selectedItem, loteItems, addItemToBatch]);

    // normalizer for Discogs data to ensure high-fidelity artist/album separation
    const normalizeDiscogsData = (data: any) => {
        if (!data) return data;

        // Extract real artist name from the structured 'artists' array
        const realArtist = data.artists?.[0]?.name ||
            data.artist ||
            (data.title?.includes(' - ') ? data.title.split(' - ')[0].trim() : "Varios");

        // Use the 'title' field as the real album title
        const realAlbum = data.title?.includes(' - ') ? data.title.split(' - ')[1].trim() : data.title || "Detalle del Disco";

        return {
            ...data,
            normalizedArtist: realArtist,
            normalizedAlbum: realAlbum
        };
    };

    // Handle initial route loading if hitting /item/:type/:id directly
    useEffect(() => {
        const loadItemFromRoute = async () => {
            if (routeId && routeType && !selectedItem) {
                showLoading(TEXTS.home.loadingDiscogs);
                try {
                    let itemData;
                    if (routeType === 'release') {
                        itemData = await discogsService.getReleaseDetails(routeId);
                    } else if (routeType === 'master') {
                        itemData = await discogsService.getMasterDetails(routeId);
                    } else if (routeType === 'artist') {
                        itemData = await discogsService.getArtistReleases(routeId);
                    }

                    if (itemData) {
                        const normalized = normalizeDiscogsData(itemData);
                        setSelectedItem({
                            id: normalized.id,
                            title: normalized.title,
                            cover_image: normalized.images?.[0]?.uri || normalized.thumb || '',
                            thumb: normalized.thumb || '',
                            type: routeType,
                            uri: normalized.uri || '',
                            resource_url: normalized.resource_url || '',
                            genre: normalized.genres || [],
                            year: normalized.year?.toString() || '',
                            normalizedArtist: normalized.normalizedArtist,
                            normalizedAlbum: normalized.normalizedAlbum
                        } as any);
                        setIsSearchActive(false);

                        // Cross-reference with existing orders in Firebase
                        try {
                            const numericalRouteId = Number(routeId || 0);
                            const q = firestoreQuery(
                                collection(db, "orders"),
                                where("item_id", "==", numericalRouteId),
                                limit(1)
                            );
                            const orderSnap = await getDocs(q);
                            if (!orderSnap.empty) {
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
                    hideLoading();
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
            // SKIP if we just did a drill-down (query matches artist name and results are already set)
            if (selectedArtist && debouncedQuery === selectedArtist.name && searchResults.length > 0) return;

            if (debouncedQuery.trim().length >= 3 && !selectedItem) {
                // Use a local loading state for internal search to avoid the global heavy overlay
                // which might be causing the "stuck" feeling due to race conditions.
                setIsLoadingSearch(true);
                try {
                    let results, pagination;

                    if (selectedArtist) {
                        // CONTEXTUAL SEARCH: Filter within selected artist using search endpoint
                        const response = await discogsService.searchArtistReleases(selectedArtist.name, debouncedQuery, 1);
                        results = response.results;
                        pagination = response.pagination;
                    } else {
                        // GLOBAL SEARCH
                        let typeParam = "release,master,artist";
                        if (searchFilter === "artistas") typeParam = "artist";
                        if (searchFilter === "álbumes") typeParam = "release,master";

                        const response = await discogsService.searchReleases(debouncedQuery, 1, undefined, typeParam);
                        results = response.results;
                        pagination = response.pagination;
                    }

                    if (results) {
                        setSearchResults(results);
                        setHasMore(pagination.page < pagination.pages);
                        setCurrentPage(1);
                    }
                } catch (error) {
                    console.error("Search error:", error);
                } finally {
                    setIsLoadingSearch(false);
                }
            } else if (!selectedItem && !selectedArtist) {
                setSearchResults([]);
                setHasMore(false);
            }
        };
        performSearch();
    }, [debouncedQuery, selectedItem, searchFilter, selectedArtist]);

    const handleLoadMore = async () => {
        if (isLoadingSearch || !hasMore) return;
        setIsLoadingSearch(true);
        try {
            const nextPage = currentPage + 1;
            let results, pagination;

            if (selectedArtist) {
                const response = await discogsService.searchArtistReleases(selectedArtist.name, debouncedQuery, nextPage);
                results = response.results;
                pagination = response.pagination;
            } else {
                let typeParam = "release,master,artist";
                if (searchFilter === "artistas") typeParam = "artist";
                if (searchFilter === "álbumes") typeParam = "release,master";

                const response = await discogsService.searchReleases(debouncedQuery, nextPage, undefined, typeParam);
                results = response.results;
                pagination = response.pagination;
            }

            setSearchResults(prev => [...prev, ...results]);
            setCurrentPage(nextPage);
            setHasMore(pagination.page < pagination.pages);
        } catch (error) {
            console.error("Load more error:", error);
        } finally {
            setIsLoadingSearch(false);
        }
    };

    // Infinite Scroll Intersection Observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore && !isLoadingSearch) {
                    handleLoadMore();
                }
            },
            { threshold: 0.8 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [hasMore, isLoadingSearch, currentPage, debouncedQuery]);

    const handleEntityDrillDown = async (result: DiscogsSearchResult) => {
        // Essential: Keep search UI active during drill-downs
        setIsSearchActive(true);

        // SAVE CURRENT STATE TO HISTORY BEFORE DRILL-DOWN
        setSearchHistory(prev => [...prev, {
            results: searchResults,
            hasMore,
            currentPage,
            filter: searchFilter,
            querySnapshot: query,
            selectedArtistSnapshot: selectedArtist
        }]);

        if (result.type === "release" || result.type === "master") {
            // Use Client-Side Routing to preserve UX, which also updates the URL for sharing/SEO
            navigate(`/item/${result.type}/${result.id}`);
            return;
        }

        showLoading(TEXTS.common.loadingGeneric);
        // Force the filter visual state to 'álbumes' as we dive into entities' discographies
        setSearchFilter("álbumes");
        // Re-brand the input query text to denote the user is now browsing this entity
        setQuery(result.title);
        setIsLoadingSearch(true);

        // OPTIMISTIC UPDATE: Set selected artist early for immediate UI feedback (Chip appearance)
        if (result.type === "artist") {
            setSelectedArtist({ id: result.id, name: result.title });
        }

        try {
            let drillDownData;
            if (result.type === "artist") {
                // Initial catalog load (no query)
                drillDownData = await discogsService.getArtistReleases(result.id.toString(), 1);
            } else if (result.type === "label") {
                drillDownData = await discogsService.getLabelReleases(result.id.toString(), 1);
            } else if (result.type === "master") {
                drillDownData = await discogsService.getMasterVersions(result.id.toString(), 1);
            }

            if (drillDownData) {
                setSearchResults(drillDownData.results);
                setHasMore(drillDownData.pagination.page < drillDownData.pagination.pages);
                setCurrentPage(1);
                if (resultsContainerRef.current) resultsContainerRef.current.scrollTop = 0;
            }
        } catch (error) {
            console.error("Entity drill-down error:", error);
        } finally {
            hideLoading();
        }
    };

    const handleGoBack = () => {
        if (searchHistory.length === 0) return;
        const lastState = searchHistory[searchHistory.length - 1];
        setSearchResults(lastState.results);
        setHasMore(lastState.hasMore);
        setCurrentPage(lastState.currentPage);
        setSearchFilter(lastState.filter);
        setQuery(lastState.querySnapshot); // Restore the query as well
        setSelectedArtist(lastState.selectedArtistSnapshot); // Restore the artist filter
        setSearchHistory(prev => prev.slice(0, -1));
        if (resultsContainerRef.current) resultsContainerRef.current.scrollTop = 0;
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
                const cleanResults = (results || []).filter(r =>
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

        const artist = (selectedItem as any).normalizedArtist || "Varios";
        const album = (selectedItem as any).normalizedAlbum || selectedItem.title;
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
            alert(TEXTS.common.confirm || 'Enlace copiado al portapapeles');
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

        const artistData = (selectedItem as any).normalizedArtist || "Varios";
        const albumData = (selectedItem as any).normalizedAlbum || selectedItem.title;
        const discogsId = (selectedItem as any).id;

        const payload: any = {
            order_number: `ORD-${Date.now().toString().slice(-6)}`,
            user_id: user?.uid || "anonymous",
            user_email: user?.email || "anonymous@oldiebutgoldie.com.ar",
            status: "pending",
            item_id: discogsId,
            discogs_id: discogsId,
            artist: artistData,
            title: albumData,
            album: albumData,
            timestamp: serverTimestamp(),
            details: {
                format: format,
                condition: condition,
                intent: intent,
                price: price ? parseFloat(price) : null,
                currency: currency,
                discogs_id: discogsId,
                artist: artistData,
                album: albumData,
                market_price: marketPrice,
                market_currency: "USD"
            },
            items: [
                {
                    id: discogsId,
                    discogs_id: discogsId,
                    title: albumData,
                    artist: artistData,
                    album: albumData,
                    cover_image: selectedItem.cover_image || selectedItem.thumb
                }
            ]
        };

        // Add pricing info for VENDER orders
        if (resolvedIntent === "VENDER" && price) {
            payload.details.price = parseFloat(price);
            payload.details.currency = currency;
        }

        // Attach market reference for margin analysis
        if (marketPrice !== null && marketPrice !== undefined) {
            payload.market_reference = marketPrice;
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

        return cleanObject(payload);
    };

    const performSubmission = async (uid: string, intentOverride?: Intent) => {
        const payload = buildOrderPayload(uid, intentOverride);
        if (!payload) return;

        if (!payload.type) {
            alert("Error del Sistema: No se pudo determinar el tipo de transacción.");
            return;
        }

        try {
            // Save order to Firebase
            const docRef = await addDoc(collection(db, "orders"), payload);

            const completeOrder = { id: docRef.id, ...payload };
            setSubmittedOrder(completeOrder as OrderData);
        } catch (error) {
            console.error("Error creating order:", error);
            alert(TEXTS.profile.genericError || "Error al procesar el pedido.");
        }
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

    // Handle intent selection (Add to Lote)
    const handleIntentSelect = (selectedIntent: Intent) => {
        setIntent(selectedIntent);
        trackEvent('initiate_offer', {
            intent: selectedIntent,
            item_id: selectedItem?.id,
            item_title: selectedItem?.title
        });

        if (selectedIntent === "VENDER") {
            fetchMarketPrice();
            setStep(2); // price step
            setTimeout(() => {
                scrollToElement(actionsRef, 80);
                priceInputRef.current?.focus();
            }, 100);
            return;
        }

        // For COMPRAR: Direct single item checkout
        if (user) {
            performSubmission(user.uid, selectedIntent);
            setIsSuccess(true);
            scrollToTop();
        } else {
            setStep(3); // Auth step
        }
    };

    // Handle price confirmation for VENDER
    const handlePriceConfirm = () => {
        if (!price || parseFloat(price) <= 0) {
            alert(TEXTS.negotiation.priceLabel || "Ingresa un precio válido.");
            return;
        }

        if (user) {
            performSubmission(user.uid);
            setIsSuccess(true);
            scrollToTop();
        } else {
            setStep(3); // Auth step
        }
    };

    const handleGoogleSignIn = async () => {
        showLoading(TEXTS.auth.googleSignIn);
        try {
            const googleUser = await signInWithGoogle();
            if (googleUser) {
                await performSubmission(googleUser.uid);
                setIsSuccess(true);
                scrollToTop();
            }
        } catch (error) {
            console.error("Google Auth error:", error);
            alert(TEXTS.profile.genericError);
        } finally {
            hideLoading();
        }
    };

    const handleAuthAction = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!email || !password) return;

        showLoading(TEXTS.common.loadingGeneric);
        try {
            const loggedUser = await authenticateUser(email, password);
            if (loggedUser) {
                await performSubmission(loggedUser.uid);
                setIsSuccess(true);
                scrollToTop();
            }
        } catch (error) {
            console.error("Manual Auth error:", error);
            alert(TEXTS.profile.genericError);
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
                    <h2 className="text-4xl md:text-6xl font-display font-black text-white uppercase tracking-tighter">{TEXTS.success.orderRegistered}</h2>
                    <p className="text-gray-500 text-lg md:text-xl max-w-md mx-auto font-medium">
                        {TEXTS.success.successMessage}
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
                            {TEXTS.success.contactWhatsApp}
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
                        {TEXTS.success.newSearch}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-[#050505] font-sans selection:bg-primary/30 text-white overflow-x-hidden flex flex-col relative w-full transition-all ${isSearchActive ? 'h-[100dvh] overflow-hidden' : 'min-h-screen'}`}>
            {selectedItem ? (
                <SEO
                    title={`${selectedItem.title} - Oldie but Goldie`}
                    description={
                        publicOrder
                            ? `Orden de ${selectedItem.title} generada en Oldie but Goldie. Estado: ${publicOrder.status.toUpperCase()}. Especialistas en formato físico.`
                            : `Compra, vende o cotiza ${selectedItem.title} de forma instantánea.`
                    }
                    image={selectedItem.cover_image || selectedItem.thumb}
                    url={`https://oldiebutgoldie.com.ar/item/${selectedItem.type}/${selectedItem.id}`}
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
            ) : (
                <SEO
                    title={TEXTS.common.seo.home.title}
                    description={TEXTS.common.seo.home.desc}
                    image={TEXTS.common.seo.home.ogImage}
                    url="https://oldiebutgoldie.com.ar"
                    schema={{
                        "@context": "https://schema.org",
                        "@type": "WebSite",
                        "name": TEXTS.navigation.brand,
                        "description": TEXTS.common.seo.home.desc,
                        "keywords": TEXTS.common.seo.home.keys
                    }}
                />
            )}

            <AnimatePresence mode="wait">
                {!selectedItem ? (
                    <motion.div
                        key="step1-search-container"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`w-full flex flex-col items-center min-h-[100dvh] ${isSearchActive ? 'justify-start' : 'justify-center gap-12 md:gap-16 text-center'}`}
                    >
                        {/* BLOQUE SUPERIOR (Sticky Header) */}
                        <div className={`w-full transition-all flex flex-col items-center ${isSearchActive ? 'sticky top-0 z-50 bg-[#050505]/95 backdrop-blur-xl pt-[env(safe-area-inset-top,1rem)] md:pt-8 pb-4 px-4 border-b border-white/5 shadow-2xl' : ''}`}>
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
                                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/60">{TEXTS.home.systemVersion}</span>
                                        </div>
                                        <h1 className="text-4xl md:text-7xl font-display font-black text-white uppercase tracking-tightest leading-[0.85] px-4">
                                            {TEXTS.home.searchTitle.split(' ').slice(0, 2).join(' ')} <br />
                                            <span className="text-primary text-4xl md:text-6xl block mt-2">{TEXTS.home.searchTitle.split(' ').slice(2).join(' ')}</span>
                                        </h1>
                                    </motion.header>
                                ) : (
                                    <motion.header
                                        key="header-active"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="w-full text-center md:text-left mb-1 md:mb-4 max-w-4xl mx-auto"
                                    >
                                        <h1 className="text-3xl md:text-7xl font-display font-black text-white italic uppercase tracking-tighter pt-1 md:pt-0">
                                            {TEXTS.home.resultsTitle}
                                        </h1>
                                    </motion.header>
                                )}
                            </AnimatePresence>

                            <motion.div layout className={`relative group w-full flex flex-col items-center justify-center ${isSearchActive ? 'max-w-4xl mx-auto' : ''}`}>
                                <div className="relative w-full flex items-center justify-center">
                                    <AnimatePresence>
                                        {isSearchActive && searchHistory.length > 0 && (
                                            <motion.button
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -10 }}
                                                onClick={handleGoBack}
                                                className="absolute left-1 md:left-2 top-1/2 -translate-y-1/2 p-2 text-primary hover:text-white transition-colors z-20"
                                            >
                                                <ArrowLeft className="h-6 w-6" />
                                            </motion.button>
                                        )}
                                    </AnimatePresence>

                                    <Search className={`absolute ${isSearchActive && searchHistory.length > 0 ? 'left-10 md:left-12' : 'left-6 md:left-8'} top-1/2 -translate-y-1/2 h-5 md:h-6 w-5 md:w-6 text-gray-500 group-focus-within:text-primary transition-all`} />
                                    <input
                                        id="searchQuery"
                                        name="searchQuery"
                                        type="text"
                                        onFocus={() => setIsSearchActive(true)}
                                        autoComplete="off"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                e.currentTarget.blur();
                                            }
                                        }}
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder={TEXTS.home.searchPlaceholder}
                                        className={`w-full bg-white/5 border-2 border-white/5 hover:border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] py-5 md:py-8 ${isSearchActive && searchHistory.length > 0 ? 'pl-20 md:pl-28' : 'pl-14 md:pl-20'} pr-16 md:pr-20 text-xl md:text-2xl font-bold text-white placeholder:text-gray-700/50 focus:outline-none focus:ring-0 focus:border-primary/50 transition-all focus:bg-neutral-900 shadow-2xl`}
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
                                </div>

                                {/* CHIP LOCATION (In flow to prevent overlap) */}
                                <AnimatePresence>
                                    {selectedArtist && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9, height: 0 }}
                                            animate={{ opacity: 1, scale: 1, height: "auto" }}
                                            exit={{ opacity: 0, scale: 0.9, height: 0 }}
                                            className="pt-4 pb-1 w-full flex justify-center overflow-hidden"
                                        >
                                            <SearchChip
                                                name={selectedArtist.name}
                                                onRemove={() => {
                                                    setSelectedArtist(null);
                                                    setQuery("");
                                                    setSearchResults([]);
                                                }}
                                            />
                                        </motion.div>
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
                                                    : "bg-white/5 border-white/5 text-gray-500"
                                                    }`}
                                            >
                                                {TEXTS.home.filters[f as keyof typeof TEXTS.home.filters] || f}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {!isSearchActive && <PremiumShowcase />}

                        {/* GRILLA DE RESULTADOS (ULTRA-COMPACT) */}
                        {
                            isSearchActive && (
                                <div className="flex-1 overflow-y-auto px-4 w-full hide-scrollbar" ref={resultsContainerRef}>
                                    <div className="max-w-4xl mx-auto pb-40">
                                        {/* Loading State */}
                                        {isLoadingSearch && searchResults.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 animate-pulse">
                                                    {TEXTS.home.loadingDiscogs}
                                                </p>
                                            </div>
                                        )}

                                        {/* Results Grid - COMPACT UI */}
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
                                            {searchResults.map((result, idx) => (
                                                <CompactSearchCard
                                                    key={`${result.id}-${idx}`}
                                                    result={result}
                                                    idx={idx}
                                                    onClick={() => handleEntityDrillDown(result)}
                                                />
                                            ))}
                                        </div>

                                        {/* No Results Case */}
                                        {!isLoadingSearch && searchResults.length === 0 && query.trim().length >= 3 && (
                                            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                                <Search className="w-12 h-12 text-white/10" />
                                                <div>
                                                    <h3 className="text-xl font-display font-black text-white uppercase tracking-widest leading-none">
                                                        Sin resultados
                                                    </h3>
                                                    <p className="text-xs text-gray-500 font-bold mt-2 uppercase tracking-widest">
                                                        Probá simplificando la búsqueda
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Infinite Scroll Anchor */}
                                        <div ref={observerTarget} className="h-20 w-full flex items-center justify-center mt-8">
                                            {isLoadingSearch && searchResults.length > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <div className="h-4 w-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                                                    <span className="text-[8px] font-black uppercase tracking-[0.3em] text-gray-500 animate-pulse">Cargando más...</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        }
                    </motion.div >
                ) : (
                    <motion.div
                        key="steps-container"
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-8 md:space-y-16 w-full"
                    >
                        <header className="text-center md:text-left">
                            <h2 className="text-2xl md:text-5xl font-display font-black text-white uppercase tracking-tighter">{TEXTS.item.detailTitle}</h2>
                        </header>

                        {/* Collector Receipt View Extracted Logic */}
                        {publicOrder ? (
                            <div className="bg-[#050505] border-2 border-white/5 rounded-[1.5rem] md:rounded-[3rem] overflow-hidden group relative w-full shadow-2xl">
                                <div className="absolute top-0 right-0 p-8 z-30 flex items-center gap-3">
                                    <button
                                        onClick={handleShare}
                                        className="h-10 px-4 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 backdrop-blur-md flex items-center justify-center gap-2 transition-all group"
                                        title={TEXTS.item.share}
                                    >
                                        <Share className="h-4 w-4 text-gray-300 group-hover:text-white transition-colors" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-300 group-hover:text-white transition-colors hidden sm:block">{TEXTS.item.share}</span>
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
                                            {publicOrder.status === 'sold' ? TEXTS.admin.statusOptions.venta_finalizada :
                                                publicOrder.status === 'quoted' ? TEXTS.admin.statusOptions.quoted :
                                                    TEXTS.item.toConfirm}
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
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">{TEXTS.item.receiptTitle}</h4>
                                            <h3 className="text-3xl lg:text-5xl font-display font-black text-white uppercase tracking-tighter leading-none">
                                                {(selectedItem as any).normalizedArtist} <br />
                                                <span className="text-primary">{(selectedItem as any).normalizedAlbum}</span>
                                            </h3>
                                            <p className="text-primary font-mono tracking-widest text-sm">{publicOrder.order_number}</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-8 py-8 border-y border-white/5">
                                            <div className="space-y-2">
                                                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{TEXTS.item.registrationDate}</p>
                                                <p className="text-white font-mono">{publicOrder.timestamp.toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                            </div>
                                            {publicOrder.isOwner && (
                                                <div className="space-y-2">
                                                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{TEXTS.item.userPrice}</p>
                                                    <p className="text-primary font-bold font-mono text-lg">{publicOrder.price ? `$${publicOrder.price.toLocaleString('es-AR')}` : TEXTS.item.toConfirm}</p>
                                                </div>
                                            )}
                                            <div className="space-y-2">
                                                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{TEXTS.item.format}</p>
                                                <p className="text-white font-bold">{publicOrder.format || "N/A"}</p>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{TEXTS.item.condition}</p>
                                                <p className="text-white font-bold">{publicOrder.condition || "N/A"}</p>
                                            </div>
                                            <div className="space-y-2 flex flex-col items-start">
                                                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">{TEXTS.item.operation}</p>
                                                <div className={`px-2 py-0.5 rounded-[4px] border backdrop-blur-md ${publicOrder.intent === 'VENDER' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
                                                    <span className="text-[10px] uppercase tracking-widest font-black">
                                                        {publicOrder.intent === 'VENDER' ? TEXTS.item.sellIntent : TEXTS.item.buyIntent}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-4 space-y-4">
                                            {publicOrder.isOwner && publicOrder.status === 'quoted' ? (
                                                <button
                                                    onClick={() => {
                                                        pushWhatsAppContactFromOrder(publicOrder);
                                                        window.open(generateWhatsAppLink(publicOrder), "_blank");
                                                    }}
                                                    className="w-full bg-primary text-black py-6 rounded-xl font-black uppercase text-xs tracking-widest shadow-[0_0_30px_rgba(204,255,0,0.15)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <MessageCircle className="w-4 h-4" />
                                                    {TEXTS.item.contactOrder}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setPublicOrder(null)} // Returns to standard step 1 logic
                                                    className="w-full bg-white/10 hover:bg-white/20 text-white py-6 rounded-xl font-black uppercase text-xs tracking-widest transition-all"
                                                >
                                                    {TEXTS.item.consultSimilar}
                                                </button>
                                            )}

                                            <div className="text-center pt-2">
                                                <button onClick={handleResetSelection} className="text-[10px] font-black uppercase tracking-widest text-gray-700 hover:text-white transition-colors underline decoration-white/20">{TEXTS.item.changeTitle}</button>
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
                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-300 group-hover:text-white transition-colors hidden sm:block">{TEXTS.item.share}</span>
                                            </button>
                                        </div>
                                        <h3 className="text-3xl lg:text-4xl font-display font-black text-white uppercase tracking-tighter leading-none mt-4 md:mt-0">{selectedItem.title}</h3>
                                        <div className="grid grid-cols-2 gap-6">
                                            {selectedItem.year && selectedItem.year !== "0" && selectedItem.year.toUpperCase() !== "N/A" && (
                                                <div>
                                                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{TEXTS.item.year}</p>
                                                    <p className="text-white font-bold">{selectedItem.year}</p>
                                                </div>
                                            )}
                                            {selectedItem.genre && selectedItem.genre.length > 0 && selectedItem.genre[0].toUpperCase() !== "N/A" && (
                                                <div>
                                                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{TEXTS.item.genre}</p>
                                                    <p className="text-primary font-bold">{selectedItem.genre[0]}</p>
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={handleResetSelection} className="text-[10px] font-black uppercase tracking-widest text-gray-700 hover:text-primary transition-colors underline decoration-primary/20">{TEXTS.item.changeSelection}</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 1: Format, Condition, Intent */}
                        {step === 1 && !publicOrder && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-8 md:space-y-12"
                            >
                                <div className="space-y-4 md:space-y-6">
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 italic block px-4"> {TEXTS.item.steps.format} </label>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                        {(["VINILO", "CD", "CASSETTE", "OTROS"] as Format[]).map(f => (
                                            <button
                                                key={f}
                                                onClick={() => {
                                                    setFormat(f);
                                                    setTimeout(() => scrollToElement(conditionRef, 120), 50);
                                                }}
                                                className={`py-5 rounded-2xl text-xs font-black tracking-widest border-2 transition-all ${format === f ? 'bg-primary border-primary text-black' : 'bg-white/5 border-white/5 text-gray-500'}`}
                                            >
                                                {f}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4 md:space-y-6" ref={conditionRef}>
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 italic block px-4"> {TEXTS.item.steps.condition} </label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {(["NUEVO", "USADO"] as Condition[]).map(c => (
                                            <button
                                                key={c}
                                                onClick={() => {
                                                    setCondition(c);
                                                    setTimeout(() => scrollToElement(actionsRef, 100), 50);
                                                }}
                                                className={`py-5 rounded-2xl text-xs font-black tracking-widest border-2 transition-all ${condition === c ? 'bg-primary border-primary text-black' : 'bg-white/5 border-white/5 text-gray-500'}`}
                                            >
                                                {c === "NUEVO" ? "NUEVO / MINT" : "USADO / VG+"}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {format && condition && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="pt-8 border-t border-white/5 space-y-12"
                                        ref={actionsRef}
                                    >
                                        <div className="flex flex-col gap-4">
                                            <button
                                                onClick={() => {
                                                    handleResetSelection();
                                                    scrollToTop();
                                                }}
                                                className="w-full py-6 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2 transition-all bg-white/5 border border-white/10 text-white hover:bg-white/10"
                                            >
                                                {TEXTS.item.steps.addAnother}
                                            </button>
                                            <button
                                                onClick={() => navigate('/revisar-lote')}
                                                className="w-full bg-primary text-black py-6 rounded-2xl font-black uppercase text-sm tracking-widest shadow-[0_0_40px_rgba(204,255,0,0.2)] hover:scale-[1.02] active:scale-95 transition-all"
                                            >
                                                {TEXTS.item.steps.finishOrder}
                                            </button>
                                        </div>

                                        {/* Recommendations Section - Nested here for better flow */}
                                        {recommendations.length > 0 && (
                                            <div className="pt-12 fade-in w-full border-t border-white/5">
                                                <h4 className="text-xl md:text-2xl font-display font-black text-white italic uppercase tracking-tighter mb-4 md:mb-6 pl-2 border-l-4 border-primary">
                                                    {TEXTS.item.recommendations}
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
                                                                {(rec as any).normalizedAlbum || (rec.title.includes(' - ') ? rec.title.split(' - ')[1] : rec.title)}
                                                            </h5>
                                                            <span className="text-xs font-black text-gray-500 uppercase tracking-widest leading-none truncate w-full mt-1">
                                                                {(rec as any).normalizedArtist || (rec.title.includes(' - ') ? rec.title.split(' - ')[0] : rec.title)}
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
                                    <h3 className="text-3xl md:text-4xl font-display font-black text-white uppercase tracking-tighter">{TEXTS.negotiation.sellPriceTitle}</h3>
                                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest italic">{TEXTS.negotiation.marketValueSubtitle}</p>
                                </div>

                                {/* Market Price Anchor */}
                                {isLoadingMarket ? (
                                    <div className="flex items-center justify-center gap-3 py-4 px-6 bg-white/[0.02] border border-white/5 rounded-xl">
                                        <div className="h-3 w-3 border-2 border-yellow-500/40 border-t-yellow-500 rounded-full animate-spin" />
                                        <span className="text-[10px] font-mono font-bold text-gray-600 uppercase tracking-widest">{TEXTS.negotiation.consultingMarket}</span>
                                    </div>
                                ) : marketPrice !== null && (
                                    <div className="flex items-center gap-3 py-4 px-6 bg-yellow-500/[0.04] border border-yellow-500/10 rounded-xl">
                                        <TrendingUp className="h-4 w-4 text-yellow-500/70 flex-shrink-0" />
                                        <span className="text-[11px] font-mono font-bold text-yellow-500/80 uppercase tracking-wider">
                                            {TEXTS.negotiation.marketRef} {marketPrice.toFixed(2)}
                                        </span>
                                    </div>
                                )}

                                <div className="space-y-6">
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 italic block px-4"> {TEXTS.negotiation.currencyLabel} </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {(["ARS", "USD"] as Currency[]).map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setCurrency(c)}
                                                className={`py-5 rounded-2xl text-xs font-black tracking-widest border-2 transition-all flex items-center justify-center gap-2 ${currency === c ? 'bg-primary border-primary text-black' : 'bg-white/5 border-white/5 text-gray-500'}`}
                                            >
                                                <DollarSign className="h-4 w-4" />
                                                {c === "ARS" ? TEXTS.negotiation.currencyARS : TEXTS.negotiation.currencyUSD}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 italic block px-4"> {TEXTS.negotiation.priceLabel} </label>
                                    <div className="relative">
                                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500 font-black text-lg">
                                            {currency === "ARS" ? "$" : "US$"}
                                        </span>
                                        <input
                                            ref={priceInputRef}
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
                                    disabled={!price}
                                    className="w-full bg-primary text-black py-8 rounded-2xl font-black uppercase text-xs tracking-widest shadow-[0_0_40px_rgba(204,255,0,0.2)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {TEXTS.negotiation.addSellBatch}
                                </button>

                                <div ref={actionsRef} />

                                <button onClick={() => { setIntent(null); setStep(1); }} className="w-full text-[10px] font-black uppercase text-gray-700 hover:text-white transition-colors">{TEXTS.negotiation.back}</button>
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
                                    <h3 className="text-3xl md:text-4xl font-display font-black text-white uppercase tracking-tighter">{TEXTS.auth.syncNetwork}</h3>
                                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest italic">{TEXTS.auth.securityProtocol}</p>
                                </div>

                                <div className="space-y-6">
                                    <button
                                        onClick={handleGoogleSignIn}
                                        className="w-full bg-white text-black py-6 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-4 hover:bg-primary transition-all"
                                    >
                                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5" />
                                        {TEXTS.auth.googleSignIn}
                                    </button>

                                    <div className="relative flex items-center gap-4 py-2">
                                        <div className="flex-1 h-px bg-white/10" />
                                        <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">{TEXTS.auth.manualCredentials}</span>
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
                                                placeholder={TEXTS.auth.emailPlaceholder}
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
                                                placeholder={TEXTS.auth.passwordPlaceholder}
                                                className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-6 pl-16 pr-8 text-white focus:border-primary/40 focus:outline-none transition-all"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="w-full bg-primary text-black py-8 rounded-2xl font-black uppercase text-xs tracking-widest shadow-[0_0_40px_rgba(204,255,0,0.2)] hover:scale-[1.02] active:scale-95 transition-all"
                                        >
                                            {isSubmitting ? TEXTS.auth.connecting : TEXTS.auth.registerAndLink}
                                        </button>
                                    </form>

                                    <button onClick={() => setStep(intent === "VENDER" ? 2 : 1)} className="w-full text-[10px] font-black uppercase text-gray-700 hover:text-white transition-colors">{TEXTS.negotiation.back}</button>
                                </div>
                            </motion.div>
                        )}

                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
