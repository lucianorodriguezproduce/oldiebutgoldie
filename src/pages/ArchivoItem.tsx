import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Disc, Calendar, MapPin, Tag, Square, Zap, Layers, PlayCircle, Music, FileText, ChevronRight, Hash, Download, QrCode } from "lucide-react";
import { archivoService, type UnifiedItem } from "@/services/archivoService";
import { LazyImage } from "@/components/ui/LazyImage";
import { SEO } from "@/components/SEO";
import { useLoading } from "@/context/LoadingContext";
import { QRCodeCanvas } from "qrcode.react";
import { siteConfigService, type SiteConfig } from "@/services/siteConfigService";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function ArchivoItem() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showLoading, hideLoading } = useLoading();
    const [item, setItem] = useState<UnifiedItem | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);

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

    useEffect(() => {
        if (!id) return;

        // Fetch Site Config for Branding Sync
        siteConfigService.getConfig().then(setSiteConfig);

        async function load() {
            // Instant SWR check to avoid flickering showLoading (V12.7)
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

    const absoluteUrl = `${window.location.origin}${window.location.pathname}`;

    return (
        <div className="min-h-screen bg-black pt-28 pb-20 px-6">
            <SEO
                title={`${item.artist} - ${item.title} | Archivo Sonoro Oldie But Goldie`}
                description={`Explorá ${item.title} de ${item.artist} en nuestro archivo cultural. Formato: ${item.format}. Estado: ${item.condition}.`}
                image={item.image}
                url={absoluteUrl} // Canonical URL forced here (V12.7)
            />

            {/* JSON-LD Product Schema */}
            <script type="application/ld+json">
                {JSON.stringify({
                    "@context": "https://schema.org/",
                    "@type": "Product",
                    "name": `${item.artist} - ${item.title}`,
                    "image": item.image,
                    "description": `Pieza de colección: ${item.title} por ${item.artist}. Disponible en el archivo de Oldie But Goldie.`,
                    "brand": {
                        "@type": "Brand",
                        "name": "Oldie But Goldie"
                    },
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

                    {/* Media Sidebar - Sticky */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="lg:col-span-12 xl:col-span-5 lg:sticky lg:top-32 space-y-8"
                    >
                        {/* Cover Art - Luxury Depth (V14.1) */}
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

                        {/* Unified Audio Engine (V14.1) */}
                        {(item.youtube_id || item.spotify_id) && (
                            <div className="w-full rounded-3xl overflow-hidden border border-white/5 shadow-2xl bg-zinc-900/40 backdrop-blur-xl group">
                                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-950/50">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            <PlayCircle className="w-4 h-4 text-primary animate-pulse" />
                                        </div>
                                        <span className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-300">
                                            {item.youtube_id ? "Sovereign Audio Stream" : "Spotify Sync Active"}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        <div className="w-1 h-3 bg-primary/40 rounded-full animate-[bounce_1s_infinite_100ms]"></div>
                                        <div className="w-1 h-3 bg-primary/40 rounded-full animate-[bounce_1s_infinite_300ms]"></div>
                                        <div className="w-1 h-3 bg-primary/40 rounded-full animate-[bounce_1s_infinite_500ms]"></div>
                                    </div>
                                </div>
                                <div className="relative w-full overflow-hidden">
                                    {item.youtube_id ? (
                                        <div className="aspect-video w-full">
                                            <iframe
                                                width="100%"
                                                height="100%"
                                                src={`https://www.youtube.com/embed/${item.youtube_id}?autoplay=0&rel=0&modestbranding=1&theme=dark`}
                                                title="OBG Stream Engine"
                                                frameBorder="0"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                                loading="lazy"
                                                className="absolute top-0 left-0 w-full h-full transition-filter duration-700 grayscale-[0.2] group-hover:grayscale-0"
                                            ></iframe>
                                        </div>
                                    ) : (
                                        <div className="h-[152px] w-full">
                                            <iframe
                                                src={`https://open.spotify.com/embed/album/${item.spotify_id}?utm_source=generator&theme=0`}
                                                width="100%"
                                                height="152"
                                                frameBorder="0"
                                                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                                loading="lazy"
                                                className="grayscale-0 group-hover:grayscale-0 transition-all"
                                            ></iframe>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>

                    {/* Main Content Area */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="lg:col-span-12 xl:col-span-4 flex flex-col pt-2 lg:pt-0"
                    >
                        {/* Header Minimal - High Fashion Style (V14.1) */}
                        <div className="mb-12">
                            <div className="flex flex-wrap items-center gap-3 mb-8">
                                <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.25em] border shadow-2xl backdrop-blur-md transition-all ${item.source === 'inventory'
                                    ? 'bg-primary text-black border-primary shadow-primary/20'
                                    : 'bg-white/5 border-white/10 text-gray-400'
                                    }`}>
                                    {item.source === 'inventory' ? 'STOCK DISPONIBLE' : 'ARCHIVADO'}
                                </span>

                                {/* Rareza Badge (V14.1) */}
                                {item.wants && item.have && (
                                    <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.25em] border shadow-2xl backdrop-blur-md ${(item.wants / item.have) > 5 ? 'bg-red-500/20 border-red-500/30 text-red-500' :
                                        (item.wants / item.have) > 2 ? 'bg-amber-500/20 border-amber-500/30 text-amber-500' :
                                            'bg-zinc-800 border-zinc-700 text-zinc-400'
                                        }`}>
                                        {(item.wants / item.have) > 5 ? 'GRIAL' :
                                            (item.wants / item.have) > 2 ? 'MUY RARO' : 'CATÁLOGO'}
                                    </span>
                                )}
                            </div>

                            <h1 className="text-5xl lg:text-7xl font-display font-black text-white uppercase tracking-tightest mb-4 leading-[0.85]">
                                {item.title}
                            </h1>
                            <div className="flex items-center gap-4">
                                <div className="h-px w-12 bg-primary"></div>
                                <p className="text-2xl text-primary font-display uppercase tracking-widest italic">
                                    {item.artist}
                                </p>
                            </div>
                        </div>

                        {/* Metadata Pro Grid (V14.1) */}
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

                        {/* Tracklist Premium */}
                        {item.tracklist && item.tracklist.length > 0 && (
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

                        {/* Crónica del Curador */}
                        {item.notes && (
                            <div className="mb-10 p-6 rounded-3xl bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 shadow-2xl relative overflow-hidden">
                                <FileText className="absolute top-4 right-4 w-32 h-32 text-zinc-800 opacity-20 rotate-12 pointer-events-none" />
                                <div className="relative z-10">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-4">Crónica del Curador</h3>
                                    <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-p:text-zinc-400 prose-p:font-serif prose-p:italic prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:text-zinc-200">
                                        <div style={{ whiteSpace: 'pre-line' }}>{item.notes}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </motion.div>

                    {/* Right Context Area (Intercambio Seguro) */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="md:col-span-1 lg:col-span-4"
                    >
                        <div className="p-6 rounded-3xl bg-zinc-900 border border-white/10 shadow-2xl relative overflow-hidden">
                            {/* Decorative Glow */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>

                            <div className="relative z-10">
                                <h3 className="text-xl font-display font-black uppercase tracking-tight text-white mb-2">
                                    Adquisición Segura
                                </h3>
                                <p className="text-xs text-zinc-400 mb-8 leading-relaxed">
                                    {item.source === 'inventory'
                                        ? "Esta pieza está certificada por nuestro equipo técnico y lista para entrega inmediata bajo los estándares de limpieza OBG."
                                        : "Esta pieza pertenece al canon privado de la comunidad. Puedes solicitar un intercambio (trade) ofreciendo crédito o discos de valor equivalente."}
                                </p>

                                <div className="space-y-4">
                                    {item.source === 'inventory' ? (
                                        <Link
                                            to={`/?add=${item.id}`}
                                            onClick={() => trackIntent('add_to_cart')}
                                            className="group flex flex-col items-center justify-center w-full px-8 py-5 bg-primary text-black rounded-2xl hover:scale-[1.02] transition-all"
                                        >
                                            <span className="font-black uppercase text-sm tracking-widest mb-1 flex items-center gap-2">
                                                Agregar a Base <Zap className="w-4 h-4 fill-black group-hover:scale-110 transition-transform" />
                                            </span>
                                            <span className="text-[10px] opacity-70 font-mono font-bold">DISPONIBILIDAD INMEDIATA</span>
                                        </Link>
                                    ) : (
                                        <Link
                                            to="/trade/new"
                                            state={{ requestedItem: item }}
                                            onClick={() => trackIntent('init_trade')}
                                            className="group flex flex-col items-center justify-center w-full px-8 py-5 bg-white text-black rounded-2xl hover:scale-[1.02] transition-all"
                                        >
                                            <span className="font-black uppercase text-sm tracking-widest mb-1 flex items-center gap-2">
                                                Iniciar Intercambio <Layers className="w-4 h-4 fill-black group-hover:rotate-180 transition-transform duration-500" />
                                            </span>
                                            <span className="text-[10px] opacity-70 font-mono font-bold">VERIFICACIÓN GARANTIZADA</span>
                                        </Link>
                                    )}
                                </div>

                                {/* Info Box */}
                                <div className="mt-8 pt-6 border-t border-white/5 space-y-3">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5"><Square className="w-3.5 h-3.5 fill-zinc-600 text-zinc-800" /></div>
                                        <p className="text-[10px] leading-tight text-zinc-500 uppercase tracking-widest">
                                            Las piezas de colección comunitaria pasan obligatoriamente por nuestra cámara de verificación para certificar su estado exacto antes del traspaso.
                                        </p>
                                    </div>
                                    {item.labels && item.labels.length > 0 && (
                                        <div className="flex items-start gap-3 mt-4">
                                            <div className="mt-0.5"><Hash className="w-3.5 h-3.5 text-zinc-600" /></div>
                                            <div>
                                                <p className="text-[10px] text-zinc-300 font-bold uppercase tracking-widest mb-1">Edición Sellada</p>
                                                {item.labels.map((l, i) => (
                                                    <p key={i} className="text-[10px] text-zinc-500 font-mono truncate max-w-[200px]">{l.name} [{l.catno}]</p>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Pasaporte del Disco - QR Engine (V14.1) */}
                        <div className="mt-8 p-8 rounded-[3rem] bg-zinc-950 border border-white/5 shadow-2xl relative overflow-hidden flex flex-col items-center">
                            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent"></div>

                            <h3 className="text-2xl font-display font-black uppercase tracking-tightest text-white mb-2 italic">
                                Pasaporte <span className="text-primary italic">Cultural</span>
                            </h3>
                            <div className="flex items-center gap-2 mb-8">
                                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-ping"></div>
                                <p className="text-[10px] text-zinc-500 font-black tracking-[0.2em] uppercase">
                                    OBG IDENT-FLOW REGISTER
                                </p>
                            </div>

                            <div className="bg-white p-6 rounded-[2rem] shadow-[0_20px_50px_rgba(255,255,255,0.05)] mb-8 relative group cursor-pointer transition-transform hover:scale-105 active:scale-95">
                                <QRCodeCanvas
                                    id="obg-qr-code"
                                    value={absoluteUrl}
                                    size={200}
                                    bgColor={"#ffffff"}
                                    fgColor={"#000000"}
                                    level={"H"}
                                    includeMargin={false}
                                    imageSettings={{
                                        src: siteConfig?.favicon?.url || "/favicon.svg",
                                        x: undefined,
                                        y: undefined,
                                        height: 48,
                                        width: 48,
                                        excavate: true,
                                    }}
                                />
                                <div className="absolute inset-x-0 bottom-4 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="bg-black text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-white/10">OBG Certified</span>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    trackIntent('download_qr');
                                    const canvas = document.getElementById("obg-qr-code") as HTMLCanvasElement;
                                    if (canvas) {
                                        const pngUrl = canvas.toDataURL("image/png");
                                        let downloadLink = document.createElement("a");
                                        const safeArtist = item.artist?.replace(/[^a-z0-9]/gi, '_').toUpperCase();
                                        const safeTitle = item.title?.replace(/[^a-z0-9]/gi, '_').toUpperCase();
                                        downloadLink.href = pngUrl;
                                        downloadLink.download = `OBG-${safeArtist}-${safeTitle}.png`;
                                        document.body.appendChild(downloadLink);
                                        downloadLink.click();
                                        document.body.removeChild(downloadLink);
                                    }
                                }}
                                className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-white text-black rounded-2xl hover:bg-primary transition-all font-black uppercase text-xs tracking-widest group"
                            >
                                <Download className="w-5 h-5 group-hover:bounce" />
                                Exportar Pasaporte PNG
                            </button>
                        </div>

                    </motion.div>
                </div>
            </div>
        </div>
    );
}
