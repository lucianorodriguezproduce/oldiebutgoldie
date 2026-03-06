import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Disc, Calendar, MapPin, Tag, Square, Zap, HelpCircle } from "lucide-react";
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
                title={`${item.artist} - ${item.title} | Archivo Oldie But Goldie`}
                description={`Encontrá ${item.title} de ${item.artist} y más discos en el búnker de Oldie But Goldie. Compras, ventas e intercambios de cd/dvd/casette/vinilos.`}
                image={item.image}
            />

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
                        <div className="aspect-square rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
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
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border ${item.source === 'inventory'
                                    ? 'bg-primary/10 border-primary/20 text-primary'
                                    : 'bg-white/10 border-white/20 text-white'
                                    }`}>
                                    {item.source === 'inventory' ? 'ITEM DISPONIBLE' : 'DISCO DE COMUNIDAD'}
                                </span>
                                {item.format && (
                                    <span className="text-gray-500 font-mono text-[10px] uppercase tracking-widest flex items-center gap-2">
                                        <Disc className="w-3 h-3" />
                                        {item.format}
                                    </span>
                                )}
                            </div>

                            <h1 className="text-5xl md:text-6xl font-display font-black text-white uppercase tracking-tighter mb-2 leading-none">
                                {item.title}
                            </h1>
                            <p className="text-2xl text-gray-500 font-display uppercase tracking-tight">
                                {item.artist}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-6 mb-12 py-8 border-y border-white/10">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                                    <Calendar className="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                    <p className="text-gray-600 text-[8px] uppercase tracking-widest mb-1">Año</p>
                                    <p className="text-white font-mono text-sm">{item.year || "N/A"}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                                    <Tag className="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                    <p className="text-gray-600 text-[8px] uppercase tracking-widest mb-1">Género</p>
                                    <p className="text-white font-mono text-xs truncate max-w-[120px]">
                                        {item.genres?.join(", ") || "N/A"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Regla de Dos Interacciones (The Funnel) */}
                        <div className="space-y-4">
                            <Link
                                to="/"
                                className="group flex items-center justify-between w-full px-8 py-5 bg-primary text-black rounded-2xl font-black uppercase text-sm tracking-widest shadow-[0_0_40px_rgba(204,255,0,0.1)] hover:scale-[1.02] transition-all"
                            >
                                <span>Comprá vendé o intercambiá en OBG</span>
                                <Zap className="w-5 h-5 fill-black group-hover:rotate-12 transition-transform" />
                            </Link>

                            <Link
                                to="/guias"
                                className="flex items-center justify-center gap-2 w-full px-8 py-5 bg-white/5 text-white/50 hover:text-white rounded-2xl font-bold uppercase text-xs tracking-widest border border-white/5 hover:border-white/10 transition-all"
                            >
                                <HelpCircle className="w-4 h-4" />
                                ¿Cómo operar con Oldie But Goldie?
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
