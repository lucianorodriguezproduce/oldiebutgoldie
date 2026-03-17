import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, MessageCircle, Disc } from 'lucide-react';
import { tradeService } from '@/services/tradeService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useLoading } from '@/context/LoadingContext';
import { LazyImage } from '@/components/ui/LazyImage';
import { getCleanOrderMetadata } from '@/utils/orderMetadata';
import UsernameClaimModal from '@/components/Profile/UsernameClaimModal';

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
    const [showClaimModal, setShowClaimModal] = useState(false);

    if (!order) return null;

    // Calculamos metadatos con el helper centralizado (V24.9)
    const meta = getCleanOrderMetadata(order);
    const price = meta.price || 0;
    const currency = meta.currency || "ARS";
    const image = meta.image;
    const { artist, album } = meta;

    const handleConfirm = async () => {
        if (!user || isProcessing) return;

        if (!dbUser?.username) {
            setShowClaimModal(true);
            return;
        }

        setIsProcessing(true);
        showLoading("Iniciando contacto...");

        try {
            // V49.0 ATOMIC IDENTITY: Ignore participant data from previous orders.
            // The source of truth is always the asset owner.
            let sellerId = order.ownerId || order.userAssetId || order.id;

            // Extra precaution: if it's a trade object, we seek the item owner inside the manifest/items
            if (order.manifest?.items?.[0]?.userAssetId) {
                sellerId = order.manifest.items[0].userAssetId;
            }

            console.log("[V49-PAYLOAD] Identificando Vendedor Real ->", sellerId);

            if (!sellerId || sellerId === 'O5bs8eTZQdwMMQ9P6eDbJyVEZV2') {
                console.error("[V49-FATAL] No se puede iniciar comercio P2P con identidad Admin o nula.");
                throw new Error("ERROR_PROPIEDAD_NO_VERIFICADA");
            }

            // Usamos el nuevo método de consulta en lugar de compra directa
            const tradeId = await tradeService.startInquiry(order.id, user.uid, dbUser.username, sellerId);
            onClose();
            // Redirect to messages instead of profile
            navigate(`/mensajes?chat=${tradeId}`);
        } catch (error: any) {
            console.error("[contact] Inquiry error:", error);
            alert(error.message || "Error al iniciar el contacto. Revisa tu conexión.");
        } finally {
            setIsProcessing(false);
            hideLoading();
        }
    };

    // Usamos Portals para evitar que el transform del padre (OrderCard) rompa el centrado
    return createPortal(
        <>
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/90 backdrop-blur-md"
                            onClick={onClose}
                        />
                        
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 40 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 40 }}
                            className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)]"
                        >
                            {/* Header Section */}
                            <div className="p-8 pb-4 flex items-center justify-between">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Contacto Directo</span>
                                </div>
                                <button 
                                    onClick={onClose} 
                                    className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all active:scale-95"
                                >
                                    <X size={18} className="text-gray-400" />
                                </button>
                            </div>

                            {/* Title Section */}
                            <div className="px-8 space-y-2">
                                <h2 className="text-4xl font-display font-black text-white uppercase tracking-tighter leading-none">Me <span className="text-primary">Interesa</span></h2>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-relaxed">Inicia un chat privado con el vendedor para coordinar</p>
                            </div>

                            {/* Body Summary */}
                            <div className="p-8 space-y-8">
                                {/* Item Information */}
                                <div className="flex gap-6 items-center bg-white/[0.03] p-4 rounded-3xl border border-white/5">
                                    <div className="w-24 h-24 rounded-2xl overflow-hidden border border-white/10 flex-shrink-0 shadow-2xl">
                                        {image ? (
                                            <LazyImage src={image} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-black/40">
                                                <Disc className="w-8 h-8 text-white/5" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-1.5 min-w-0">
                                        <h3 className="text-xl font-black text-white uppercase truncate tracking-tight">{album}</h3>
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest truncate opacity-80">{artist}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="px-2 py-0.5 rounded bg-primary/20 text-[9px] font-black text-primary border border-primary/30 uppercase tracking-tighter">
                                                {meta.condition}
                                            </span>
                                            <span className="px-2 py-0.5 rounded bg-white/5 text-[9px] font-black text-gray-400 border border-white/10 uppercase tracking-tighter">
                                                {meta.format}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Financial Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                                        <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Valor de Referencia</span>
                                        <p className="text-xl font-mono font-bold text-white/50">{currency === 'USD' ? 'US$' : '$'} {price.toLocaleString()}</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-1 text-right">
                                        <span className="text-[8px] font-black text-primary uppercase tracking-widest">Precio Publicado</span>
                                        <p className="text-3xl font-display font-black text-primary tracking-tighter">{currency === 'USD' ? 'US$' : '$'}{price.toLocaleString()}</p>
                                    </div>
                                </div>

                                {/* Security Pledge */}
                                <div className="flex gap-4 p-5 bg-[#0e1117] border border-blue-500/20 rounded-[2rem]">
                                    <ShieldCheck className="w-8 h-8 text-blue-400 flex-shrink-0 mt-1" />
                                    <div className="space-y-1">
                                        <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Mercado P2P Directo</h4>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase leading-relaxed tracking-tight">
                                            Al contactar, abrirás un chat privado con el vendedor. El disco seguirá público hasta que el vendedor te lo adjudique a vos.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* CTA Section */}
                            <div className="p-8 pt-0 flex gap-4">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-6 rounded-2xl border border-white/5 text-gray-500 font-black uppercase text-[10px] tracking-widest hover:bg-white/5 hover:text-white transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={isProcessing || !user}
                                    className="flex-[2] py-6 rounded-2xl bg-white text-black font-black uppercase text-[10px] tracking-[0.2em] hover:bg-primary transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-[0_20px_40px_rgba(255,255,255,0.05)] active:scale-95"
                                >
                                    {isProcessing ? (
                                        <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <MessageCircle size={18} />
                                            Contactar y Chatear
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <UsernameClaimModal 
                isOpen={showClaimModal}
                onClose={() => setShowClaimModal(false)}
                onSuccess={() => {
                    setShowClaimModal(false);
                    handleConfirm();
                }}
            />
        </>,
        document.body
    );
}
