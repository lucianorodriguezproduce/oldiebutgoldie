import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { Clock, ShoppingBag, Music, ShieldCheck, BadgeDollarSign, Disc } from 'lucide-react';
import { db } from '@/lib/firebase';
import { SEO } from '@/components/SEO';
import { motion, AnimatePresence } from 'framer-motion';
import { TEXTS } from '@/constants/texts';
import { tradeService } from '@/services/tradeService';

import OrderCard from '@/components/OrderCard';

// Fetch the clean generic OrderData
export default function PublicOrders() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPublicFeed = async () => {
            try {
                // Sincronización con el nuevo motor de Trades (Soberanía de Datos)
                const trades = await tradeService.getTrades();

                // Mantenemos compatibilidad con el feed híbrido (Legacy + Bunker)
                // Filter out empty invalid routes or crash-ready docs.
                const validOrders = trades.filter((o: any) => o.item_id || o.isBatch || o.is_batch || (o.items && o.items.length > 0));
                setOrders(validOrders);
            } catch (error) {
                console.error("Error fetching public activity feed via TradeService", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPublicFeed();

        // Listener de tiempo real para la colección de orders (Legacy compatibility)
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, orderBy('timestamp', 'desc'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const publicOrdersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            setOrders(prev => {
                const combined = [...prev];
                publicOrdersData.forEach(newOrder => {
                    if (!combined.find(o => o.id === newOrder.id)) {
                        combined.push(newOrder);
                    }
                });
                return combined.sort((a, b) => {
                    const timeA = a.timestamp?.seconds || a.createdAt?.seconds || 0;
                    const timeB = b.timestamp?.seconds || b.createdAt?.seconds || 0;
                    return timeB - timeA;
                });
            });
        });

        return () => unsubscribe();
    }, []);

    return (
        <div className="min-h-screen bg-black pt-12">
            <SEO
                title={TEXTS.common.seo.activity.title}
                description={TEXTS.common.seo.activity.desc}
                image={TEXTS.common.seo.activity.ogImage}
                url="https://oldiebutgoldie.com.ar/actividad"
                schema={{
                    "@context": "https://schema.org",
                    "@type": "CollectionPage",
                    "name": TEXTS.common.publicActivity.activityName,
                    "description": TEXTS.common.publicActivity.activityFeedDesc,
                    "keywords": TEXTS.common.seo.activity.keys
                }}
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                {/* Header Sequence */}
                <header className="space-y-4 max-w-2xl">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10"
                    >
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        <span className="text-xs font-mono text-gray-300 uppercase tracking-wider">{TEXTS.common.publicActivity.verifiedFeed}</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl md:text-5xl font-black font-display tracking-tightest leading-tight"
                    >
                        {TEXTS.common.publicActivity.recentActivity.split(' ').slice(0, -1).join(' ')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/40">{TEXTS.common.publicActivity.recentActivity.split(' ').slice(-1)}</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-gray-400 max-w-xl text-sm leading-relaxed"
                    >
                        {TEXTS.common.publicActivity.exploreDiscs}
                    </motion.p>
                </header>

                {/* Grid */}
                {loading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                            <div key={i} className="aspect-[3/4] rounded-2xl bg-white/[0.02] border border-white/[0.05] animate-pulse rounded-tr-[2rem]" />
                        ))}
                    </div>
                ) : (
                    <motion.section
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="grid flex-col gap-4 md:gap-6"
                    >
                        {orders.length > 0 ? (
                            <AnimatePresence>
                                {orders.map((order, idx) => (
                                    <OrderCard
                                        key={`${order.id}-${order.items?.length || 0}-${order.status}`}
                                        order={order}
                                        context="public"
                                    />
                                ))}
                            </AnimatePresence>
                        ) : (
                            <div className="py-20 flex flex-col items-center justify-center text-center">
                                <Disc className="w-16 h-16 text-white/10 mb-4 animate-[spin_10s_linear_infinite]" />
                                <h3 className="text-xl font-display font-black text-white uppercase tracking-widest mb-2">{TEXTS.common.publicActivity.noActivity}</h3>
                                <p className="text-gray-500 font-medium">{TEXTS.common.publicActivity.noPublicOrders}</p>
                            </div>
                        )}
                    </motion.section>
                )}
            </div>
        </div>
    );
}
