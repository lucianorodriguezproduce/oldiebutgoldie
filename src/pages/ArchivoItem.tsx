import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Disc, Calendar, MapPin, Tag, Square, Zap, Layers } from "lucide-react";
import { archivoService, type UnifiedItem } from "@/services/archivoService";
import { LazyImage } from "@/components/ui/LazyImage";
import { SEO } from "@/components/SEO";
import { useLoading } from "@/context/LoadingContext";

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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="relative"
                    >
                        <div className="aspect-square rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)]">
                            <LazyImage
                                src={item.image}
                                alt={item.title}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex flex-col justify-center"
                    >
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-4">
                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border shadow-lg ${item.source === 'inventory'
                                    ? 'bg-primary/20 border-primary/30 text-primary'
                                    : 'bg-white/5 border-white/10 text-gray-300'
                                    }`}>
                                    {item.source === 'inventory' ? 'DISPONIBLE EN TIENDA' : 'COLECCIÓN PRIVADA'}
                                </span>
                                {item.format && (
                                    <span className="text-gray-500 font-mono text-[9px] uppercase tracking-widest flex items-center gap-2 opacity-60">
                                        <Disc className="w-3.5 h-3.5" />
                                        {item.format}
                                    </span>
                                )}
                            </div>

                            <h1 className="text-5xl md:text-7xl font-display font-black text-white uppercase tracking-tighter mb-2 leading-[0.9]">
                                {item.title}
                            </h1>
                            <p className="text-2xl md:text-3xl text-gray-500 font-display uppercase tracking-tight opacity-80">
                                {item.artist}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-6 mb-12 py-10 border-y border-white/5">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                                    <Calendar className="w-6 h-6 text-gray-400" />
                                </div>
                                <div>
                                    <p className="text-gray-600 text-[9px] uppercase tracking-widest font-bold mb-1">Prensado</p>
                                    <p className="text-white font-mono text-sm">{item.year || "N/A"}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                                    <Tag className="w-6 h-6 text-gray-400" />
                                </div>
                                <div>
                                    <p className="text-gray-600 text-[9px] uppercase tracking-widest font-bold mb-1">Etiquetas</p>
                                    <p className="text-white font-mono text-xs truncate max-w-[150px]">
                                        {item.genres?.join(", ") || "N/A"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Smart CTA Loop (Museum to Conversion Funnel) */}
                        <div className="space-y-4">
                            {item.source === 'inventory' ? (
                                <Link
                                    to={`/?add=${item.id}`}
                                    className="group flex items-center justify-between w-full px-10 py-6 bg-primary text-black rounded-2xl font-black uppercase text-sm tracking-widest shadow-[0_0_50px_rgba(204,255,0,0.2)] hover:scale-[1.02] transition-all hover:bg-white"
                                >
                                    <div className="flex flex-col items-start">
                                        <span className="text-[10px] opacity-60 leading-none mb-1">STOCK DISPONIBLE</span>
                                        <span>AGREGAR AL CARRITO</span>
                                    </div>
                                    <Zap className="w-6 h-6 fill-black group-hover:rotate-12 transition-transform" />
                                </Link>
                            ) : (
                                <Link
                                    to="/"
                                    className="group flex items-center justify-between w-full px-10 py-6 bg-white/10 text-white rounded-2xl font-black uppercase text-sm tracking-widest border border-white/10 hover:border-primary/50 hover:bg-primary/5 transition-all hover:scale-[1.02]"
                                >
                                    <div className="flex flex-col items-start">
                                        <span className="text-[10px] text-primary leading-none mb-1">PIEZA DE COMUNIDAD</span>
                                        <span>TENGO UNO IGUAL / TRADE</span>
                                    </div>
                                    <Layers className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
                                </Link>
                            )}

                            <Link
                                to="/tienda"
                                className="flex items-center justify-center gap-2 w-full px-8 py-5 bg-transparent text-gray-500 hover:text-white rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] border border-white/5 hover:border-white/20 transition-all"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                Continuar explorando el catálogo
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
