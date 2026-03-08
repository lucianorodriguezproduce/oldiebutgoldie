import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Disc, Calendar, MapPin, Tag, Square, Zap, Layers, PlayCircle, Music, FileText, ChevronRight, Hash, Download, QrCode } from "lucide-react";
import { archivoService, type UnifiedItem } from "@/services/archivoService";
import { LazyImage } from "@/components/ui/LazyImage";
import { SEO } from "@/components/SEO";
import { useLoading } from "@/context/LoadingContext";
import { QRCodeCanvas } from "qrcode.react";

export default function ArchivoItem() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showLoading, hideLoading } = useLoading();
    const [item, setItem] = useState<UnifiedItem | null>(null);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!id) return;

        async function load() {
            showLoading("Localizando pieza...");
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

    return (
        <div className="min-h-screen bg-black pt-28 pb-20 px-6">
            <SEO
                title={`${item.artist} - ${item.title} | Archivo Sonoro Oldie But Goldie`}
                description={`Explorá ${item.title} de ${item.artist} en nuestro archivo cultural. Formato: ${item.format}. Estado: ${item.condition}.`}
                image={item.image}
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
                        "url": window.location.href,
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
                    className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors font-mono text-[10px] uppercase tracking-widest mb-12"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Regresar
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">

                    {/* Media Sidebar - Sticky */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="lg:col-span-4 lg:sticky lg:top-32 space-y-6"
                    >
                        <div className="group relative aspect-square rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)]">
                            <LazyImage
                                src={item.image}
                                alt={item.title}
                                className="w-full h-full object-cover relative z-10 group-hover:scale-105 transition-transform duration-700"
                            />
                            {item.format?.toLowerCase().includes("vinyl") && (
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/vinyl.png')] opacity-0 group-hover:opacity-40 transition-opacity duration-700 z-20 pointer-events-none mix-blend-overlay"></div>
                            )}
                        </div>

                        {/* YouTube Sticky Player */}
                        {item.youtube_id && (
                            <div className="w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black/50 backdrop-blur-md">
                                <div className="p-3 border-b border-white/10 flex items-center gap-2 bg-zinc-900/50">
                                    <PlayCircle className="w-4 h-4 text-primary" />
                                    <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">Preescucha Oficial</span>
                                </div>
                                <div className="relative aspect-video w-full">
                                    <iframe
                                        width="100%"
                                        height="100%"
                                        src={`https://www.youtube.com/embed/${item.youtube_id}?autoplay=0&rel=0&modestbranding=1`}
                                        title="YouTube video player"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        className="absolute top-0 left-0 w-full h-full pointer-events-auto"
                                    ></iframe>
                                </div>
                            </div>
                        )}
                    </motion.div>

                    {/* Main Content Area */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="lg:col-span-4 flex flex-col pt-2 lg:pt-0"
                    >
                        {/* Header Minimal */}
                        <div className="mb-10">
                            <div className="flex flex-wrap items-center gap-2 mb-6">
                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border shadow-lg ${item.source === 'inventory'
                                    ? 'bg-primary/20 border-primary/30 text-primary'
                                    : 'bg-white/5 border-white/10 text-gray-400'
                                    }`}>
                                    {item.source === 'inventory' ? 'DISPONIBLE EN TIENDA' : 'COLECCIÓN PRIVADA'}
                                </span>
                                {item.format && (
                                    <span className="text-gray-400 font-mono text-[9px] uppercase tracking-widest border border-white/10 px-3 py-1.5 rounded-full">
                                        {item.format}
                                    </span>
                                )}
                            </div>

                            <h1 className="text-4xl lg:text-5xl font-display font-black text-white uppercase tracking-tighter mb-2 leading-[0.9]">
                                {item.title}
                            </h1>
                            <p className="text-xl lg:text-2xl text-primary font-display uppercase tracking-tight">
                                {item.artist}
                            </p>
                        </div>

                        {/* Extended Metas */}
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                <p className="text-zinc-500 text-[9px] uppercase tracking-widest font-bold mb-1">Año de Prensado</p>
                                <p className="text-white font-mono text-sm">{item.year || "N/A"}</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                <p className="text-zinc-500 text-[9px] uppercase tracking-widest font-bold mb-1">Géneros Principales</p>
                                <p className="text-white font-mono text-xs truncate">{item.genres?.slice(0, 2).join(", ") || "N/A"}</p>
                            </div>
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
                                                <span className="font-mono text-[10px] text-zinc-600 group-hover:text-primary transition-colors min-w-[30px]">{track.position}</span>
                                                <span className="text-sm text-zinc-300 group-hover:text-white transition-colors line-clamp-1">{track.title}</span>
                                            </div>
                                            <span className="font-mono text-xs text-zinc-600">{track.duration}</span>
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
                        className="lg:col-span-4"
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

                        {/* Identidad Física Digital - QR Code V12.5 */}
                        <div className="mt-8 p-6 rounded-3xl bg-white border border-white/10 shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
                            <h3 className="text-xl font-display font-black uppercase tracking-tight text-black mb-1">
                                Identidad Digital
                            </h3>
                            <p className="text-[10px] text-zinc-500 mb-6 font-mono font-bold">
                                ESCANEA PARA ACCEDER AL TRACKLIST
                            </p>

                            <div className="bg-white p-4 rounded-xl shadow-inner mb-6 border border-zinc-100 relative group">
                                <QRCodeCanvas
                                    id="obg-qr-code"
                                    value={window.location.href}
                                    size={180}
                                    bgColor={"#ffffff"}
                                    fgColor={"#000000"}
                                    level={"H"}
                                    includeMargin={false}
                                    imageSettings={{
                                        src: "/favicon.svg", // Reemplaza con tu icono si la resolución no rompe la legibilidad
                                        x: undefined,
                                        y: undefined,
                                        height: 40,
                                        width: 40,
                                        excavate: true,
                                    }}
                                />
                                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none"></div>
                            </div>

                            <button
                                onClick={() => {
                                    const canvas = document.getElementById("obg-qr-code") as HTMLCanvasElement;
                                    if (canvas) {
                                        const pngUrl = canvas
                                            .toDataURL("image/png")
                                            .replace("image/png", "image/octet-stream");
                                        let downloadLink = document.createElement("a");
                                        downloadLink.href = pngUrl;
                                        downloadLink.download = `obg-qr-${item.id}.png`;
                                        document.body.appendChild(downloadLink);
                                        downloadLink.click();
                                        document.body.removeChild(downloadLink);
                                    }
                                }}
                                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-black text-white rounded-xl hover:bg-zinc-800 transition-colors font-bold uppercase text-[10px] tracking-widest"
                            >
                                <Download className="w-4 h-4" />
                                Descargar para Impresión
                            </button>
                        </div>

                    </motion.div>
                </div>
            </div>
        </div>
    );
}
