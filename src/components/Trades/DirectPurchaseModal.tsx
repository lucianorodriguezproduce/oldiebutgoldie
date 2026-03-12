import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, X, CheckCircle2, MessageSquare, Disc, User } from 'lucide-react';
import { tradeService } from '@/services/tradeService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useLoading } from '@/context/LoadingContext';
import { LazyImage } from '@/components/ui/LazyImage';

interface DirectPurchaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: any;
}

export default function DirectPurchaseModal({ isOpen, onClose, order }: DirectPurchaseModalProps) {
    const { user, dbUser } = useAuth();
    const navigate = useNavigate();
    const { showLoading, hideLoading } = useLoading();
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!order) return null;

    const price = order.totalPrice || order.details?.price || 0;
    const currency = order.currency || order.details?.currency || "ARS";
    const artist = order.artist || order.details?.artist;
    const album = order.album || order.details?.album;
    const image = order.thumbnailUrl || order.details?.cover_image || order.image;
    const sellerName = order.participants?.senderName || order.user_name || "Comunidad OBG";

    const handleConfirm = async () => {
        if (!user || !dbUser?.username || isSubmitting) return;

        setIsSubmitting(true);
        showLoading("Procesando compra...");

        try {
            await tradeService.executeDirectPurchase(order.id, user.uid, dbUser.username);
            onClose();
            navigate(`/orden/${order.id}`);
        } catch (error: any) {
            console.error("Purchase error:", error);
            alert(error.message || "Error al procesar la compra");
        } finally {
            setIsSubmitting(false);
            hideLoading();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
                    {/* Overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg bg-white/[0.03] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-primary/10"
                    >
                        {/* Header */}
                        <div className="p-6 md:p-8 flex items-center justify-between border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <ShoppingBag className="w-5 h-5 text-primary" />
                                </div>
                                <h2 className="text-xl font-display font-black text-white uppercase tracking-widest">Confirmar Compra</h2>
                            </div>
                            <button 
                                onClick={onClose}
                                className="p-2 hover:bg-white/5 rounded-full transition-colors group"
                            >
                                <X className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
                            </button>
                        </div>

                        {/* Order Preview */}
                        <div className="p-6 md:p-8 space-y-8">
                            <div className="flex items-center gap-6">
                                <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden border border-white/10 bg-black/40 flex-shrink-0 shadow-lg relative">
                                    {image ? (
                                        <LazyImage src={image} alt={album} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Disc className="w-10 h-10 text-white/10" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 space-y-2">
                                    <h3 className="text-xl md:text-2xl font-display font-black text-white uppercase tracking-tight truncate leading-tight">
                                        {artist || album}
                                    </h3>
                                    {artist && album && (
                                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest truncate opacity-80">
                                            {album}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2 pt-2 text-gray-400">
                                        <User className="w-4 h-4" />
                                        <span className="text-xs font-black uppercase tracking-widest">{sellerName}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Price Section */}
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 flex items-center justify-between group-hover:border-primary/20 transition-all">
                                <span className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Total a Pagar</span>
                                <div className="text-3xl font-display font-black text-primary">
                                    {currency === 'USD' ? 'US$' : '$'} {price.toLocaleString()}
                                </div>
                            </div>
                        </div>

                        {/* Footer / Action */}
                        <div className="p-6 md:p-8 pt-0">
                            <button
                                onClick={handleConfirm}
                                disabled={isSubmitting || !user}
                                className="relative w-full group overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary transition-all duration-300 group-hover:scale-105" />
                                <div className="relative px-8 py-5 flex items-center justify-center gap-3">
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <MessageSquare className="w-5 h-5 text-black" />
                                            <span className="text-black font-black uppercase tracking-[0.15em] text-sm">Confirmar y Chatear</span>
                                        </>
                                    )}
                                </div>
                            </button>
                            <p className="mt-4 text-center text-[10px] text-gray-500 font-bold uppercase tracking-widest opacity-60">
                                Al confirmar, el trato quedará cerrado y se abrirá el chat de coordinación.
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
