import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { Clock, ShoppingBag, Music, ShieldCheck, BadgeDollarSign, Disc } from 'lucide-react';
import { db } from '@/lib/firebase';
import { SEO } from '@/components/SEO';
import { motion, AnimatePresence } from 'framer-motion';

// Defined based on Oldie but Goldie orders schema context
interface PublicOrder {
    id: string;
    itemType: string;
    itemId: string;
    title: string;
    artist: string;
    imageUrl: string;
    status: 'pending' | 'quoted' | 'sold' | 'rejected';
    intent?: string;
    createdAt: Date;
}

export default function PublicOrders() {
    const [orders, setOrders] = useState<PublicOrder[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                setLoading(true);
                const ordersRef = collection(db, 'orders');
                const q = query(ordersRef, orderBy('timestamp', 'desc'));
                const querySnapshot = await getDocs(q);

                console.log("Datos recibidos de Firebase:", querySnapshot.docs.map(d => d.data()));

                const publicOrdersData: PublicOrder[] = querySnapshot.docs.map(doc => {
                    const data = doc.data();

                    return {
                        id: doc.id,
                        itemType: 'release', // Defaulting since type is not explicitly stored in V1 payload
                        itemId: data.item_id || '',
                        title: data.details?.album || 'Unknown Title',
                        artist: data.details?.artist || 'Unknown Artist',
                        imageUrl: data.details?.cover_image || '',
                        status: data.status || 'pending',
                        intent: data.details?.intent || 'COMPRAR',
                        createdAt: data.timestamp?.toDate() || new Date(),
                    };
                });

                // Filter out missing items that would break the dynamically generated routes
                const validOrders = publicOrdersData.filter(o => o.itemId);
                setOrders(validOrders);
            } catch (error) {
                console.error("Error fetching public activity feed: Missing Firebase Composite Index or Invalid Rule. Detalle: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, []);

    // Format relative time (e.g. "hace 2 horas")
    const getRelativeTime = (date: Date) => {
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return `hace ${diffInSeconds}s`;
        if (diffInSeconds < 3600) return `hace ${Math.floor(diffInSeconds / 60)}m`;
        if (diffInSeconds < 86400) return `hace ${Math.floor(diffInSeconds / 3600)}h`;
        return `hace ${Math.floor(diffInSeconds / 86400)}d`;
    };

    const getStatusBadge = (status: PublicOrder['status']) => {
        switch (status) {
            case 'sold':
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-md">
                        <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[10px] uppercase tracking-widest font-black text-primary">Vendido</span>
                    </div>
                );
            case 'quoted':
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 backdrop-blur-md">
                        <BadgeDollarSign className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-[10px] uppercase tracking-widest font-black text-blue-400">Cotizado</span>
                    </div>
                );
            case 'pending':
            default:
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-[10px] uppercase tracking-widest font-black text-gray-400">En Consulta</span>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-black pt-12">
            <SEO
                title="Actividad Reciente | Oldie but Goldie"
                description="Últimas adquisiciones, cotizaciones y ventas de vinilos de colección en tiempo real."
                url="https://oldie-but-goldie.vercel.app/actividad"
                schema={{
                    "@context": "https://schema.org",
                    "@type": "CollectionPage",
                    "name": "Feed de Actividad de Vinilos",
                    "description": "Monitoreo en tiempo real del catálogo rotativo de Oldie but Goldie"
                }}
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                {/* Header Sequence */}
                <div className="space-y-4 max-w-2xl">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10"
                    >
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        <span className="text-xs font-mono text-gray-300 uppercase tracking-wider">Feed Público Verificado</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl md:text-5xl font-black font-display tracking-tightest leading-tight"
                    >
                        Actividad <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/40">Reciente</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-gray-400 max-w-xl text-sm leading-relaxed"
                    >
                        Explora los discos que están en movimiento ahora mismo. Cada transacción es una pieza de historia física preservada.
                    </motion.p>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                            <div key={i} className="aspect-[3/4] rounded-2xl bg-white/[0.02] border border-white/[0.05] animate-pulse rounded-tr-[2rem]" />
                        ))}
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6"
                    >
                        <AnimatePresence>
                            {orders.map((order, idx) => (
                                <motion.div
                                    key={order.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: idx * 0.05 }}
                                    whileHover={{ y: -4, scale: 1.02 }}
                                    className="group relative flex flex-col h-full bg-neutral-900/50 hover:bg-neutral-800/80 rounded-3xl overflow-hidden border border-white/5 hover:border-white/10 transition-all duration-300"
                                >
                                    <Link to={`/item/${order.itemType}/${order.itemId}`} className="flex flex-col h-full">

                                        {/* Image Section */}
                                        <div className="relative aspect-square overflow-hidden bg-black/50">
                                            {order.imageUrl ? (
                                                <img
                                                    src={order.imageUrl}
                                                    alt={order.title}
                                                    className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Music className="w-12 h-12 text-white/10" />
                                                </div>
                                            )}

                                            {/* Top Gradient Overlay for Badge Contrast */}
                                            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                            {/* Status Badge */}
                                            <div className="absolute top-3 right-3 z-10">
                                                {getStatusBadge(order.status)}
                                            </div>

                                            {/* Intent Badge */}
                                            {order.intent && (
                                                <div className="absolute top-3 left-3 z-10">
                                                    <div className={`px-2 py-1 rounded-[4px] border backdrop-blur-md ${order.intent === 'VENDER' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
                                                        <span className="text-[9px] uppercase tracking-widest font-black">
                                                            {order.intent === 'VENDER' ? 'Disponible' : 'Buscado'}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Meta Section */}
                                        <div className="p-4 flex flex-col flex-grow">
                                            <div className="flex-grow space-y-1">
                                                <h3 className="text-white font-bold leading-tight line-clamp-2 text-sm md:text-base group-hover:text-primary transition-colors">
                                                    {order.title}
                                                </h3>
                                                <p className="text-gray-400 text-xs md:text-sm font-medium line-clamp-1">
                                                    {order.artist}
                                                </p>
                                            </div>

                                            <div className="mt-4 flex items-center justify-between pt-4 border-t border-white/5">
                                                <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">
                                                    {getRelativeTime(order.createdAt)}
                                                </span>
                                                <span className="text-[10px] text-white/30 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                                    Ver ID <span className="text-primary">{order.itemId}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>
                )}

                {/* Empty State */}
                {!loading && orders.length === 0 && (
                    <div className="py-24 text-center space-y-4">
                        <Disc className="w-16 h-16 text-white/10 mx-auto animate-spin-slow" />
                        <h3 className="text-xl font-bold text-white">El muro está vacío</h3>
                        <p className="text-gray-400 max-w-sm mx-auto">No hay transacciones registradas todavía en el ecosistema.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
