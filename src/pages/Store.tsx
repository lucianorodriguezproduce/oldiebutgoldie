import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ArrowLeft, Search } from "lucide-react";
import { TEXTS } from "@/constants/texts";
import { getInventoryPaged } from "@/services/inventoryService";
import { CompactSearchCard } from "@/components/ui/CompactSearchCard";
import { SEO } from "@/components/SEO";
import { useLoading } from "@/context/LoadingContext";

import { getCleanOrderMetadata } from "@/utils/orderMetadata";

export default function Store() {
    const navigate = useNavigate();
    const { showLoading, hideLoading } = useLoading();
    const [items, setItems] = useState<any[]>([]);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
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
                    // Avoid duplicates just in case
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

    const filteredItems = items.filter(item => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        const { artist, album } = getCleanOrderMetadata(item);
        return (
            artist.toLowerCase().includes(search) ||
            album.toLowerCase().includes(search)
        );
    });

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

                    {/* Local Search inside Store */}
                    <div className="relative max-w-md w-full">
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

                {/* Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-8">
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
                                        type: 'release', // Default for inventory
                                        isLocal: true,
                                        normalizedAlbum: album,
                                        normalizedArtist: artist
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

                {!hasMore && items.length > 0 && (
                    <div className="text-center py-10">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-700">Fin del catálogo</p>
                    </div>
                )}

                {items.length === 0 && !loading && (
                    <div className="text-center py-20 bg-white/5 rounded-[3rem] border border-white/5">
                        <Search className="h-12 w-12 text-white/10 mx-auto mb-4" />
                        <p className="text-gray-500 font-bold uppercase tracking-widest">No se encontraron ítems en stock</p>
                    </div>
                )}
            </div>
        </div>
    );
}
