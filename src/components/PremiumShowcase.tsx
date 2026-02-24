import { useState, useEffect } from "react";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import { TEXTS } from "@/constants/texts";
import { useNavigate } from "react-router-dom";
import { LazyImage } from "@/components/ui/LazyImage";
import { ChevronRight, Disc, Star } from "lucide-react";

export function PremiumShowcase() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        console.log("PremiumShowcase: Component mounted");
        const q = query(
            collection(db, "orders"),
            where("is_admin_offer", "==", true)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as any))
                .filter(item => {
                    const isAdmin = item.is_admin_offer === true ||
                        item.user_id === 'oldiebutgoldie' ||
                        item.user_email === 'admin@discography.ai';

                    const isAvailable = !['sold', 'venta_finalizada', 'completed', 'cancelled', 'rejected'].includes(item.status);

                    return isAdmin && isAvailable;
                })
                .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
                .slice(0, 10);

            setOrders(items);
            setLoading(false);
        }, (error) => {
            console.warn("Showcase fetch error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (loading) return null;

    if (orders.length === 0) {
        return null;
    }

    return (
        <section className="w-full py-2 space-y-8 mt-4">
            <div className="px-6 text-center">
                <div className="space-y-1">
                    {TEXTS.showcase.subtitle && (
                        <div className="flex items-center justify-center gap-2">
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-500/80">
                                {TEXTS.showcase.subtitle}
                            </span>
                        </div>
                    )}
                    <h2 className="text-3xl md:text-5xl font-display font-black text-white uppercase tracking-tighter">
                        {TEXTS.showcase.title}
                    </h2>
                </div>
            </div>

            <div className="w-full overflow-x-auto snap-x snap-mandatory hide-scrollbar flex gap-6 px-6 pb-8">
                {orders.map((order) => {
                    const price = order.adminPrice || order.totalPrice;
                    const currency = order.adminCurrency || order.currency || "ARS";
                    const itemsCount = order.items?.length || 1;
                    const isBatchActual = itemsCount > 1;
                    const title = isBatchActual
                        ? `LOTE DE ${itemsCount} DISCOS`
                        : (order.items?.[0]?.title || order.details?.album || "Disco Registrado");

                    // Image Recovery: Prioritize direct item image, then order level images, then nested details
                    const cover = order.items?.[0]?.image ||
                        order.items?.[0]?.cover_image ||
                        order.items?.[0]?.details?.cover_image ||
                        order.items?.[0]?.thumb ||
                        order.cover_image ||
                        order.imageUrl ||
                        order.details?.cover_image ||
                        order.thumbnailUrl;

                    return (
                        <motion.button
                            key={order.id}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate(`/orden/${order.id}?action=buy`)}
                            className="flex-none w-[280px] md:w-[350px] snap-center group relative overflow-hidden rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl transition-all hover:border-yellow-500/30 text-left"
                        >
                            {/* Card Background Accent */}
                            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                            <div className="p-6 space-y-6">
                                {/* Cover Image Container */}
                                <div className="aspect-square w-full relative rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10">
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
                                    <div className="min-h-[3.5rem]">
                                        <h3 className="text-xl font-display font-black text-white uppercase tracking-tight leading-none line-clamp-2 group-hover:text-yellow-400 transition-colors">
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
                                        <div className="p-3 bg-white/5 group-hover:bg-yellow-500 group-hover:text-black rounded-full transition-all border border-white/5 group-hover:border-yellow-500 shadow-xl">
                                            <ChevronRight className="h-5 w-5" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Corner Badge */}
                            <div className="absolute top-4 right-4 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 backdrop-blur-md rounded-lg flex items-center gap-1.5">
                                <Disc className="h-3 w-3 text-yellow-500" />
                                <span className="text-[9px] font-black text-yellow-500 uppercase tracking-widest">
                                    {TEXTS.showcase.officialStore}
                                </span>
                            </div>
                        </motion.button>
                    );
                })}

                {/* Aesthetic Spacing at end */}
                <div className="flex-none w-6" />
            </div>
        </section>
    );
}
