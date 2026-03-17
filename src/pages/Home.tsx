import { useState, useEffect, useRef, useCallback, memo } from "react";
import { TEXTS } from "@/constants/texts";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { LazyImage } from "@/components/ui/LazyImage";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, CheckCircle2, Mail, Layers, DollarSign, TrendingUp, MessageCircle, X, Share, ArrowLeft, Star, Disc, Package, ShoppingBag } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query as firestoreQuery, where, getDocs, limit } from "firebase/firestore";
import { useDebounce } from "@/hooks/useDebounce";
import { discogsService, type DiscogsSearchResult } from "@/lib/discogs";
import { authenticateUser, signInWithGoogle } from "@/lib/auth";

import { useAuth } from "@/context/AuthContext";
import { useLoading } from "@/context/LoadingContext";
import { generateWhatsAppLink } from "@/utils/whatsapp";
import { whatsappService } from "@/services/whatsappService";
import { pushViewItem, pushWhatsAppContactFromOrder, pushWizardStep } from "@/utils/analytics";
import { SEO } from "@/components/SEO";
import { useLote } from "@/context/LoteContext";
import { PremiumShowcase } from "@/components/PremiumShowcase";
import { inventoryService } from "@/services/inventoryService";
import { tradeService } from "@/services/tradeService";
import { useHealth } from "@/context/HealthContext";
import { CompactSearchCard } from "@/components/ui/CompactSearchCard";
import { CardSkeleton } from "@/components/ui/Skeleton";
import ItemConfigModal from "@/components/discogs/ItemConfigModal";



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


type Intent = "COMPRAR" | "VENDER";
type Format = "CD" | "VINILO" | "CASSETTE" | "OTROS";
type Condition = "NUEVO" | "USADO";
type Currency = "ARS" | "USD";

export default function Home() {
    const { user, dbUser, isAdmin } = useAuth();
    const { type: routeType, id: routeId } = useParams<{ type: string, id: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { addItemToBatch, addItemFromInventory, isInLote, totalCount, loteItems } = useLote();

    const [query, setQuery] = useState("");
    const { showLoading, hideLoading } = useLoading();
    const [step, setStep] = useState(1);

    const [isSearchActive, setIsSearchActive] = useState(false);
    const [searchFilter, setSearchFilter] = useState<"todo" | "artistas" | "álbumes">("todo");
    const [searchResults, setSearchResults] = useState<DiscogsSearchResult[]>([]);
    const [blockedAssetIds, setBlockedAssetIds] = useState<string[]>([]);
    const [isLoadingSearch, setIsLoadingSearch] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<DiscogsSearchResult | null>(null);
    const [recommendations, setRecommendations] = useState<DiscogsSearchResult[]>([]);
    const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
    const [publicOrder, setPublicOrder] = useState<any>(null); // For rendering the Collector Receipt
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [selectedSearchItem, setSelectedSearchItem] = useState<any>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    // Wizard & Modal States
    const observerTarget = useRef<HTMLDivElement>(null);
    const [searchHistory, setSearchHistory] = useState<any[]>([]); // To allow "Go Back" in drill-downs
    const [selectedArtist, setSelectedArtist] = useState<{ id: number, name: string } | null>(null);

    // Start of the block to be replaced/modified
    // Local Auth UI states (only for the manual form)
    const { health } = useHealth();
    const debouncedQuery = useDebounce(query, health.isEnergyMode ? 1200 : 300);
    const resultsContainerRef = useRef<HTMLDivElement>(null);

    // Listener para Asset Locking Visual
    useEffect(() => {
        const unsubscribe = tradeService.onSnapshotBlockedAssets((data) => {
            // En Home, bloqueamos visualmente tanto negociados como reservados
            setBlockedAssetIds([...data.negotiating, ...data.reserved]);
        });
        return () => unsubscribe();
    }, []);

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
        if (selectedItem) {
            pushViewItem(selectedItem, "OBSERVANDO");
        }
    }, [selectedItem?.id]);

    // Automatic Addition Effect - Deprecated in favor of explicit Wizard selection (V23.5)
    /*
    useEffect(() => {
        if (selectedItem && format && condition) {
            // ... auto-add logic removed ...
        }
    }, [format, condition, selectedItem, loteItems, addItemToBatch]);
    */

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
            normalizedAlbum: realAlbum,
            year: data.year?.toString() || data.released?.toString() || "0"
        };
    };

    // Handle initial route loading if hitting /item/:type/:id directly
    useEffect(() => {
        const loadItemFromRoute = async () => {
            if (routeId && routeType && !selectedItem) {
                showLoading(TEXTS.home.loadingDiscogs);
                try {
                    let itemData: any;
                    let isLocalItem = false;

                    // 1. INTENTAR CARGA LOCAL SI PARECE UN UUID
                    if (routeId.includes('-')) {
                        itemData = await inventoryService.getItemById(routeId);
                        if (itemData) isLocalItem = true;
                    }

                    // 2. FALLBACK A DISCOGS
                    if (!itemData) {
                        try {
                            if (routeType === 'release') {
                                itemData = await discogsService.getReleaseDetails(routeId);
                            } else if (routeType === 'master') {
                                itemData = await discogsService.getMasterDetails(routeId);
                            } else if (routeType === 'artist') {
                                itemData = await discogsService.getArtistReleases(routeId);
                            }
                        } catch (e) {
                            console.warn("Discogs load failed, item not found externally.");
                        }
                    }

                    if (itemData) {
                        if (isLocalItem) {
                            setSelectedItem({
                                id: itemData.id,
                                title: `${itemData.metadata.artist} - ${itemData.metadata.title}`,
                                cover_image: itemData.media?.full_res_image_url || itemData.media?.thumbnail || '',
                                thumb: itemData.media?.thumbnail || '',
                                type: 'release',
                                isLocal: true,
                                inventoryItem: itemData,
                                normalizedArtist: itemData.metadata.artist,
                                normalizedAlbum: itemData.metadata.title
                            } as any);
                        } else {
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
                        }
                        setIsSearchActive(false);

                        // SOBERANIA: Cross-reference with existing trades in Firebase
                        try {
                            const numericalRouteId = Number(routeId || 0);
                            const q = firestoreQuery(
                                collection(db, "trades"),
                                where("manifest.requestedItems", "array-contains", isLocalItem ? routeId : numericalRouteId),
                                limit(1)
                            );
                            const orderSnap = await getDocs(q);
                            if (!orderSnap.empty) {
                                const orderData = orderSnap.docs[0].data() as any;
                                setPublicOrder({
                                    id: orderSnap.docs[0].id,
                                    order_number: orderSnap.docs[0].id?.slice(-5).toUpperCase(),
                                    status: orderData.status || 'pending',
                                    format: orderData.manifest?.items?.[0]?.format,
                                    condition: orderData.manifest?.items?.[0]?.condition,
                                    intent: 'COMPRAR',
                                    price: orderData.manifest?.cashAdjustment || null,
                                    timestamp: orderData.timestamp?.toDate() || new Date(),
                                    isOwner: auth.currentUser?.uid === orderData.participants?.senderId
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
                setIsLoadingSearch(true);
                setSearchError(null);
                try {
                    let results: any[] = [];
                    let pagination = { page: 1, pages: 1 };

                    // 1. BUSQUEDA LOCAL (batea) - Prioridad Alta
                    let localResults: any[] = [];
                    if (!selectedArtist && (searchFilter === "todo" || searchFilter === "álbumes")) {
                        const localItems = await inventoryService.searchItems(debouncedQuery);
                        localResults = localItems
                            .filter(item => !blockedAssetIds.includes(item.id))
                            .map(item => ({
                                id: item.id,
                                title: `${item.metadata.artist} - ${item.metadata.title}`,
                                cover_image: item.media.full_res_image_url || item.media.thumbnail,
                                thumb: item.media.thumbnail,
                                type: "release",
                                isLocal: true,
                                inventoryItem: item,
                                normalizedArtist: item.metadata.artist,
                                normalizedAlbum: item.metadata.title
                            }));
                    }

                    // 2. BUSQUEDA EXTERNA (DISCOGS)
                    if (selectedArtist) {
                        const response = await discogsService.searchArtistReleases(selectedArtist.name, debouncedQuery, 1);
                        results = response.results;
                        pagination = response.pagination;
                    } else {
                        let typeParam = "release,master,artist";
                        if (searchFilter === "artistas") typeParam = "artist";
                        if (searchFilter === "álbumes") typeParam = "release,master";

                        const response = await discogsService.searchReleases(debouncedQuery, 1, undefined, typeParam);
                        results = response.results;
                        pagination = response.pagination;
                    }

                    // Mezclar y filtrar
                    const combinedResults = [...localResults, ...results];

                    if (combinedResults.length > 0) {
                        setSearchResults(combinedResults);
                        setHasMore(pagination.page < pagination.pages);
                        setCurrentPage(1);
                    } else {
                        setSearchResults([]);
                        setHasMore(false);
                        try {
                            await addDoc(collection(db, "missed_searches"), {
                                query: debouncedQuery,
                                timestamp: serverTimestamp(),
                                uid: user?.uid || "anonymous",
                                filter: selectedArtist ? "artist_context" : searchFilter
                            });
                        } catch (err) {
                            console.error("Failed to log missed search:", err);
                        }
                    }
                } catch (error: any) {
                    console.error("Search error:", error);
                    setSearchError(error.details?.error || error.message || "Error de conexión con Discogs");
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
            // IF LOCAL: Use existing detail view
            if ((result as any).isLocal) {
                navigate(`/item/${result.type}/${result.id}`);
                return;
            }

            // IF DISCOGS: Obtener detalles completos para Ingesta de Alta Fidelidad
            showLoading(TEXTS.home.loadingDiscogs);
            try {
                const details = result.type === 'master'
                    ? await discogsService.getMasterDetails(String(result.id))
                    : await discogsService.getReleaseDetails(String(result.id));
                const normalized = normalizeDiscogsData({ ...result, ...details });

                // Seteamos selectedItem para que se muestre la vista de detalle con los botones de acción
                setSelectedItem({
                    ...normalized,
                    cover_image: normalized.images?.[0]?.uri || normalized.thumb || '',
                    thumb: normalized.thumb || '',
                    type: result.type,
                    normalizedArtist: normalized.normalizedArtist,
                    normalizedAlbum: normalized.normalizedAlbum
                } as any);

                // ACTIVAR WIZARD CONFIG (Protocolo V21.3) - Unificado V23.5
                setSelectedSearchItem({
                    ...normalized,
                    cover_image: normalized.images?.[0]?.uri || normalized.thumb || '',
                    thumb: normalized.thumb || '',
                    type: result.type,
                    normalizedArtist: normalized.normalizedArtist,
                    normalizedAlbum: normalized.normalizedAlbum
                });
                setShowConfigModal(true);

                // No cerramos el detalle inmediatamente, dejamos que el modal se superponga
                // setIsSearchActive(false); 

            } catch (error) {
                console.error("Error loading release details:", error);
                setSearchError("No se pudo obtener detalles del disco.");
            } finally {
                hideLoading();
            }
            return;
        }

        showLoading(TEXTS.global.common.loadingGeneric);
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

    const handleResetSelection = useCallback(() => {
        setSelectedItem(null);
        setQuery("");
        setSearchResults([]);
        setHasMore(false);
        setIsSearchActive(false);

        // Clean URL if we are coming from a dynamic route
        if (routeId) {
            navigate('/', { replace: true });
        }
    }, [routeId, navigate]);

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
            alert(TEXTS.global.common.confirm || 'Enlace copiado al portapapeles');
        }
    };

    const generateOrderNumber = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return `#ORD-${result}`;
    };

    const handleConfigConfirm = (config: { format: string; condition: string }, action: 'another' | 'finish') => {
        if (!selectedSearchItem) return;

        pushWizardStep('wizard_add_to_lote', {
            item_id: selectedSearchItem.id,
            format: config.format,
            condition: config.condition,
            action
        });

        addItemToBatch({
            id: selectedSearchItem.id,
            title: selectedSearchItem.title,
            artist: selectedSearchItem.normalizedArtist || "",
            album: selectedSearchItem.normalizedAlbum || selectedSearchItem.title,
            cover_image: selectedSearchItem.cover_image || selectedSearchItem.thumb,
            thumb: selectedSearchItem.thumb,
            year: selectedSearchItem.year,
            genre: selectedSearchItem.genre,
            styles: selectedSearchItem.style || selectedSearchItem.styles,
            format: config.format,
            condition: config.condition,
            source: 'DISCOGS',
            type: selectedSearchItem.type
        });

        setShowConfigModal(false);
        setSelectedSearchItem(null);

        if (action === 'finish') {
            navigate('/revisar-lote');
        } else {
            // "Añadir otro": Volver a modo búsqueda para carga fluida (Protocolo V21.3)
            setSelectedItem(null);
            setIsSearchActive(true);
            if (resultsContainerRef.current) resultsContainerRef.current.scrollTop = 0;
            // No reseteamos query ni searchResults para permitir seguir explorando el mismo contexto
        }
    };

    // Legacy Submission Handlers removed in V23.5 in favor of Lote Flow consolidation
    // All purchase/offer intents now go through /revisar-lote via ItemConfigModal -> LoteContext

    // Success view removed from Home.tsx - Now handled by RevisarLote.tsx success state

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
                    }}
                />
            ) : (
                <SEO
                    title={TEXTS.global.common.seo.home.title}
                    description={TEXTS.global.common.seo.home.desc}
                    url="https://oldiebutgoldie.com.ar"
                    schema={{
                        "@context": "https://schema.org",
                        "@type": "WebSite",
                        "name": TEXTS.global.navigation.brand,
                        "description": TEXTS.global.common.seo.home.desc,
                        "keywords": TEXTS.global.common.seo.home.keys
                    }}
                />
            )}

            {/* ItemConfigModal Trigger (V4.1 Wizard) */}
            <ItemConfigModal
                isOpen={showConfigModal}
                onClose={() => setShowConfigModal(false)}
                item={selectedSearchItem}
                onConfirm={handleConfigConfirm}
            />

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
                                        <div className="flex items-center justify-center gap-2">
                                            <Star className="h-3 w-3 text-primary fill-primary" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80">
                                                {TEXTS.home.showcase.subtitle}
                                            </span>
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
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 py-10">
                                                {[...Array(6)].map((_, i) => (
                                                    <CardSkeleton key={i} />
                                                ))}
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

                                        {/* Error State */}
                                        {searchError && (
                                            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                                                    <X className="w-6 h-6 text-red-500" />
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-display font-black text-white uppercase tracking-widest leading-none">
                                                        Falla de Radar
                                                    </h3>
                                                    <p className="text-xs text-gray-500 font-bold mt-2 uppercase tracking-widest">
                                                        {searchError}
                                                    </p>
                                                    <button
                                                        onClick={() => setQuery(query)} // Retry
                                                        className="mt-6 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
                                                    >
                                                        Reintentar Conexión
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* No Results Case */}
                                        {!isLoadingSearch && !searchError && searchResults.length === 0 && query.trim().length >= 3 && (
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
                            <h2 className="text-2xl md:text-5xl font-display font-black text-white uppercase tracking-tighter">{TEXTS.album.item.detailTitle}</h2>
                        </header>

                        {/* Collector Receipt View Extracted Logic */}
                        {publicOrder ? (
                            <div className="bg-[#050505] border-2 border-white/5 rounded-[1.5rem] md:rounded-[3rem] overflow-hidden group relative w-full shadow-2xl">
                                <div className="absolute top-0 right-0 p-8 z-30 flex items-center gap-3">
                                    <button
                                        onClick={handleShare}
                                        className="h-10 px-4 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 backdrop-blur-md flex items-center justify-center gap-2 transition-all group"
                                        title={TEXTS.album.item.share}
                                    >
                                        <Share className="h-4 w-4 text-gray-300 group-hover:text-white transition-colors" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-300 group-hover:text-white transition-colors hidden sm:block">{TEXTS.album.item.share}</span>
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
                                            {publicOrder.status === 'sold' ? TEXTS.admin.admin.statusOptions.venta_finalizada :
                                                publicOrder.status === 'quoted' ? TEXTS.admin.admin.statusOptions.quoted :
                                                    TEXTS.album.item.toConfirm}
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
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">{TEXTS.album.item.receiptTitle}</h4>
                                            <h3 className="text-3xl lg:text-5xl font-display font-black text-white uppercase tracking-tighter leading-none">
                                                {(selectedItem as any).normalizedArtist} <br />
                                                <span className="text-primary">{(selectedItem as any).normalizedAlbum}</span>
                                            </h3>
                                            <p className="text-primary font-mono tracking-widest text-sm">{publicOrder.order_number}</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-8 py-8 border-y border-white/5">
                                            <div className="space-y-2">
                                                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{TEXTS.album.item.registrationDate}</p>
                                                <p className="text-white font-mono">{publicOrder.timestamp.toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                            </div>
                                            {publicOrder.isOwner && (
                                                <div className="space-y-2">
                                                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{TEXTS.album.item.userPrice}</p>
                                                    <p className="text-primary font-bold font-mono text-lg">{publicOrder.price ? `$${publicOrder.price.toLocaleString('es-AR')}` : TEXTS.album.item.toConfirm}</p>
                                                </div>
                                            )}
                                            <div className="space-y-2">
                                                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{TEXTS.album.item.format}</p>
                                                <p className="text-white font-bold">{publicOrder.format || "N/A"}</p>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{TEXTS.album.item.condition}</p>
                                                <p className="text-white font-bold">{publicOrder.condition || "N/A"}</p>
                                            </div>
                                            <div className="space-y-2 flex flex-col items-start">
                                                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">{TEXTS.album.item.operation}</p>
                                                <div className={`px-2 py-0.5 rounded-[4px] border backdrop-blur-md ${publicOrder.intent === 'VENDER' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
                                                    <span className="text-[10px] uppercase tracking-widest font-black">
                                                        {publicOrder.intent === 'VENDER' ? TEXTS.album.item.sellIntent : TEXTS.album.item.buyIntent}
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
                                                    {TEXTS.album.item.contactOrder}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setPublicOrder(null)} // Returns to standard step 1 logic
                                                    className="w-full bg-white/10 hover:bg-white/20 text-white py-6 rounded-xl font-black uppercase text-xs tracking-widest transition-all"
                                                >
                                                    {TEXTS.album.item.consultSimilar}
                                                </button>
                                            )}

                                            <div className="text-center pt-2">
                                                <button onClick={handleResetSelection} className="text-[10px] font-black uppercase tracking-widest text-gray-700 hover:text-white transition-colors underline decoration-white/20">{TEXTS.album.item.changeTitle}</button>
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
                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-300 group-hover:text-white transition-colors hidden sm:block">{TEXTS.album.item.share}</span>
                                            </button>
                                        </div>
                                        <h3 className="text-3xl lg:text-4xl font-display font-black text-white uppercase tracking-tighter leading-none mt-4 md:mt-0">{selectedItem.title}</h3>
                                        <div className="grid grid-cols-2 gap-6">
                                            {selectedItem.year && selectedItem.year !== "0" && String(selectedItem.year).toUpperCase() !== "N/A" && (
                                                <div>
                                                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{TEXTS.album.item.year}</p>
                                                    <p className="text-white font-bold">{selectedItem.year}</p>
                                                </div>
                                            )}
                                            {selectedItem.genre && selectedItem.genre.length > 0 && String(selectedItem.genre[0]).toUpperCase() !== "N/A" && (
                                                <div>
                                                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{TEXTS.album.item.genre}</p>
                                                    <p className="text-primary font-bold">{selectedItem.genre[0]}</p>
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={handleResetSelection} className="text-[10px] font-black uppercase tracking-widest text-gray-700 hover:text-primary transition-colors underline decoration-primary/20">{TEXTS.album.item.changeSelection}</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ItemConfigModal Trigger */}
                        <ItemConfigModal
                            isOpen={showConfigModal}
                            onClose={() => setShowConfigModal(false)}
                            item={selectedSearchItem}
                            onConfirm={handleConfigConfirm}
                        />

                        {/* Step 1: Format, Condition, Intent (DEPRECATED BUTTONS V23.5) */}
                        {step === 1 && !publicOrder && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-8"
                            >
                                <div className="text-center py-10">
                                    <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">
                                        Configurá tu pedido en el modal superior
                                    </p>
                                    <button
                                        onClick={() => setShowConfigModal(true)}
                                        className="mt-6 px-10 py-4 bg-primary text-black font-black uppercase tracking-widest rounded-2xl hover:scale-105 transition-all shadow-xl shadow-primary/20"
                                    >
                                        Configurar Pedido
                                    </button>
                                </div>

                                <div className="text-center pt-8">
                                    <button onClick={handleResetSelection} className="text-[10px] font-black uppercase tracking-widest text-gray-700 hover:text-white transition-colors underline decoration-white/20">
                                        Elegir otro disco
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 2 & 3 (Legacy) removed for flow consolidation */}
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}
