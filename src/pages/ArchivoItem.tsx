import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Disc, Calendar, MapPin, Tag, Square, Zap, Layers, PlayCircle, Music, FileText, ChevronRight, Hash, Download, QrCode, Share2 } from "lucide-react";
import { archivoService, type UnifiedItem } from "@/services/archivoService";
import { LazyImage } from "@/components/ui/LazyImage";
import { SEO } from "@/components/SEO";
import { useLoading } from "@/context/LoadingContext";
import { QRCodeCanvas } from "qrcode.react";
import { siteConfigService, type SiteConfig } from "@/services/siteConfigService";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useLote } from "@/context/LoteContext";

export default function ArchivoItem() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showLoading, hideLoading } = useLoading();
    const { addItemFromInventory } = useLote();
    const [item, setItem] = useState<UnifiedItem | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
    const [isVideoAvailable, setIsVideoAvailable] = useState(true);
    const [showToast, setShowToast] = useState(false);

    // Track Intent Logic (V12.7)
    const trackIntent = async (type: string) => {
        if (!item) return;
        try {
            await addDoc(collection(db, "analytics_intents"), {
                item_id: item.id,
                action: type,
                timestamp: serverTimestamp(),
                source: 'archivo_detail'
            });
        } catch (e) {
            console.warn("Analytics: Failed to track intent", e);
        }
    };

    // V18.3 WATCHDOG: Si YouTube no responde, activamos el fallback
    useEffect(() => {
        const handleVideoError = (e: any) => {
            if (e.detail === id) {
                console.warn("[Watchdog] Señal de error recibida para:", id);
                setIsVideoAvailable(false);
            }
        };
        window.addEventListener('youtube-error', handleVideoError);

        if (item?.youtube_id && isVideoAvailable) {
            const timer = setTimeout(() => {
                if (isVideoAvailable) {
                    console.warn("[Watchdog] Timeout de 4s: Video no inició. Activando Spotify...");
                    setIsVideoAvailable(false);
                }
            }, 4000);
            return () => {
                window.removeEventListener('youtube-error', handleVideoError);
                clearTimeout(timer);
            };
        }
        return () => window.removeEventListener('youtube-error', handleVideoError);
    }, [id, item?.youtube_id, isVideoAvailable]);

    useEffect(() => {
        if (!id) return;
        siteConfigService.getConfig().then(setSiteConfig);

        async function load() {
            const cacheKey = `obg_archivo_cache_item_${id}`;
            const cached = localStorage.getItem(cacheKey);

            if (!cached) {
                showLoading("Localizando pieza...");
            } else {
                try {
                    setItem(JSON.parse(cached));
                } catch (e) { }
            }

            try {
                const data = await archivoService.getItemById(id!);
                if (data) {
                    setItem(data);
                } else {
                    setNotFound(true);
                }
            } catch (error) {
                console.error("Error loading item:", error);
                setNotFound(true);
            } finally {
                hideLoading();
            }
        }
        load();
    }, [id]);

    if (notFound) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
                <h1 className="text-4xl font-display font-black text-white uppercase mb-4">Disco no encontrado</h1>
                <Link to="/archivo" className="text-primary font-mono text-sm uppercase tracking-widest hover:underline">
                    Volver al Archivo
                </Link>
            </div>
        );
    }

    if (!item) return null;
 
    const shareTitle = item.isBatch ? "Lote: " + item.title : item.artist + " - " + item.title;
    const shareDescription = item.isBatch 
        ? `Lote de colección con ${item.items?.length || 0} discos. Disponible en Oldie But Goldie.`
        : `Formato: ${item.format} | Año: ${item.year}. Disponible en Oldie But Goldie.`;
    
    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: shareTitle,
                    text: "Mirá esta joya en Oldie But Goldie 💿✨",
                    url: window.location.href
                });
                trackIntent('share_native');
            } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                    console.error("Error sharing:", err);
                }
            }
        } else {
            try {
                await navigator.clipboard.writeText(window.location.href);
                trackIntent('share_clipboard');
                setShowToast(true);
                setTimeout(() => setShowToast(false), 3000);
            } catch (err) {
                console.error("Error copying to clipboard:", err);
            }
        }
    };

    const absoluteUrl = `${window.location.origin}${window.location.pathname}`;

    return (
        <div className="min-h-screen bg-black pt-28 pb-20 px-6">
            <SEO
                title={`${shareTitle} | Archivo Sonoro Oldie But Goldie`}
                description={shareDescription}
                image={item.full_res_image || item.image}
                url={absoluteUrl}
                type="product"
            />

            <script type="application/ld+json">
                {JSON.stringify({
                    "@context": "https://schema.org/",
                    "@type": "Product",
                    "name": `${item.artist} - ${item.title}`,
                    "image": item.image,
                    "description": `Pieza de colección: ${item.title} por ${item.artist}. Disponible en el archivo de Oldie But Goldie.`,
                    "brand": { "@type": "Brand", "name": "Oldie But Goldie" },
                    "offers": {
                        "@type": "Offer",
                        "url": absoluteUrl,
                        "priceCurrency": "ARS",
                        "price": item.price || item.valuation || 0,
                        "itemCondition": "https://schema.org/UsedCondition",
                        "availability": item.source === 'inventory' ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
                    }
                })}
            </script>

            <div className="max-w-6xl mx-auto">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors font-mono text-[10px] uppercase tracking-widest mb-12"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Regresar
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="lg:col-span-12 xl:col-span-5 lg:sticky lg:top-32 space-y-8"
                    >
                        <div className="group relative aspect-square rounded-[2.5rem] overflow-hidden border border-white/10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)] bg-zinc-900">
                            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 z-10 pointer-events-none"></div>
                            <LazyImage
                                src={item.image}
                                alt={item.title}
                                className="w-full h-full object-cover relative z-10 group-hover:scale-110 transition-transform duration-[1500ms] ease-out"
                            />
                            {item.format?.toLowerCase().includes("vinyl") && (
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/vinyl.png')] opacity-20 group-hover:opacity-40 transition-opacity duration-700 z-20 pointer-events-none mix-blend-overlay"></div>
                            )}
                        </div>

                        {!item.isBatch && (item.youtube_id || item.spotify_id) && (
                            <div className="w-full rounded-3xl overflow-hidden border border-white/5 shadow-2xl bg-zinc-900/40 backdrop-blur-xl group">
                                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-950/50">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            <PlayCircle className="w-4 h-4 text-primary animate-pulse" />
                                        </div>
                                        <span className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-300">
                                            {item.spotify_id ? "Spotify Sync Active" : (item.youtube_id && isVideoAvailable ? "Sovereign Audio Stream" : "Audio Not Available")}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        <div className="w-1 h-3 bg-primary/40 rounded-full animate-[bounce_1s_infinite_100ms]"></div>
                                        <div className="w-1 h-3 bg-primary/40 rounded-full animate-[bounce_1s_infinite_300ms]"></div>
                                        <div className="w-1 h-3 bg-primary/40 rounded-full animate-[bounce_1s_infinite_500ms]"></div>
                                    </div>
                                </div>
                                <div className="relative w-full overflow-hidden">
                                    {item.spotify_id ? (
                                        <div className="h-[152px] w-full">
                                            <iframe
                                                src={`https://open.spotify.com/embed/album/${item.spotify_id}?utm_source=generator&theme=0`}
                                                width="100%"
                                                height="152"
                                                frameBorder="0"
                                                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                                loading="lazy"
                                                className="grayscale-0"
                                            ></iframe>
                                        </div>
                                    ) : (
                                        item.youtube_id && isVideoAvailable && (
                                            <div className="aspect-video w-full">
                                                <iframe
                                                    id="youtube-player"
                                                    width="100%"
                                                    height="100%"
                                                    src={`https://www.youtube.com/embed/${item.youtube_id}?autoplay=1&rel=0&modestbranding=1&theme=dark&enablejsapi=1`}
                                                    title="OBG Stream Engine"
                                                    frameBorder="0"
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    allowFullScreen
                                                    loading="lazy"
                                                    className="absolute top-0 left-0 w-full h-full grayscale-[0.2] group-hover:grayscale-0"
                                                ></iframe>
                                                <script dangerouslySetInnerHTML={{
                                                    __html: `
                                                    window.onYouTubeIframeAPIReady = function() {
                                                        let isPlaying = false;
                                                        new YT.Player('youtube-player', {
                                                            events: {
                                                                'onStateChange': function(event) {
                                                                    if (event.data === 1) isPlaying = true;
                                                                },
                                                                'onReady': function(event) {
                                                                    event.target.playVideo();
                                                                    setTimeout(() => {
                                                                        if (!isPlaying && event.target.getPlayerState() !== 1) {
                                                                            window.dispatchEvent(new CustomEvent('youtube-error', { detail: '${item.id}' }));
                                                                        }
                                                                    }, 3000);
                                                                },
                                                                'onError': function() {
                                                                    window.dispatchEvent(new CustomEvent('youtube-error', { detail: '${item.id}' }));
                                                                }
                                                            }
                                                        });
                                                    };
                                                    if (!window.YT) {
                                                        const tag = document.createElement('script');
                                                        tag.src = "https://www.youtube.com/iframe_api";
                                                        const firstScriptTag = document.getElementsByTagName('script')[0];
                                                        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
                                                    } else if (window.YT && window.YT.Player) {
                                                        window.onYouTubeIframeAPIReady();
                                                    }
                                                    `
                                                }} />
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="lg:col-span-12 xl:col-span-4 flex flex-col pt-2 lg:pt-0"
                    >
                        <div className="mb-12">
                            <div className="flex flex-wrap items-center gap-3 mb-8">
                                <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.25em] border shadow-2xl backdrop-blur-md transition-all ${item.source === 'inventory' ? 'bg-primary text-black border-primary shadow-primary/20' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                                    {item.source === 'inventory' ? 'STOCK DISPONIBLE' : 'ARCHIVADO'}
                                </span>
                                {item.isBatch && (
                                    <span className="px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.25em] border border-primary/50 bg-primary/10 text-primary shadow-2xl backdrop-blur-md">
                                        🏷️ Lote Especial: {item.items?.length || 0} Unidades
                                    </span>
                                )}
                                {!item.isBatch && item.wants && item.have && (
                                    <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.25em] border shadow-2xl backdrop-blur-md ${(item.wants / item.have) > 5 ? 'bg-red-500/20 border-red-500/30 text-red-500' : (item.wants / item.have) > 2 ? 'bg-amber-500/20 border-amber-500/30 text-amber-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                                        {(item.wants / item.have) > 5 ? 'GRIAL' : (item.wants / item.have) > 2 ? 'MUY RARO' : 'CATÁLOGO'}
                                    </span>
                                )}
                                <button
                                    onClick={handleShare}
                                    className="flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.25em] bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 hover:bg-white/10 transition-all shadow-xl backdrop-blur-md group"
                                >
                                    <Share2 className="w-3 h-3 group-hover:scale-110 transition-transform" />
                                    <span>Compartir</span>
                                </button>
                            </div>
                            <h1 className="text-5xl lg:text-7xl font-display font-black text-white uppercase tracking-tightest mb-4 leading-[0.85]">
                                {item.title}
                            </h1>
                            <div className="flex items-center gap-4">
                                <div className="h-px w-12 bg-primary"></div>
                                <p className="text-2xl text-primary font-display uppercase tracking-widest italic">{item.artist}</p>
                            </div>
                        </div>

                        {!item.isBatch && (
                            <div className="grid grid-cols-2 gap-4 mb-10">
                                {[
                                    { label: "Prensado", val: item.year || "N/A" },
                                    { label: "Wants", val: item.wants || "0" },
                                    { label: "Key", val: item.key || "—", accent: true },
                                    { label: "BPM", val: item.bpm || "—", accent: true },
                                ].map((meta, idx) => (
                                    <div key={idx} className="p-5 rounded-[2rem] bg-zinc-900/40 border border-white/5 group hover:border-primary/30 transition-all">
                                        <p className="text-zinc-500 text-[9px] uppercase tracking-[0.3em] font-black mb-2">{meta.label}</p>
                                        <p className={`font-mono text-xl font-bold ${meta.accent ? 'text-primary' : 'text-white'}`}>{meta.val}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!item.isBatch && item.tracklist && item.tracklist.length > 0 && (
                            <div className="mb-10">
                                <div className="flex items-center gap-2 mb-4">
                                    <Music className="w-5 h-5 text-gray-500" />
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-white">Tracklist</h3>
                                </div>
                                <div className="space-y-1">
                                    {item.tracklist.map((track, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-white/10 group">
                                            <div className="flex items-center gap-4">
                                                <span className="font-mono text-[10px] text-zinc-500 group-hover:text-primary transition-colors min-w-[30px]">{track.position}</span>
                                                <span className="text-sm text-zinc-300 group-hover:text-white transition-colors line-clamp-1">{track.title}</span>
                                            </div>
                                            <span className="font-mono text-xs text-zinc-500">{track.duration}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {item.isBatch && item.items && item.items.length > 0 && (
                            <div className="mb-10 space-y-8">
                                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                                    <Layers className="w-5 h-5 text-primary" />
                                    <h3 className="text-xl font-black uppercase tracking-tighter text-white">Discos incluidos en este lote</h3>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {item.items.map((sub, i) => (
                                        <motion.div
                                            key={i}
                                            whileHover={{ y: -5 }}
                                            className="bg-zinc-900/40 border border-white/5 rounded-2xl overflow-hidden group hover:border-primary/20 transition-all"
                                        >
                                            <div className="aspect-square bg-zinc-800">
                                                <LazyImage
                                                    src={sub.thumb || sub.image}
                                                    alt={sub.title}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                                />
                                            </div>
                                            <div className="p-3 space-y-1">
                                                <p className="text-[10px] font-black text-white uppercase truncate tracking-tight">{sub.title}</p>
                                                <p className="text-[8px] font-bold text-primary uppercase truncate tracking-widest">{sub.artist}</p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {item.notes && (
                            <div className="mb-10 p-6 rounded-3xl bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 shadow-2xl relative overflow-hidden">
                                <FileText className="absolute top-4 right-4 w-32 h-32 text-zinc-800 opacity-20 rotate-12 pointer-events-none" />
                                <div className="relative z-10">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-4">Crónica del Curador</h3>
                                    <div className="prose prose-invert prose-sm max-w-none">
                                        <div style={{ whiteSpace: 'pre-line' }}>{item.notes}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="md:col-span-1 lg:col-span-4"
                    >
                        <div className="p-6 rounded-3xl bg-zinc-900 border border-white/10 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                            <div className="relative z-10">
                                <h3 className="text-xl font-display font-black uppercase tracking-tight text-white mb-2">Adquisición Segura</h3>
                                <p className="text-xs text-zinc-400 mb-8 leading-relaxed">
                                    {item.source === 'inventory' ? "Pieza certificada por nuestro equipo técnico y lista para entrega inmediata." : "Pieza comunitaria. Solicita un intercambio (trade) ofreciendo crédito o discos de valor."}
                                </p>
                                <div className="space-y-4">
                                    {item.source === 'inventory' ? (
                                        <button
                                            onClick={() => { trackIntent('add_to_cart'); addItemFromInventory(item); }}
                                            className="group flex flex-col items-center justify-center w-full px-8 py-5 bg-primary text-black rounded-2xl hover:scale-[1.02] transition-all"
                                        >
                                            <span className="font-black uppercase text-sm tracking-widest mb-1 flex items-center gap-2">
                                                Agregar a Base <Zap className="w-4 h-4 fill-black group-hover:scale-110 transition-transform" />
                                            </span>
                                            <span className="text-[10px] opacity-70 font-mono font-bold">DISPONIBILIDAD INMEDIATA</span>
                                        </button>
                                    ) : (
                                        <Link
                                            to="/trade/new"
                                            state={{ requestedItem: item }}
                                            onClick={() => trackIntent('init_trade')}
                                            className="group flex flex-col items-center justify-center w-full px-8 py-5 bg-white text-black rounded-2xl hover:scale-[1.02] transition-all"
                                        >
                                            <span className="font-black uppercase text-sm tracking-widest mb-1 flex items-center gap-2">
                                                Iniciar Intercambio <Layers className="w-4 h-4 fill-black" />
                                            </span>
                                            <span className="text-[10px] opacity-70 font-mono font-bold">VERIFICACIÓN GARANTIZADA</span>
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 p-8 rounded-[3rem] bg-zinc-950 border border-white/5 shadow-2xl relative overflow-hidden flex flex-col items-center">
                            <h3 className="text-2xl font-display font-black uppercase tracking-tightest text-white mb-2 italic">
                                Pasaporte <span className="text-primary italic">Cultural</span>
                            </h3>
                            <div className="bg-white p-6 rounded-[2rem] mb-8 group cursor-pointer">
                                <QRCodeCanvas
                                    id="obg-qr-code"
                                    value={absoluteUrl}
                                    size={200}
                                    level={"H"}
                                    imageSettings={{
                                        src: siteConfig?.favicon?.url || "/favicon.svg",
                                        height: 48,
                                        width: 48,
                                        excavate: true,
                                    }}
                                />
                            </div>
                            <button
                                onClick={() => {
                                    trackIntent('download_qr');
                                    const canvas = document.getElementById("obg-qr-code") as HTMLCanvasElement;
                                    if (canvas) {
                                        const pngUrl = canvas.toDataURL("image/png");
                                        let downloadLink = document.createElement("a");
                                        downloadLink.href = pngUrl;
                                        downloadLink.download = `OBG-${item.artist}-${item.title}.png`.replace(/\s+/g, '_');
                                        downloadLink.click();
                                    }
                                }}
                                className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-white text-black rounded-2xl hover:bg-primary transition-all font-black uppercase text-xs tracking-widest group"
                            >
                                <Download className="w-5 h-5" />
                                Exportar Pasaporte PNG
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Native Feedback Toast (V22.0) */}
            <AnimatePresence>
                {showToast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] bg-white text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-[0_20px_50px_rgba(255,255,255,0.2)]"
                    >
                        Enlace copiado al portapapeles 💿✨
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}