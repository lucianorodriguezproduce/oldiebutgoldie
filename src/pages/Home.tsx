import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Link } from "react-router-dom";
import { discogsService, type DiscogsSearchResult } from "@/lib/discogs";
import { motion, AnimatePresence } from "framer-motion";
import { AlbumCardSkeleton } from "@/components/ui/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { useTelemetry } from "@/context/TelemetryContext";
import { useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";

interface Article {
    id: string;
    category: string;
    title: string;
    subtitle?: string;
    image: string;
    status: 'draft' | 'published';
}

export default function Home() {
    const [searchQuery, setSearchQuery] = useState("");
    const [genre, setGenre] = useState<string | null>(null);
    const debouncedQuery = useDebounce(searchQuery, 500);
    const [showFilters, setShowFilters] = useState(false);
    const { trackEvent } = useTelemetry();
    const [articles, setArticles] = useState<Article[]>([]);

    // Fetch local editorial articles
    useEffect(() => {
        const q = query(
            collection(db, "editorial"),
            where("status", "==", "published"),
            orderBy("createdAt", "desc"),
            limit(3)
        );
        const unsub = onSnapshot(q, (snap: any) => {
            setArticles(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Article)));
        }, (error: any) => {
            console.error("Home Editorial listener error:", error);
        });
        return unsub;
    }, []);

    // Track search queries
    useEffect(() => {
        if (debouncedQuery.trim().length > 2) {
            trackEvent("search", { query: debouncedQuery, genre });
        }
    }, [debouncedQuery, genre]);

    const { data: results, isLoading } = useQuery({
        queryKey: ["releases", debouncedQuery, genre],
        queryFn: () => {
            if (debouncedQuery.trim()) {
                return discogsService.searchReleases(debouncedQuery, genre || undefined);
            }
            return discogsService.getTrending(genre || undefined);
        },
    });

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.05 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, scale: 0.9, y: 20 },
        show: { opacity: 1, scale: 1, y: 0 }
    };

    return (
        <div className="space-y-12">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative max-w-2xl mx-auto z-10"
            >
                <div className="absolute inset-0 bg-primary/20 blur-[100px] -z-10 rounded-full opacity-30" />
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                    className="pl-14 pr-16 bg-black/40 border-white/5 text-white placeholder:text-gray-500 h-16 text-xl rounded-2xl focus-visible:ring-primary backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all hover:bg-black/60 hover:border-white/10"
                    placeholder="Buscar vinilos, artistas, sellos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-colors ${showFilters || genre ? 'bg-primary text-black' : 'text-gray-400 hover:bg-white/5'}`}
                >
                    <SlidersHorizontal className="h-5 w-5" />
                </button>
            </motion.div>

            <AnimatePresence>
                {showFilters && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="bg-white/5 border border-white/5 rounded-3xl p-8 backdrop-blur-3xl mb-8 flex flex-wrap gap-4">
                            {["Electronic", "Jazz", "Rock", "Hip Hop", "Techno", "House", "Folk", "Latin"].map(g => (
                                <button
                                    key={g}
                                    onClick={() => setGenre(genre === g ? null : g)}
                                    className={`px-6 py-2 rounded-full border text-sm font-bold transition-all ${genre === g ? 'bg-primary border-primary text-black' : 'border-white/10 text-gray-500 hover:text-white hover:border-white/20'}`}
                                >
                                    {g}
                                </button>
                            ))}
                            <button
                                onClick={() => { setGenre(null); setShowFilters(false); }}
                                className="ml-auto p-2 text-gray-500 hover:text-white group"
                            >
                                <X className={`h-4 w-4 transition-transform ${genre ? 'rotate-90 text-primary' : ''}`} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <section>
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-display font-bold text-white tracking-tightest">
                            {searchQuery ? `Resultados para "${searchQuery}"` : genre ? `Lanzamientos de ${genre}` : "Nuevos Lanzamientos"}
                        </h2>
                        <p className="text-gray-500 mt-1 font-medium text-sm">Curado de la comunidad global de Discogs.</p>
                    </div>
                    {(searchQuery || genre) && (
                        <button
                            onClick={() => { setSearchQuery(""); setGenre(null); }}
                            className="text-[10px] text-gray-500 hover:text-primary transition-colors uppercase tracking-[0.2em] font-black border-b border-gray-800 hover:border-primary pb-1"
                        >
                            Reiniciar Búsqueda
                        </button>
                    )}
                </div>

                <AnimatePresence mode="wait">
                    {isLoading ? (
                        <motion.div
                            key="loader"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-8"
                        >
                            {Array.from({ length: 12 }).map((_, i) => (
                                <AlbumCardSkeleton key={i} />
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="grid"
                            variants={containerVariants}
                            initial="hidden"
                            animate="show"
                            className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-8"
                        >
                            {results?.map((album: DiscogsSearchResult) => (
                                <motion.div key={album.id} variants={itemVariants}>
                                    <Link to={`/album/${album.id}`} className="group block h-full">
                                        <Card className="bg-transparent border-0 shadow-none h-full transition-all duration-500 p-0">
                                            <CardContent className="p-0">
                                                <div className="aspect-[1/1] rounded-3xl overflow-hidden mb-4 relative bg-surface-dark shadow-[0_15px_30px_-5px_rgba(0,0,0,0.5)] ring-1 ring-white/5 group-hover:ring-primary/40 transition-all duration-700 bg-gradient-to-br from-white/5 to-white/[0.02]">
                                                    <img
                                                        src={album.cover_image || album.thumb}
                                                        alt={album.title}
                                                        className="w-full h-full object-cover group-hover:scale-110 group-hover:rotate-2 transition-transform duration-1000"
                                                        loading="lazy"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = "https://placehold.co/600x600/121212/FFFFFF?text=No+Cover";
                                                        }}
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 flex flex-col justify-end p-6">
                                                        <div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                                                            <Badge className="bg-primary text-black font-black text-[10px] uppercase mb-2">Detalles</Badge>
                                                            <span className="block text-white text-[10px] font-bold tracking-widest uppercase opacity-60">Ver Edición</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <h3 className="text-white font-bold text-sm md:text-base leading-tight truncate group-hover:text-primary transition-colors duration-300">{album.title}</h3>
                                                <p className="text-gray-500 text-[10px] md:text-xs mt-1.5 font-bold uppercase tracking-widest">{album.year || "N/A"}</p>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {!isLoading && (!results || results.length === 0) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-40 border-2 border-dashed border-white/5 rounded-[3rem] bg-white/[0.01]"
                    >
                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                            <Search className="h-8 w-8 text-gray-600" />
                        </div>
                        <p className="text-xl font-display font-medium text-gray-400">No se encontraron huellas sonoras.</p>
                        <button onClick={() => { setSearchQuery(""); setGenre(null); }} className="mt-4 text-primary font-bold hover:underline underline-offset-8 transition-all">Reiniciar parámetros de búsqueda</button>
                    </motion.div>
                )}
            </section>

            <section className="mt-24 pb-24 border-t border-white/5 pt-24">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-8">
                    <div>
                        <h2 className="text-4xl md:text-5xl font-display font-black text-white tracking-tightest leading-none">Editorial <span className="text-primary">Oldie but Goldie</span></h2>
                        <p className="text-gray-500 mt-4 text-lg font-medium max-w-xl">Narrativas profundas desde la intersección del sonido, el arte y los medios físicos.</p>
                    </div>
                    <Link to="/editorial">
                        <button className="text-[10px] text-gray-400 hover:text-primary transition-colors font-black uppercase tracking-[0.2em] border-b border-gray-800 hover:border-primary pb-2 self-start md:self-auto">Ver todas las historias</button>
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {articles.length > 0 ? (
                        articles.map((article, i) => (
                            <motion.div
                                key={article.id}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="group cursor-pointer"
                            >
                                <Link to={`/editorial/${article.id}`}>
                                    <div className="aspect-[16/10] rounded-[2.5rem] overflow-hidden mb-6 relative ring-1 ring-white/10 group-hover:ring-primary/40 transition-all duration-700">
                                        <img src={article.image} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
                                        <Badge className="absolute top-6 left-6 bg-white/10 backdrop-blur-md text-white border-white/10">{article.category}</Badge>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-primary transition-colors">{article.title}</h3>
                                    <p className="text-gray-500 font-medium leading-relaxed line-clamp-2">{article.subtitle}</p>
                                </Link>
                            </motion.div>
                        ))
                    ) : (
                        // Fallback elements if no articles found (or loading)
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="animate-pulse">
                                <div className="aspect-[16/10] rounded-[2.5rem] bg-white/5 mb-6" />
                                <div className="h-6 w-3/4 bg-white/5 rounded mb-4" />
                                <div className="h-4 w-full bg-white/5 rounded" />
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
}

function Badge({ children, className }: { children: ReactNode, className?: string }) {
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
            {children}
        </span>
    );
}
