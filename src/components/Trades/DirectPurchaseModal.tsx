import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, MessageCircle, ShoppingBag, Disc } from 'lucide-react';
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
    const [isProcessing, setIsProcessing] = useState(false);

    if (!order) return null;

    // Calculamos el precio sumando los items si totalPrice/details.price fallan
    const price = order.details?.price || order.totalPrice || order.items?.reduce((acc: number, item: any) => acc + (item.price || 0), 0) || 0;
    const currency = order.currency || order.details?.currency || "ARS";
    const image = order.thumbnailUrl || order.details?.cover_image;

    const handleConfirm = async () => {
        if (!user || !dbUser?.username || isProcessing) return;

        setIsProcessing(true);
        showLoading("Procesando compra...");

        try {
            await tradeService.executeDirectPurchase(order.id, user.uid, dbUser.username);
            onClose();
            navigate(`/orden/${order.id}`);
        } catch (error: any) {
            console.error("Purchase error:", error);
            alert(error.message || "Error al procesar la compra");
        } finally {
            setIsProcessing(false);
            hideLoading();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
                    >
                        {/* Header */}
                        <div className="p-8 border-b border-white/5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                    Compra Directa
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                                    <X size={20} className="text-gray-500" />
                                </button>
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-3xl font-display font-black text-white uppercase tracking-tighter">Confirmar Compra</h2>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Estás a un paso de obtener esta pieza</p>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-8 space-y-8">
                            {/* Item Preview */}
                            <div className="flex gap-6 items-center">
                                <div className="w-24 h-24 rounded-2xl overflow-hidden border border-white/10 flex-shrink-0 bg-black/40">
                                    {image ? (
                                        <LazyImage src={image} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Disc className="w-10 h-10 text-white/5" />
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1 min-w-0">
                                    <h3 className="text-xl font-black text-white uppercase truncate">{order.album || order.details?.album}</h3>
                                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest truncate">{order.artist || order.details?.artist}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-bold text-gray-400 border border-white/10">
                                            {order.items?.[0]?.condition || 'VG+'}
                                        </span>
                                        <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-bold text-gray-400 border border-white/10">
                                            {order.items?.[0]?.format || 'Vinyl'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Price Summary */}
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Precio del ítem</span>
                                    <span className="text-lg font-mono font-bold text-white">
                                        {currency === 'USD' ? 'US$' : '$'} {price.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                    <span className="text-xs font-black text-white uppercase tracking-widest">Total a pagar</span>
                                    <span className="text-3xl font-mono font-black text-primary">
                                        {currency === 'USD' ? 'US$' : '$'} {price.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* Safety Info */}
                            <div className="flex gap-4 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                                <ShieldCheck className="w-6 h-6 text-blue-400 flex-shrink-0" />
                                <div className="space-y-1">
                                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Transacción Protegida</h4>
                                    <p className="text-[10px] font-bold text-blue-400/60 uppercase leading-relaxed">
                                        Al confirmar, se abrirá un chat directo con el vendedor para coordinar el pago y envío.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-8 pt-0 flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 py-5 rounded-2xl border border-white/10 text-white font-black uppercase text-xs tracking-widest hover:bg-white/5 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={isProcessing || !user}
                                className="flex-[2] py-5 rounded-2xl bg-primary text-black font-black uppercase text-xs tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 shadow-[0_0_40px_rgba(204,255,0,0.2)]"
                            >
                                {isProcessing ? (
                                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <MessageCircle size={16} />
                                        Confirmar y Chatear
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
