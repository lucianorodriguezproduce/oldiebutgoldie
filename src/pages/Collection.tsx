import { Card, CardContent } from "@/components/ui/card";
import { Grid2X2, List, TrendingUp, Box, Hash, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlbumCardSkeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import { useState, useEffect } from "react";

interface CollectionItem {
    id: string;
    title: string;
    cover_image: string;
    addedAt: string;
}

export default function Collection() {
    const { user } = useAuth();
    const [items, setItems] = useState<CollectionItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setItems([]);
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, "users", user.uid, "collection"),
            orderBy("addedAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as CollectionItem[];
            setItems(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const removeItem = async (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        if (!user) return;
        await deleteDoc(doc(db, "users", user.uid, "collection", id));
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.05 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, scale: 0.95, y: 10 },
        show: { opacity: 1, scale: 1, y: 0 }
    };

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center py-40 text-center space-y-8 bg-white/[0.02] rounded-[3rem] border border-dashed border-white/10">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Box className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-3xl font-display font-bold text-white">Archives Offline</h2>
                    <p className="text-gray-500 max-w-sm">Please synchronize your identifier to access your private sonic collection.</p>
                </div>
                <Link to="/login">
                    <button className="bg-primary text-black px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-white transition-all">
                        Join the Collective
                    </button>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-12">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-end justify-between gap-8"
            >
                <div className="space-y-2">
                    <h1 className="text-6xl font-display font-bold text-white tracking-tightest">Archive</h1>
                    <p className="text-gray-500 font-medium max-w-md">Your curated physical collection, synchronized with Firestore persistence.</p>
                </div>

                <div className="flex gap-4">
                    {[
                        { label: "Vault Items", value: items.length, icon: Box, color: "text-primary" },
                        { label: "Archive Value", value: `$${(items.length * 28.50).toFixed(2)}`, icon: TrendingUp, color: "text-secondary" },
                    ].map((stat) => (
                        <div key={stat.label} className="bg-white/5 border border-white/5 rounded-2xl p-6 min-w-[160px] backdrop-blur-3xl group hover:border-white/10 transition-all shadow-xl">
                            <stat.icon className={`h-5 w-5 ${stat.color} mb-4`} />
                            <div className="text-2xl font-black font-mono text-white mb-1 tracking-tighter">{stat.value}</div>
                            <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </motion.div>

            <div className="h-px bg-white/5 w-full" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <button className="text-primary font-black border-b-2 border-primary pb-2 px-2 text-[10px] uppercase tracking-widest">Active Inventory</button>
                    <button className="text-gray-600 font-bold hover:text-white pb-2 px-2 text-[10px] uppercase tracking-widest transition-colors">By Resonance</button>
                </div>
                <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-xl border border-white/5">
                    <button className="p-2 bg-white/10 text-primary rounded-lg shadow-sm">
                        <Grid2X2 className="h-4 w-4" />
                    </button>
                    <button className="p-2 text-gray-600 hover:text-white transition-colors">
                        <List className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <AnimatePresence mode="popLayout">
                <motion.div
                    layout
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8"
                >
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <AlbumCardSkeleton key={i} />
                        ))
                    ) : items.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="col-span-full py-40 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[3rem] space-y-6"
                        >
                            <div className="p-6 bg-white/5 rounded-full">
                                <Hash className="h-10 w-10 text-gray-700" />
                            </div>
                            <div className="text-center space-y-2">
                                <p className="text-xl font-display font-medium text-gray-500 tracking-tight">Your vault is currently vacant.</p>
                                <Link to="/" className="text-primary font-black hover:underline underline-offset-8 transition-all block text-sm uppercase tracking-widest">Discover Potential Targets</Link>
                            </div>
                        </motion.div>
                    ) : (
                        items.map((item) => (
                            <motion.div key={item.id} variants={itemVariants} layout>
                                <Link to={`/album/${item.id}`} className="group block relative">
                                    <Card className="bg-transparent border-0 shadow-none">
                                        <CardContent className="p-0">
                                            <div className="aspect-square rounded-[2rem] overflow-hidden mb-4 relative bg-surface-dark shadow-2xl transition-all duration-700 group-hover:scale-[1.02] ring-1 ring-white/5 group-hover:ring-primary/40">
                                                <img
                                                    src={item.cover_image}
                                                    alt={item.title}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-6">
                                                    <button
                                                        onClick={(e) => removeItem(e, item.id)}
                                                        className="self-end p-2 bg-red-400/20 text-red-100 rounded-xl hover:bg-red-400 transition-all border border-red-400/30 mb-auto"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                    <span className="text-[10px] font-black text-primary uppercase tracking-widest mt-auto">View Data</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="text-white font-bold text-sm truncate group-hover:text-primary transition-colors">{item.title}</h3>
                                                <p className="text-gray-600 text-[9px] font-black uppercase tracking-widest">ID: {item.id}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            </motion.div>
                        ))
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
