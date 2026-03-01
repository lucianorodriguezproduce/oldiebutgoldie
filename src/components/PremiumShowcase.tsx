import { useState, useEffect } from "react";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import { TEXTS } from "@/constants/texts";
import { useNavigate } from "react-router-dom";
import { LazyImage } from "@/components/ui/LazyImage";
import { ChevronRight, Disc, Star, Package, Plus, Check, ShoppingBag } from "lucide-react";
import { getCleanOrderMetadata } from "@/utils/orderMetadata";
import { useLote } from "@/context/LoteContext";

export function PremiumShowcase() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState(0);
    const navigate = useNavigate();
    const { addItemFromInventory, isInLote, loteItems } = useLote();

    useEffect(() => {
        console.log("PremiumShowcase: Component mounted");

        // 1. Listen to Featured Orders (Admin Offers)
        const qOrders = query(
            collection(db, "orders"),
            where("is_admin_offer", "==", true)
        );

        // 2. Listen to Active Inventory (The Bunker)
        const qInventory = query(
            collection(db, "inventory"),
            where("logistics.status", "==", "active"),
            limit(10)
        );

        let activeOrders: any[] = [];
        let activeInventory: any[] = [];

        const updateShowcase = () => {
            const combined = [
                ...activeInventory.map(item => ({ ...item, isFromInventory: true })),
                ...activeOrders
            ]
                .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
                .slice(0, 10);

            setOrders(combined);
            setLoading(false);
        };

        const unsubOrders = onSnapshot(qOrders, (snapshot) => {
            activeOrders = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as any))
                .filter(item => {
                    const isAdmin = item.is_admin_offer === true ||
                        item.user_id === 'oldiebutgoldie' ||
                        item.user_email === 'admin@discography.ai';

                    const isAvailable = !['sold', 'venta_finalizada', 'completed', 'cancelled', 'rejected'].includes(item.status);

                    return isAdmin && isAvailable;
                });
            updateShowcase();
        }, (error) => {
            console.warn("Orders fetch error:", error);
        });

        const unsubInventory = onSnapshot(qInventory, (snapshot) => {
            activeInventory = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
            updateShowcase();
        }, (error) => {
            console.warn("Inventory fetch error:", error);
        });

        return () => {
            unsubOrders();
            unsubInventory();
        };
    }, []);

    if (loading) return null;

    if (orders.length === 0) {
        return null;
    }

    return (
        <section className="w-full py-2 space-y-6 mt-4 relative">
            <div className="px-6 text-center">
                <div className="space-y-1">
                    {TEXTS.showcase.subtitle && (
                        <div className="flex items-center justify-center gap-2">
                            <Star className="h-3 w-3 text-primary fill-primary" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80">
                                {TEXTS.showcase.subtitle}
                            </span>
                        </div>
                    )}
                    <h2 className="text-3xl md:text-5xl font-display font-black text-white uppercase tracking-tighter">
                        {TEXTS.showcase.title}
                    </h2>
                </div>
            </div>

            {/* Horizontal Scroll Container with Visual Cues */}
            <motion.div
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.2 }}
                className="relative group/showcase"
            >
                <div
                    onScroll={(e) => {
                        const target = e.currentTarget;
                        const index = Math.round(target.scrollLeft / (target.offsetWidth * 0.8));
                        setActiveIndex(index);
                    }}
                    style={{
                        WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
                        maskImage: 'linear-gradient(to right, black 85%, transparent 100%)'
                    }}
                    className="w-full overflow-x-auto snap-x snap-mandatory hide-scrollbar flex gap-6 px-6 pb-4"
                >
                    <motion.div
                        animate={{ x: [0, -15, 0] }}
                        transition={{ duration: 1.5, times: [0, 0.5, 1], delay: 1 }}
                        className="flex gap-6"
                    >
                        {orders.map((order) => {
                            const price = order.adminPrice || order.totalPrice;
                            const currency = order.adminCurrency || order.currency || "ARS";

                            const { artist, album, format, image: cover, isBatch: isBatchActual, itemsCount } = getCleanOrderMetadata(order);
                            const title = isBatchActual ? `LOTE DE ${itemsCount} DISCOS` : album;

                            return (
                                <motion.button
                                    key={order.id}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                        if (order.isFromInventory) {
                                            navigate(`/album/${order.id}`);
                                        } else {
                                            navigate(`/orden/${order.id}?action=buy`);
                                        }
                                    }}
                                    className="flex-none w-[280px] md:w-[350px] snap-center group relative overflow-hidden rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl transition-all hover:border-primary/30 text-left"
                                >
                                    {/* Card Background Accent */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                    <div className="p-6 space-y-6">
                                        {/* Cover Image Container */}
                                        <div className="aspect-square w-full relative rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10">
                                            <div className="absolute inset-x-0 top-0 p-4 flex justify-end z-20">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        addItemFromInventory(order);
                                                    }}
                                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-xl backdrop-blur-md border ${isInLote(order.id)
                                                        ? 'bg-primary border-primary text-black'
                                                        : 'bg-black/60 border-white/20 text-white hover:bg-primary hover:border-primary hover:text-black'
                                                        }`}
                                                >
                                                    {isInLote(order.id) ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                                                </button>
                                            </div>

                                            <LazyImage
                                                src={cover}
                                                alt={title}
                                                className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-700"
                                            />
                                            {/* Glass Overlay on hover */}
                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>

                                        {/* Info section */}
                                        <div className="space-y-4 text-left">
                                            <div className="min-h-[4.5rem] space-y-1">
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] block truncate">
                                                    {artist}
                                                </span>
                                                <h3 className="text-xl font-display font-black text-white uppercase tracking-tight leading-none line-clamp-2 group-hover:text-primary transition-colors">
                                                    {title}
                                                </h3>
                                            </div>

                                            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-0.5">Precio de Colección</span>
                                                    <span className="text-lg font-display font-black text-white">
                                                        {currency === "USD" ? "US$" : "$"} {price?.toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="p-3 bg-white/5 group-hover:bg-primary group-hover:text-black rounded-full transition-all border border-white/5 group-hover:border-primary shadow-xl">
                                                    <ChevronRight className="h-5 w-5" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Corner Badges */}
                                    <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                                        <div className="px-3 py-1 bg-primary/10 border border-primary/20 backdrop-blur-md rounded-lg flex items-center gap-1.5">
                                            <Disc className="h-3 w-3 text-primary" />
                                            <span className="text-[9px] font-black text-primary uppercase tracking-widest">
                                                {TEXTS.showcase.officialStore}
                                            </span>
                                        </div>
                                        {!isBatchActual && (
                                            <div className="px-3 py-1 bg-white/10 border border-white/10 backdrop-blur-md rounded-lg flex items-center gap-1.5">
                                                <Package className="h-3 w-3 text-gray-400" />
                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                                    {format}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </motion.button>
                            );
                        })}
                        {/* Aesthetic Spacing at end */}
                        <div className="flex-none w-12" />
                    </motion.div>
                </div>
            </motion.div>

            {/* Pagination Dots */}
            <div className="flex justify-center gap-1.5 pt-2">
                {orders.map((_, idx) => (
                    <div
                        key={idx}
                        className={`h-1 rounded-full transition-all duration-300 ${idx === activeIndex ? 'w-4 bg-primary' : 'w-1 bg-white/20'}`}
                    />
                ))}
            </div>
        </section>
    );
}
