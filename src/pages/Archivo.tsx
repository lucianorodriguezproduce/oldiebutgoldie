import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, ChevronRight, Disc, Layers } from "lucide-react";
import { archivoService, type UnifiedItem } from "@/services/archivoService";
import { LazyImage } from "@/components/ui/LazyImage";
import { SEO } from "@/components/SEO";

export default function Archivo() {
    const [items, setItems] = useState<UnifiedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastDocs, setLastDocs] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);

    const loadMore = async () => {
        if (!hasMore || (loading && items.length > 0)) return;
        setLoading(true);
        try {
            const result = await archivoService.getCombinedPaged(20, lastDocs);
            setItems(prev => [...prev, ...result.items]);
            setLastDocs(result.lastDocs);
            setHasMore(result.hasMore);
        } catch (error) {
            console.error("Error loading archive:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMore();
    }, []);

    return (
        <div className="min-h-screen bg-black pt-24 pb-20 px-6">
            <SEO
                title="Archivo de Vinilos | Oldie But Goldie"
                description="Explorá el catálogo histórico y batea compartida de Oldie But Goldie. Vinilos, CD y joyas musicales."
            />

            <div className="max-w-7xl mx-auto">
                <header className="mb-12">
                    <h1 className="text-4xl md:text-6xl font-display font-black text-white uppercase tracking-tighter mb-4">
                        Archivo <span className="text-primary">Musical</span>
                    </h1>
                    <p className="text-gray-500 font-mono text-sm max-w-2xl uppercase tracking-widest leading-relaxed">
                        Explorá el inventario total del búnker. Discos en stock y piezas únicas de la comunidad.
                    </p>
                </header>

                <div className="columns-2 md:columns-4 lg:columns-5 gap-4 md:gap-6 space-y-4 md:space-y-6">
                    {items.map((item, idx) => (
                        <motion.div
                            key={`${item.id}-${idx}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: (idx % 10) * 0.05 }}
                            className="break-inside-avoid mb-4 md:mb-6"
                        >
                            <Link
                                to={`/archivo/${item.id}`}
                                className="group block bg-white/5 rounded-2xl md:rounded-[2rem] overflow-hidden border border-white/10 hover:border-primary/30 transition-all shadow-2xl shadow-black/50"
                            >
                                <div className="aspect-square relative overflow-hidden">
                                    <LazyImage
                                        src={item.image}
                                        alt={item.title}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />

                                    {item.source === 'inventory' ? (
                                        <div className="absolute top-3 right-3 px-3 py-1.5 bg-primary text-black text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg border border-primary/20">
                                            DISPONIBLE EN TIENDA
                                        </div>
                                    ) : (
                                        <div className="absolute top-3 right-3 px-3 py-1.5 bg-white/10 backdrop-blur-md text-white/90 text-[9px] font-black uppercase tracking-widest rounded-full border border-white/20 shadow-lg">
                                            COLECCIÓN PRIVADA
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 md:p-5">
                                    <h3 className="text-white font-display font-black text-sm md:text-md truncate uppercase tracking-tight mb-1 group-hover:text-primary transition-colors">
                                        {item.title}
                                    </h3>
                                    <p className="text-gray-500 text-[10px] font-mono truncate uppercase tracking-widest opacity-70">
                                        {item.artist}
                                    </p>
                                </div>
                            </Link>
                        </motion.div>
                    ))}

                    {loading && Array.from({ length: 10 }).map((_, i) => (
                        <div key={`skeleton-${i}`} className="break-inside-avoid mb-6">
                            <div className="space-y-4">
                                <div className="aspect-square rounded-[2rem] bg-white/5 animate-pulse border border-white/5" />
                                <div className="space-y-2 px-2">
                                    <div className="h-4 w-3/4 bg-white/5 rounded-full animate-pulse" />
                                    <div className="h-3 w-1/2 bg-white/5 rounded-full animate-pulse opacity-50" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {hasMore && !loading && (
                    <div className="mt-20 flex justify-center pb-10">
                        <button
                            onClick={loadMore}
                            className="px-10 py-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] transition-all hover:scale-105 active:scale-95 shadow-xl shadow-black/40"
                        >
                            Explorar más del búnker
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
