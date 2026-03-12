import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, X, MessageSquare, Disc, DollarSign } from 'lucide-react';
import { tradeService } from '@/services/tradeService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useLoading } from '@/context/LoadingContext';
import { LazyImage } from '@/components/ui/LazyImage';

interface AuctionWinnerModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: any;
}

export default function AuctionWinnerModal({ isOpen, onClose, order }: AuctionWinnerModalProps) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { showLoading, hideLoading } = useLoading();
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!order) return null;

    const winnerName = order.highest_bidder_name || "Ganador";
    const winningAmount = order.current_highest_bid || order.starting_price || 0;
    const currency = order.currency || order.details?.currency || "ARS";
    const artist = order.artist || order.details?.artist;
    const album = order.album || order.details?.album;
    const image = order.thumbnailUrl || order.details?.cover_image || order.image;

    const handleConfirm = async () => {
        if (!user || isSubmitting) return;

        setIsSubmitting(true);
        showLoading("Cerrando subasta...");

        try {
            await tradeService.acceptWinningBid(order.id, user.uid);
            onClose();
            // We stay on the same page or navigate to the trade view? 
            // navigate(`/orden/${order.id}`) is already the current page in PublicOrderView
            // but we might need to refresh state. The onSnapshot in PublicOrderView should handle it.
        } catch (error: any) {
            console.error("Auction close error:", error);
            alert(error.message || "Error al cerrar la subasta");
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
                                    <Trophy className="w-5 h-5 text-primary" />
                                </div>
                                <h2 className="text-xl font-display font-black text-white uppercase tracking-widest">El Martillazo</h2>
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
                            <div className="text-center space-y-2">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Vas a adjudicar este disco a:</p>
                                <h3 className="text-2xl font-display font-black text-white uppercase tracking-tight">@{winnerName}</h3>
                            </div>

                            <div className="flex items-center gap-6 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                <div className="w-20 h-20 rounded-xl overflow-hidden border border-white/10 bg-black/40 flex-shrink-0 shadow-lg">
                                    {image ? (
                                        <LazyImage src={image} alt={album} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Disc className="w-8 h-8 text-white/10" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-lg font-display font-black text-white uppercase tracking-tight truncate">
                                        {artist || album}
                                    </h4>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">
                                        {album}
                                    </p>
                                </div>
                            </div>

                            {/* Price Section */}
                            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 flex flex-col items-center gap-1">
                                <span className="text-[10px] font-black text-primary/70 uppercase tracking-[0.2em]">Monto Final Adjudicado</span>
                                <div className="text-4xl font-display font-black text-white flex items-center gap-2">
                                    <DollarSign className="w-6 h-6 text-primary" />
                                    {winningAmount.toLocaleString()}
                                    <span className="text-sm text-primary/60 ml-1">{currency}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer / Action */}
                        <div className="p-6 md:p-8 pt-0">
                            <button
                                onClick={handleConfirm}
                                disabled={isSubmitting || !user}
                                className="relative w-full group overflow-hidden rounded-2xl"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary transition-all duration-300 group-hover:scale-105" />
                                <div className="relative px-8 py-5 flex items-center justify-center gap-3">
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <MessageSquare className="w-5 h-5 text-black" />
                                            <span className="text-black font-black uppercase tracking-[0.15em] text-sm">Cerrar Subasta y Chatear</span>
                                        </>
                                    )}
                                </div>
                            </button>
                            <p className="mt-4 text-center text-[10px] text-gray-500 font-bold uppercase tracking-widest opacity-60 px-4">
                                Al confirmar, la subasta se marcará como aceptada y se abrirá el chat con @{winnerName}.
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
