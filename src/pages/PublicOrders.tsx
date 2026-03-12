import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { Clock, ShoppingBag, Music, ShieldCheck, BadgeDollarSign, Disc } from 'lucide-react';
import { db } from '@/lib/firebase';
import { SEO } from '@/components/SEO';
import { motion, AnimatePresence } from 'framer-motion';
import { TEXTS } from '@/constants/texts';
import { tradeService } from '@/services/tradeService';

import { inventoryService } from '@/services/inventoryService';

import OrderCard from '@/components/OrderCard';
import SocialRadar from '@/components/Profile/SocialRadar';
import { useAuth } from '@/context/AuthContext';
import { siteConfigService } from '@/services/siteConfigService';
import type { SiteConfig } from '@/services/siteConfigService';
import { ADMIN_UID } from '@/constants/admin';

// Fetch the clean generic OrderData
export default function PublicOrders() {
    const { user, isAdmin } = useAuth();
    const [config, setConfig] = useState<SiteConfig | null>(null);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // 1. Listen for Config
    useEffect(() => {
        const unsubscribe = siteConfigService.onSnapshotConfig(setConfig);
        return () => unsubscribe();
    }, []);

    // 2. Listen for Trades & Inventory
    useEffect(() => {
        let unsubscribeTrades: (() => void) | undefined;

        const startTradesListener = async () => {
            try {
                const q = query(collection(db, 'trades'), orderBy('createdAt', 'desc'));
                unsubscribeTrades = onSnapshot(q, async (snapshot) => {
                    const tradeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

                    // Filter based on Elastic Visibility Rules
                    const filteredTrades = tradeData.filter((o: any) => {
                        if (isAdmin) return true;

                        const isValidStructure = o.item_id || o.isBatch || o.is_batch ||
                            (o.items && o.items.length > 0) ||
                            (o.manifest?.requestedItems?.length > 0) ||
                            (o.manifest?.offeredItems?.length > 0) ||
                            (o.manifest?.items?.length > 0);

                        if (!isValidStructure) return false;

                        const isOwner = user && (o.user_id === user.uid || o.participants?.senderId === user.uid || o.participants?.receiverId === user.uid);
                        
                        // Rule 1: Owners always see their own orders (History)
                        if (isOwner) return true;

                        // Rule 2: Non-owners only see public exchanges when market is open
                        const isMarketOpen = config?.p2p_global_enabled ?? false;
                        const isPublicExchange = (o.type === 'exchange' || o.intent === 'INTERCAMBIO') && o.isPublicOrder === true;

                        return isMarketOpen && isPublicExchange;
                    });

                    const inventoryItems = await inventoryService.getRecentAdditions(15);
                    const enrichedInventory = inventoryItems.map(item => ({
                        ...item,
                        is_admin_offer: true,
                        isInventoryItem: true,
                        status: 'active'
                    }));

                    setOrders([...enrichedInventory, ...filteredTrades].sort((a, b) => {
                        const timeA = a.timestamp?.seconds || a.createdAt?.seconds || 0;
                        const timeB = b.timestamp?.seconds || b.createdAt?.seconds || 0;
                        return timeB - timeA;
                    }));
                    setLoading(false);
                });
            } catch (error) {
                console.error("Error fetching trades:", error);
                setLoading(false);
            }
        };

        startTradesListener();
        return () => {
            if (unsubscribeTrades) unsubscribeTrades();
        };
    }, [isAdmin, user?.uid, config?.p2p_global_enabled]);

    return (
        <div className="min-h-screen bg-black pt-12">
            <SEO
                title={TEXTS.global.common.seo.activity.title}
                description={TEXTS.global.common.seo.activity.desc}
                image={TEXTS.global.common.seo.activity.ogImage}
                url="https://oldiebutgoldie.com.ar/comercio"
                schema={{
                    "@context": "https://schema.org",
                    "@type": "CollectionPage",
                    "name": TEXTS.comercio.publicActivity.activityName,
                    "description": TEXTS.comercio.publicActivity.activityFeedDesc,
                    "keywords": TEXTS.global.common.seo.activity.keys
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
                        <span className="text-xs font-mono text-gray-300 uppercase tracking-wider">{TEXTS.comercio.publicActivity.verifiedFeed}</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl md:text-5xl font-black font-display tracking-tightest leading-tight"
                    >
                        {TEXTS.comercio.publicActivity.recentActivity.split(' ').slice(0, -1).join(' ')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/40">{TEXTS.comercio.publicActivity.recentActivity.split(' ').slice(-1)}</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-gray-400 max-w-xl text-sm leading-relaxed"
                    >
                        {TEXTS.comercio.publicActivity.exploreDiscs}
                    </motion.p>
                </header>

                {config?.allow_p2p_public_offers && (
                    <div className="py-6 border-y border-white/5 bg-black/50 backdrop-blur-md">
                        <SocialRadar />
                    </div>
                )}

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
                            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                                <Disc className="w-16 h-16 text-white/10 mb-2 animate-[spin_10s_linear_infinite]" />
                                <h3 className="text-xl font-display font-black text-white uppercase tracking-widest">
                                    {config?.allow_p2p_public_offers === false ? "Mercado en Mantenimiento" : TEXTS.comercio.publicActivity.noActivity}
                                </h3>
                                <p className="text-gray-500 font-medium max-w-md">
                                    {config?.allow_p2p_public_offers === false
                                        ? "El mercado global P2P está desactivado temporalmente. Solo podés ver tus propias negociaciones privadas en este momento."
                                        : TEXTS.comercio.publicActivity.noPublicOrders}
                                </p>
                            </div>
                        )}
                    </motion.section>
                )}
            </div>
        </div>
    );
}
