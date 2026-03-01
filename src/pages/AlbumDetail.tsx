import { useParams, Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Heart, Library, PlayCircle, Store, ChevronRight, Share2, Globe, Music, Award } from "lucide-react";
import { discogsService } from "@/lib/discogs";
import { motion } from "framer-motion";
import { AlbumDetailSkeleton } from "@/components/ui/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useUserCollection } from "@/hooks/useUserCollection";
import { useTelemetry } from "@/context/TelemetryContext";
import { useEffect } from "react";
import { useLoading } from "@/context/LoadingContext";
import { LazyImage } from "@/components/ui/LazyImage";
import { inventoryService } from "@/services/inventoryService";
import { TEXTS } from "@/constants/texts";
import { useLote } from "@/context/LoteContext";
import { ShoppingBag, Check } from "lucide-react";

export default function AlbumDetail() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const { hasItem: isInCollection, toggleItem: toggleCollection } = useUserCollection("collection");
    const { hasItem: isInWantlist, toggleItem: toggleWantlist } = useUserCollection("wantlist");
    const { trackEvent } = useTelemetry();
    const { showLoading, hideLoading } = useLoading();
    const { addItemFromInventory, isInLote } = useLote();

    const { data: album, isLoading, error } = useQuery({
        queryKey: ["release", id],
        queryFn: async () => {
            if (!id) throw new Error("No ID");

            // 1. Check if it is a local UUID (Inventory Sovereign)
            if (id.includes('-') || id.length > 15) {
                const localItem = await inventoryService.getItemById(id);
                if (localItem) {
                    // Normalize to Discogs-like structure for the UI
                    return {
                        id: localItem.id,
                        title: localItem.metadata.title,
                        artists: [{ name: localItem.metadata.artist }],
                        images: [{ uri: localItem.media.full_res_image_url || localItem.media.thumbnail }],
                        thumb: localItem.media.thumbnail,
                        lowest_price: localItem.logistics.price,
                        year: localItem.metadata.year,
                        country: localItem.metadata.country,
                        genres: localItem.metadata.genres,
                        styles: localItem.metadata.styles,
                        labels: localItem.labels || [{ name: "Sovereign Asset", catno: "SA-001" }],
                        tracklist: localItem.tracklist || [],
                        notes: localItem.metadata.format_description,
                        isLocal: true,
                        isBatch: localItem.metadata.isBatch,
                        items: localItem.items || [],
                        uri: localItem.reference.originalDiscogsUrl,
                        stock: localItem.logistics.stock,
                        raw: localItem // Pass the raw object for Lote compatibility
                    };
                }
            }

            // 2. Fallback to Discogs API
            return discogsService.getReleaseDetails(id);
        },
        enabled: !!id,
    });

    useEffect(() => {
        if (album && id) {
            trackEvent("view_release", {
                releaseId: id,
                title: album.title,
                artist: album.artists?.[0]?.name
            });
        }
    }, [album, id]);

    if (isLoading) {
        return <AlbumDetailSkeleton />;
    }

    if (error || !album) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-40 bg-white/[0.02] rounded-[3rem] border border-dashed border-white/10"
            >
                <p className="text-red-400 font-bold mb-8 text-xl tracking-tight">{TEXTS.common.sonicConnectionLost}</p>
                <Link to="/">
                    <Button variant="outline" className="rounded-full px-10 h-14 font-bold border-white/20 hover:bg-white hover:text-black">{TEXTS.common.backToDiscovery}</Button>
                </Link>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen relative"
        >
            <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-primary/5 blur-[150px] -z-10 animate-pulse" />

            <nav className="flex mb-16 text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">
                <ol className="flex items-center space-x-4">
                    <li><Link to="/" className="hover:text-primary transition-colors">{TEXTS.navigation.brand}</Link></li>
                    <li><ChevronRight className="h-3 w-3 text-gray-800" /></li>
                    <li className="text-gray-400">{album.artists?.[0]?.name || "Artista"}</li>
                    <li><ChevronRight className="h-3 w-3 text-gray-800" /></li>
                    <li className="text-primary truncate max-w-[200px]">{album.title}</li>
                </ol>
            </nav>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-20">
                {/* Left Column: Cover & Actions */}
                <div className="lg:col-span-5 space-y-12">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, rotateY: 20 }}
                        animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                        transition={{ type: "spring", damping: 12, stiffness: 100 }}
                        className="relative group aspect-square rounded-[3rem] overflow-hidden border border-white/10 bg-black shadow-[0_80px_150px_-30px_rgba(0,0,0,0.8)] perspective-1000"
                    >
                        <LazyImage
                            src={album.images?.[0]?.uri || album.thumb}
                            alt={album.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 ease-out"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = "https://placehold.co/800x800/121212/FFFFFF?text=No+Cover";
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-transparent to-primary/5 pointer-events-none" />
                        <div className="absolute inset-0 ring-1 ring-inset ring-white/20 rounded-[3rem] pointer-events-none" />
                    </motion.div>

                    <div className="flex flex-col gap-6">
                        <div className="grid grid-cols-2 gap-4">
                            <Button
                                onClick={async () => {
                                    if (!user) return alert(TEXTS.common.syncToCollect);
                                    const isAdding = !isInCollection(album.id.toString());
                                    showLoading(isAdding ? TEXTS.common.archivingCollection : TEXTS.common.removingCollection);
                                    try {
                                        await toggleCollection(album.id.toString(), { title: album.title, cover_image: album.images?.[0]?.uri || album.thumb });
                                    } finally {
                                        hideLoading();
                                    }
                                }}
                                className={`h-20 text-lg font-black transition-all transform hover:-translate-y-2 rounded-2xl shadow-xl select-none overflow-hidden relative group ${isInCollection(album.id.toString())
                                    ? "bg-white text-black border-2 border-primary"
                                    : "bg-primary text-black hover:bg-white shadow-primary/10"
                                    }`}
                            >
                                <Library className={`mr-3 h-6 w-6 relative z-10 ${isInCollection(album.id.toString()) ? "text-primary" : ""}`} />
                                <span className="relative z-10">{isInCollection(album.id.toString()) ? TEXTS.common.archived : TEXTS.common.collect}</span>
                            </Button>
                            <Button
                                onClick={async () => {
                                    if (!user) return alert(TEXTS.common.syncToWantlist);
                                    const isAdding = !isInWantlist(album.id.toString());
                                    showLoading(isAdding ? TEXTS.common.searchingFavorites : TEXTS.common.removingFavorites);
                                    try {
                                        await toggleWantlist(album.id.toString(), { title: album.title, cover_image: album.images?.[0]?.uri || album.thumb });
                                    } finally {
                                        hideLoading();
                                    }
                                }}
                                variant="outline"
                                className={`h-20 text-lg font-black transition-all transform hover:-translate-y-2 rounded-2xl bg-black/40 shadow-xl select-none group ${isInWantlist(album.id.toString())
                                    ? "border-secondary text-secondary bg-secondary/10"
                                    : "text-secondary border-secondary/20 hover:bg-secondary/10 hover:border-secondary"
                                    }`}
                            >
                                <Heart className={`mr-3 h-6 w-6 ${isInWantlist(album.id.toString()) ? "fill-secondary text-secondary" : ""}`} />
                                {isInWantlist(album.id.toString()) ? TEXTS.common.target : TEXTS.common.favorites}
                            </Button>
                        </div>

                        {album.isLocal && (
                            <Button
                                onClick={() => {
                                    if (album.stock > 0) {
                                        addItemFromInventory(album.raw);
                                    }
                                }}
                                disabled={album.stock <= 0 || isInLote(album.id)}
                                className={`h-24 text-xl font-black transition-all transform hover:-translate-y-2 rounded-2xl shadow-2xl select-none overflow-hidden relative group ${isInLote(album.id)
                                    ? "bg-green-500/20 text-green-400 border-2 border-green-500/50"
                                    : "bg-gradient-to-r from-primary to-secondary text-black hover:scale-[1.02]"
                                    }`}
                            >
                                {isInLote(album.id) ? (
                                    <>
                                        <Check className="mr-3 h-7 w-7" />
                                        EN EL LOTE
                                    </>
                                ) : (
                                    <>
                                        <ShoppingBag className="mr-3 h-7 w-7" />
                                        {album.stock > 0 ? "¡COMPRAR AHORA!" : "AGOTADO"}
                                    </>
                                )}
                            </Button>
                        )}

                        <Button variant="ghost" className="h-14 text-gray-500 hover:text-white hover:bg-white/5 rounded-2xl font-black uppercase tracking-[0.15em] text-[11px] border border-white/5 transition-all">
                            <Share2 className="mr-3 h-5 w-5" /> {TEXTS.common.transmissionLink}
                        </Button>
                    </div>

                    <motion.div
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="bg-gradient-to-br from-white/[0.04] to-transparent backdrop-blur-3xl border border-white/[0.06] p-10 rounded-[3rem] relative overflow-hidden group shadow-2xl"
                    >
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 blur-[80px] rounded-full group-hover:bg-primary/20 transition-colors duration-1000" />
                        <div className="flex items-center justify-between mb-10">
                            <h3 className="text-2xl font-display font-bold text-white flex items-center gap-4">
                                <Store className="h-7 w-7 text-primary" /> {TEXTS.common.marketLogic}
                            </h3>
                            <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/20 rounded-lg font-mono text-[10px] font-black px-3 py-1.5 tracking-tighter">APP_ESTABLE_V1</Badge>
                        </div>
                        <div className="space-y-8 font-mono">
                            <div className="flex justify-between items-end border-b border-white/[0.04] pb-6">
                                <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">{TEXTS.common.basePrice}</span>
                                <span className="text-3xl font-black text-white tracking-widest">
                                    {album.lowest_price ? `$${album.lowest_price.toFixed(2)}` : "—"}
                                </span>
                            </div>
                            <div className="flex justify-between items-end border-b border-white/[0.04] pb-6">
                                <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">{TEXTS.common.resonance}</span>
                                <div className="flex flex-col items-end">
                                    <span className="text-3xl font-black text-primary tracking-widest">
                                        {album.community?.rating?.average?.toFixed(1) || "5.0"}
                                    </span>
                                    <span className="text-[9px] text-gray-700 uppercase font-black mt-1">{album.community?.rating?.count || 0} {TEXTS.common.communityVotes}</span>
                                </div>
                            </div>
                        </div>
                        <a href={album.uri} target="_blank" rel="noopener noreferrer" className="block w-full">
                            <Button className="w-full mt-10 bg-black/40 border border-white/10 text-white hover:bg-white hover:text-black transition-all rounded-[1.25rem] py-8 font-black uppercase tracking-widest text-[11px] h-16">
                                {TEXTS.common.analyzeOnDiscogs}
                            </Button>
                        </a>
                    </motion.div>
                </div>

                {/* Right Column: Details & Tracklist */}
                <div className="lg:col-span-7 space-y-16">
                    <motion.div
                        initial={{ x: 30, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div className="flex flex-wrap items-center gap-4 mb-8">
                            <div className="flex items-center gap-2 bg-secondary/10 px-5 py-2 rounded-full border border-secondary/20">
                                <Music className="h-3.5 w-3.5 text-secondary" />
                                <span className="text-[10px] font-black text-secondary uppercase tracking-[0.1em]">{album.formats?.[0]?.name || TEXTS.common.lp}</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white/5 px-5 py-2 rounded-full border border-white/10">
                                <Globe className="h-3.5 w-3.5 text-gray-500" />
                                <span className="text-[10px] font-black text-gray-400 uppercase">{album.released_formatted || album.year}</span>
                            </div>
                            {album.community?.have > 1000 && (
                                <div className="flex items-center gap-2 bg-primary/10 px-5 py-2 rounded-full border border-primary/20">
                                    <Award className="h-3.5 w-3.5 text-primary" />
                                    <span className="text-[10px] font-black text-primary uppercase">{TEXTS.common.eliteFavorite}</span>
                                </div>
                            )}
                        </div>
                        <h1 className="text-6xl md:text-9xl font-display font-bold text-white mb-6 leading-[0.8] tracking-tightest drop-shadow-2xl">
                            {album.title}
                        </h1>
                        <h2 className="text-3xl md:text-5xl text-gray-500 font-medium mb-12 tracking-tightest">{album.artists?.[0]?.name}</h2>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 p-10 bg-white/[0.02] rounded-[3rem] border border-white/[0.04] backdrop-blur-2xl">
                            {[
                                { label: TEXTS.common.label, value: album.labels?.[0]?.name },
                                { label: TEXTS.common.catNo, value: album.labels?.[0]?.catno },
                                { label: TEXTS.common.genre, value: album.genres?.[0] },
                                { label: TEXTS.common.country, value: album.country },
                            ].map((item) => (
                                <div key={item.label}>
                                    <span className="block text-[10px] text-gray-600 uppercase font-black tracking-[0.2em] mb-3">{item.label}</span>
                                    <span className="block text-white font-bold truncate text-sm">{item.value || "—"}</span>
                                </div>
                            ))}
                        </div>

                        {album.notes && (
                            <div className="mt-16 relative">
                                <div className="absolute -left-8 top-2 bottom-2 w-[2px] bg-gradient-to-b from-primary via-primary/50 to-transparent rounded-full" />
                                <p className="text-gray-400 leading-relaxed italic text-xl font-medium tracking-tight">
                                    "{album.notes && album.notes.length > 600 ? album.notes.substring(0, 600) + "..." : (album.notes || "")}"
                                </p>
                            </div>
                        )}
                    </motion.div>

                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.5 }}
                    >
                        {album.isBatch ? (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between mb-10 border-b border-white/[0.05] pb-6">
                                    <h3 className="text-4xl font-display font-bold text-white tracking-tightest">Contenido del Lote</h3>
                                    <span className="font-mono text-[11px] text-gray-700 uppercase font-black tracking-widest bg-white/5 px-4 py-2 rounded-xl">{album.items?.length || 0} DISCOS</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {album.items?.map((item: any, index: number) => (
                                        <motion.div
                                            key={index}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            className="group relative bg-white/[0.03] border border-white/10 rounded-2xl p-5 hover:bg-white/[0.06] transition-all"
                                        >
                                            <div className="flex gap-4">
                                                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-black border border-white/10">
                                                    <img src={item.thumb || item.cover_image} alt={item.title} className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-white font-bold truncate leading-tight group-hover:text-primary transition-colors">{item.title}</h4>
                                                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mt-1 truncate">{item.artist}</p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className="text-[8px] font-black text-gray-400 border border-white/10 px-2 py-0.5 rounded uppercase">{item.format || "Vinyl"}</span>
                                                        <span className="text-[8px] font-black text-secondary border border-secondary/20 px-2 py-0.5 rounded uppercase">{item.condition || "N/A"}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between mb-10 border-b border-white/[0.05] pb-6">
                                    <h3 className="text-4xl font-display font-bold text-white tracking-tightest">{TEXTS.common.tracklist}</h3>
                                    <span className="font-mono text-[11px] text-gray-700 uppercase font-black tracking-widest bg-white/5 px-4 py-2 rounded-xl">{album.tracklist?.length || 0} {TEXTS.common.totalTracks}</span>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    {album.tracklist?.map((track: any, index: number) => (
                                        <motion.div
                                            key={index}
                                            whileHover={{ x: 15, backgroundColor: "rgba(255,255,255,0.03)" }}
                                            className="group flex items-center p-6 rounded-3xl transition-all cursor-pointer border border-transparent hover:border-white/5 group shadow-sm"
                                        >
                                            <span className="w-12 text-gray-800 font-mono text-xs group-hover:text-primary transition-colors font-black tracking-tighter">{track.position || index + 1}</span>
                                            <div className="flex-grow">
                                                <div className="text-white font-bold text-lg tracking-tight group-hover:text-white transition-colors">{track.title}</div>
                                            </div>
                                            <span className="text-gray-700 font-mono text-[11px] mr-10 group-hover:text-gray-400 transition-colors">{track.duration || "--:--"}</span>
                                            <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-all duration-500 scale-90 group-hover:scale-100">
                                                <PlayCircle className="text-primary h-12 w-12 hover:rotate-12 transition-all drop-shadow-[0_0_15px_rgba(223,255,0,0.3)]" />
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>

                    <Separator className="bg-white/[0.04] my-20" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pb-32">
                        <div className="bg-gradient-to-tr from-white/[0.02] to-transparent p-10 rounded-[3rem] border border-white/[0.04]">
                            <h4 className="text-gray-600 font-black mb-10 uppercase tracking-[0.25em] text-[10px]">{TEXTS.common.sonicSpectrum}</h4>
                            <div className="flex flex-wrap gap-3">
                                {album.styles?.map((style: string) => (
                                    <Badge key={style} variant="outline" className="text-gray-300 border-white/10 bg-black/40 font-black text-[10px] px-5 py-2.5 rounded-xl uppercase tracking-widest hover:border-primary/50 transition-colors">{style}</Badge>
                                ))}
                            </div>
                        </div>
                        <div className="bg-gradient-to-tr from-white/[0.02] to-transparent p-10 rounded-[3rem] border border-white/[0.04]">
                            <h4 className="text-gray-600 font-black mb-10 uppercase tracking-[0.25em] text-[10px]">{TEXTS.common.ownershipData}</h4>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="flex flex-col">
                                    <span className="text-5xl font-black text-white tracking-widest">{album.community?.have || 0}</span>
                                    <span className="text-[10px] uppercase font-black tracking-[0.15em] text-gray-500 mt-3">{TEXTS.common.collectors}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-5xl font-black text-secondary tracking-widest">{album.community?.want || 0}</span>
                                    <span className="text-[10px] uppercase font-black tracking-[0.15em] text-gray-500 mt-3">{TEXTS.common.wanted}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
