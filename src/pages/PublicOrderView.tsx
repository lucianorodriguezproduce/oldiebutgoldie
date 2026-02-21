import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SEO } from "@/components/SEO";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Music, Disc, Loader2 } from "lucide-react";

export default function PublicOrderView() {
    const { id } = useParams<{ id: string }>();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrder = async () => {
            if (!id) return;
            try {
                const docRef = doc(db, "orders", id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setOrder({ id: docSnap.id, ...docSnap.data() });
                }
            } catch (error) {
                console.error("Error fetching order:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchOrder();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-4 px-4 text-center">
                <Disc className="w-16 h-16 text-white/20" />
                <h2 className="text-3xl font-display font-black text-white uppercase tracking-tighter">Lote No Encontrado</h2>
                <p className="text-gray-500 max-w-sm">El acceso a este lote no está disponible o la referencia ha expirado.</p>
                <Link to="/" className="mt-4 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-black uppercase tracking-widest text-xs transition-colors">
                    Volver al Catálogo
                </Link>
            </div>
        );
    }

    const items = order.isBatch ? (order.items || []) : [
        {
            title: order.details?.artist ? `${order.details.artist} - ${order.details.album}` : (order.title || "Unknown Title"),
            artist: order.details?.artist || order.artist || "Unknown Artist",
            album: order.details?.album || order.title || "Unknown Album",
            cover_image: order.details?.cover_image || order.thumbnailUrl || "https://raw.githubusercontent.com/lucianorodriguezproduce/buscadordiscogs2/refs/heads/main/public/obg.png",
            format: order.details?.format || "N/A",
            condition: order.details?.condition || "N/A",
            intent: order.details?.intent || order.status || "COMPRAR",
        }
    ];

    const generateDescription = () => {
        if (!items || items.length === 0) return "Lote de vinilos en Oldie but Goldie";
        const artists = Array.from(new Set(items.map((i: any) => i.artist || "Varios"))).slice(0, 3);
        const prefix = order.isBatch ? `Lote de ${items.length} ítems.` : "Pieza de colección.";
        return `${prefix} Incluye: ${artists.join(", ")}${artists.length < items.length ? " y más" : ""}.`;
    };

    const titleStr = order.isBatch ? `Lote de ${items.length} discos en Oldie but Goldie` : `${order.details?.artist || "Álbum"} - ${order.details?.album || "Desconocido"} en Oldie but Goldie`;

    // Render Schema markup for items
    const schemaMarkup = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": items.map((item: any, index: number) => ({
            "@type": "ListItem",
            "position": index + 1,
            "item": {
                "@type": "MusicRelease",
                "name": item.title || `${item.artist} - ${item.album}`,
                "image": item.cover_image || order.thumbnailUrl,
                "musicReleaseFormat": item.format,
                "offers": {
                    "@type": "Offer",
                    "itemCondition": item.condition
                }
            }
        }))
    };

    return (
        <div className="min-h-screen bg-black pt-12">
            <SEO
                title={titleStr}
                description={generateDescription()}
                image={order.thumbnailUrl}
                url={`https://oldie-but-goldie.vercel.app/orden/${id}`}
                schema={schemaMarkup}
            />

            <div className="max-w-4xl mx-auto px-4 py-8 md:py-16 space-y-12">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-4">
                        <Link to="/actividad" className="inline-flex items-center gap-2 text-[10px] font-black uppercase text-gray-500 hover:text-white transition-colors">
                            <ChevronLeft className="w-4 h-4" /> Feed de Actividad
                        </Link>
                        <h1 className="text-4xl md:text-5xl font-display font-black text-white hover:text-primary transition-colors tracking-tightest leading-none">
                            Detalle del Lote
                        </h1>
                        <p className="text-sm font-mono text-gray-400">REF: {order.order_number || id}</p>
                    </div>

                    {order.thumbnailUrl && (
                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden bg-white/5 border border-white/10 shadow-2xl flex-shrink-0">
                            <img src={order.thumbnailUrl} alt="Lote reference" className="w-full h-full object-cover" />
                        </div>
                    )}
                </header>

                <div className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 italic">Ítems Involucrados ({items.length})</h3>
                    <AnimatePresence>
                        {items.map((item: any, idx: number) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/[0.04] hover:border-white/10 transition-all group"
                            >
                                <div className="w-16 h-16 rounded-xl overflow-hidden bg-black flex-shrink-0 shadow-lg border border-white/5 group-hover:border-primary/30 transition-colors">
                                    {item.cover_image ? (
                                        <img src={item.cover_image} alt="" className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Music className="w-6 h-6 text-white/10" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-white font-bold truncate group-hover:text-primary transition-colors">
                                        {item.title || `${item.artist} - ${item.album}`}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${item.intent === 'COMPRAR'
                                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                            : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                            }`}>
                                            {item.intent}
                                        </span>
                                        <span className="text-xs text-gray-500 font-bold">{item.format} • {item.condition}</span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                <div className="flex flex-col gap-6">
                    {/* Price Info Block */}
                    {(order.adminPrice || order.totalPrice || order.details?.price) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(order.totalPrice || order.details?.price) && order.details?.intent?.includes("VENDER") && (
                                <div className="p-6 rounded-[2rem] bg-orange-500/5 border border-orange-500/10 flex flex-col justify-between">
                                    <p className="text-[10px] uppercase tracking-widest font-black text-orange-400 mb-2">Oferta Original del Vendedor</p>
                                    <p className="text-3xl font-display font-black text-white">
                                        {order.currency || order.details?.currency === "USD" ? "US$" : "$"} {(order.totalPrice || order.details?.price).toLocaleString()}
                                    </p>
                                </div>
                            )}
                            {order.adminPrice && (
                                <div className="p-6 rounded-[2rem] bg-primary/10 border border-primary/20 flex flex-col justify-between shadow-xl shadow-primary/5">
                                    <p className="text-[10px] uppercase tracking-widest font-black text-primary mb-2">Contraoferta de OBG</p>
                                    <p className="text-3xl font-display font-black text-white">
                                        {order.adminCurrency === "USD" ? "US$" : "$"} {order.adminPrice.toLocaleString()}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-primary font-black">{(order.user_name || "C").charAt(0)}</span>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-bold">Iniciado por</p>
                                <p className="text-white font-black">{order.user_name || "Cliente"}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] uppercase tracking-widest font-black text-gray-500 mb-1">Estado</p>
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${order.status === 'pending_acceptance' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' : 'bg-white/5 border-white/10 text-white'
                                }`}>
                                {order.status === 'pending_acceptance' ? 'Esperando Aceptación' : order.status}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
