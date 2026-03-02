import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ArrowLeft, Search, Filter, X, ChevronRight } from "lucide-react";
import { TEXTS } from "@/constants/texts";
import { getInventoryPaged } from "@/services/inventoryService";
import { CompactSearchCard } from "@/components/ui/CompactSearchCard";
import { SEO } from "@/components/SEO";
import { useLoading } from "@/context/LoadingContext";
import { getCleanOrderMetadata } from "@/utils/orderMetadata";
import taxonomyData from "@/constants/taxonomy_options.json";

export default function Store() {
    const navigate = useNavigate();
    const { showLoading, hideLoading } = useLoading();
    const [items, setItems] = useState<any[]>([]);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

    // Filter States
    const [filters, setFilters] = useState({
        genre: "",
        style: "",
        decade: "",
        format: ""
    });

    const observer = useRef<IntersectionObserver | null>(null);

    const loadItems = useCallback(async (reset = false) => {
        if (loading || (!hasMore && !reset)) return;

        setLoading(true);
        if (reset) showLoading(TEXTS.common.loadingGeneric);

        try {
            const result = await getInventoryPaged(20, reset ? undefined : lastDoc);

            if (reset) {
                setItems(result.items);
            } else {
                setItems(prev => {
                    const newItems = result.items.filter(newItem => !prev.some(p => p.id === newItem.id));
                    return [...prev, ...newItems];
                });
            }

            setLastDoc(result.lastDoc);
            setHasMore(result.items.length === 20);
        } catch (error) {
            console.error("Error loading store items:", error);
        } finally {
            setLoading(false);
            if (reset) hideLoading();
        }
    }, [lastDoc, loading, hasMore, showLoading, hideLoading]);

    useEffect(() => {
        loadItems(true);
    }, []);

    const lastItemRef = useCallback((node: HTMLDivElement) => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                loadItems();
            }
        });

        if (node) observer.current.observe(node);
    }, [loading, hasMore, loadItems]);

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const { artist, album } = getCleanOrderMetadata(item);
            const metadata = item.metadata || {};

            // Search Filter
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                if (!artist.toLowerCase().includes(search) && !album.toLowerCase().includes(search)) return false;
            }

            // Genre Filter
            if (filters.genre && !metadata.genres?.includes(filters.genre)) return false;

            // Style Filter
            if (filters.style && !metadata.styles?.includes(filters.style)) return false;

            // Format Filter
            if (filters.format && metadata.format_description !== filters.format) return false;

            // Decade Filter (Original preferred)
            if (filters.decade) {
                const targetDecade = parseInt(filters.decade);
                const itemYear = metadata.original_year || metadata.year || 0;
                const itemDecade = Math.floor(itemYear / 10) * 10;
                if (itemDecade !== targetDecade) return false;
            }

            return true;
        });
    }, [items, searchTerm, filters]);

    const FilterSection = ({ title, options, field }: { title: string, options: string[] | number[], field: keyof typeof filters }) => (
        <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">{title}</h4>
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setFilters(prev => ({ ...prev, [field]: "" }))}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${filters[field] === "" ? "bg-primary text-black border-primary" : "bg-white/5 text-gray-400 border-white/5 hover:border-white/10"}`}
                >
                    Todos
                </button>
                {options.map((opt: any) => (
                    <button
                        key={opt}
                        onClick={() => setFilters(prev => ({ ...prev, [field]: opt.toString() === filters[field] ? "" : opt.toString() }))}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${filters[field] === opt.toString() ? "bg-primary text-black border-primary" : "bg-white/5 text-gray-400 border-white/5 hover:border-white/10"}`}
                    >
                        {field === "decade" ? `${opt}s` : opt}
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#050505] text-white pt-24 pb-20 px-4 md:px-8">
            <SEO
                title={`${TEXTS.showcase.title} - Oldie But Goldie`}
                description="Explora nuestro catálogo completo de vinilos, CDs y cassettes en stock."
            />

            <div className="max-w-7xl mx-auto space-y-12">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-4">
                        <button
                            onClick={() => navigate('/')}
                            className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors group"
                        >
                            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-widest">{TEXTS.common.back}</span>
                        </button>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Star className="h-4 w-4 text-primary fill-primary" />
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80">
                                    {TEXTS.navigation.brand}
                                </span>
                            </div>
                            <h1 className="text-4xl md:text-6xl font-display font-black uppercase tracking-tighter">
                                {TEXTS.showcase.title}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 w-full md:max-w-md">
                        {/* Mobile Filter Button */}
                        <button
                            onClick={() => setIsFilterDrawerOpen(true)}
                            className="md:hidden p-4 bg-white/5 border border-white/10 rounded-2xl text-primary"
                        >
                            <Filter className="h-5 w-5" />
                        </button>

                        {/* Local Search inside Store */}
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Filtrar catálogo..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold focus:outline-none focus:border-primary/50 transition-all"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-12">
                    {/* Desktop Sidebar Filters */}
                    <div className="hidden md:block w-64 space-y-10 shrink-0">
                        <FilterSection title="Géneros" options={taxonomyData.genres} field="genre" />
                        <FilterSection title="Estilos" options={taxonomyData.styles} field="style" />
                        <FilterSection title="Formato" options={taxonomyData.formats} field="format" />
                        <FilterSection title="Décadas" options={taxonomyData.decades} field="decade" />
                    </div>

                    {/* Grid Area */}
                    <div className="flex-1 space-y-8">
                        {/* Active Filters Bar */}
                        {Object.values(filters).some(v => v !== "") && (
                            <div className="flex flex-wrap gap-2 items-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-600 mr-2">Activos:</span>
                                {Object.entries(filters).map(([k, v]) => v && (
                                    <button
                                        key={k}
                                        onClick={() => setFilters(prev => ({ ...prev, [k]: "" }))}
                                        className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-black uppercase tracking-widest text-primary"
                                    >
                                        {k === "decade" ? `${v}s` : v}
                                        <X className="h-3 w-3" />
                                    </button>
                                ))}
                                <button
                                    onClick={() => setFilters({ genre: "", style: "", decade: "", format: "" })}
                                    className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
                                >
                                    Limpiar Todo
                                </button>
                            </div>
                        )}

                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8">
                            {filteredItems.map((item, idx) => {
                                const { artist, album, image } = getCleanOrderMetadata(item);
                                return (
                                    <div key={item.id} ref={idx === filteredItems.length - 1 ? lastItemRef : null}>
                                        <CompactSearchCard
                                            result={{
                                                id: item.id,
                                                title: album,
                                                cover_image: image,
                                                thumb: image,
                                                type: 'release',
                                                isLocal: true,
                                                normalizedAlbum: album,
                                                normalizedArtist: artist,
                                                genre: item.metadata?.genres || [],
                                                style: item.metadata?.styles || []
                                            } as any}
                                            idx={idx}
                                            onClick={() => navigate(`/album/${item.id}`)}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Loading State for Infinite Scroll */}
                        {loading && (
                            <div className="flex justify-center py-10">
                                <div className="h-8 w-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                            </div>
                        )}

                        {!hasMore && filteredItems.length > 0 && (
                            <div className="text-center py-10">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-700">Fin del catálogo</p>
                            </div>
                        )}

                        {filteredItems.length === 0 && !loading && (
                            <div className="text-center py-20 bg-white/5 rounded-[3rem] border border-white/5">
                                <Search className="h-12 w-12 text-white/10 mx-auto mb-4" />
                                <p className="text-gray-500 font-bold uppercase tracking-widest">No se encontraron ítems con estos filtros</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Filter Drawer */}
            <AnimatePresence>
                {isFilterDrawerOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsFilterDrawerOpen(false)}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] md:hidden"
                        />
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            className="fixed right-0 top-0 bottom-0 w-full max-w-[300px] bg-[#0a0a0a] border-l border-white/10 z-[101] p-8 space-y-10 overflow-y-auto md:hidden"
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-2xl font-black italic text-white uppercase tracking-tighter">Filtros</h3>
                                <button onClick={() => setIsFilterDrawerOpen(false)} className="p-2 bg-white/5 rounded-xl">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <FilterSection title="Géneros" options={taxonomyData.genres} field="genre" />
                            <FilterSection title="Estilos" options={taxonomyData.styles} field="style" />
                            <FilterSection title="Formato" options={taxonomyData.formats} field="format" />
                            <FilterSection title="Décadas" options={taxonomyData.decades} field="decade" />

                            <button
                                onClick={() => setIsFilterDrawerOpen(false)}
                                className="w-full py-4 bg-primary text-black rounded-xl font-black uppercase tracking-widest mt-8"
                            >
                                Ver {filteredItems.length} Discos
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
