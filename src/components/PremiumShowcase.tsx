import { useState, useEffect } from "react";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import { TEXTS } from "@/constants/texts";
import { useNavigate } from "react-router-dom";
import { LazyImage } from "@/components/ui/LazyImage";
import { ChevronRight, Check, Plus, ShoppingBag, Star } from "lucide-react";
import { getCleanOrderMetadata } from "@/utils/orderMetadata";
import { useLote } from "@/context/LoteContext";
import { CompactSearchCard } from "@/components/ui/CompactSearchCard";

export function PremiumShowcase() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
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
            orderBy("timestamp", "desc"),
            limit(20)
        );

        let activeOrders: any[] = [];
        let activeInventory: any[] = [];

        const updateShowcase = () => {
            const combined = [
                ...activeInventory.map(item => ({ ...item, isFromInventory: true })),
                ...activeOrders
            ]
                .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
                .slice(0, 20);

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

            {/* GRID DE PRODUCTOS */}
            <div className="max-w-7xl mx-auto px-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-8">
                    {orders.map((order, idx) => {
                        const { artist, album, image: cover, isBatch: isBatchActual, itemsCount } = getCleanOrderMetadata(order);
                        const title = isBatchActual ? `LOTE DE ${itemsCount} DISCOS` : album;

                        return (
                            <div key={order.id} className="relative group">
                                <CompactSearchCard
                                    result={{
                                        id: order.id,
                                        title: title,
                                        cover_image: cover,
                                        thumb: cover,
                                        type: 'release',
                                        isLocal: true,
                                        normalizedAlbum: album,
                                        normalizedArtist: artist
                                    } as any}
                                    idx={idx}
                                    onClick={() => {
                                        if (order.isFromInventory) {
                                            navigate(`/album/${order.id}`);
                                        } else {
                                            navigate(`/orden/${order.id}?action=buy`);
                                        }
                                    }}
                                />

                                {/* Quick Add Button Overlay */}
                                <div className="absolute top-2 right-2 z-30 pointer-events-auto">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            addItemFromInventory(order);
                                        }}
                                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-xl backdrop-blur-md border ${isInLote(order.id)
                                            ? 'bg-primary border-primary text-black'
                                            : 'bg-black/60 border-white/20 text-white hover:bg-primary hover:border-primary hover:text-black'
                                            }`}
                                    >
                                        {isInLote(order.id) ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* VER MÁS BUTTON */}
                <div className="flex justify-center mt-16">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/tienda')}
                        className="group relative px-12 py-5 bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all hover:border-primary/50"
                    >
                        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors" />
                        <div className="flex items-center gap-3 relative z-10">
                            <ShoppingBag className="h-5 w-5 text-gray-400 group-hover:text-primary transition-colors" />
                            <span className="text-xs font-black uppercase tracking-[0.3em] text-white group-hover:text-primary transition-colors">
                                {TEXTS.showcase.viewMore}
                            </span>
                            <ChevronRight className="h-4 w-4 text-gray-600 group-hover:text-primary transition-transform group-hover:translate-x-1" />
                        </div>
                    </motion.button>
                </div>
            </div>
        </section>
    );
}
