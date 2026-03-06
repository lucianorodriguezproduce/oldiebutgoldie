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

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                    {items.map((item, idx) => (
                        <motion.div
                            key={`${item.id}-${idx}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: (idx % 10) * 0.05 }}
                        >
                            <Link
                                to={`/archivo/${item.id}`}
                                className="group block bg-white/5 rounded-2xl overflow-hidden border border-white/10 hover:border-primary/30 transition-all"
                            >
                                <div className="aspect-square relative overflow-hidden">
                                    <LazyImage
                                        src={item.image}
                                        alt={item.title}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                    {item.source === 'inventory' ? (
                                        <div className="absolute top-3 right-3 px-2 py-1 bg-primary text-black text-[10px] font-black uppercase tracking-widest rounded-md">
                                            Stock
                                        </div>
                                    ) : (
                                        <div className="absolute top-3 right-3 px-2 py-1 bg-white/20 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest rounded-md border border-white/20">
                                            Comunidad
                                        </div>
                                    )}
                                </div>
                                <div className="p-4">
                                    <h3 className="text-white font-bold text-sm truncate uppercase tracking-tight mb-1 group-hover:text-primary transition-colors">
                                        {item.title}
                                    </h3>
                                    <p className="text-gray-500 text-[10px] font-mono truncate uppercase tracking-widest">
                                        {item.artist}
                                    </p>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>

                {hasMore && (
                    <div className="mt-16 flex justify-center">
                        <button
                            onClick={loadMore}
                            disabled={loading}
                            className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-xs font-black uppercase tracking-[0.2em] transition-all disabled:opacity-50"
                        >
                            {loading ? "Cargando..." : "Cargar más discos"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
