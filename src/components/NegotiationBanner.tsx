import React from 'react';
import { motion } from 'framer-motion';
import { Handshake, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from "@/lib/utils";

interface NegotiationBannerProps {
    readonly adminPrice: number;
    readonly currency: string;
    readonly onAccept: () => void;
    readonly onReject: () => void;
    readonly isSubmitting?: boolean;
    readonly className?: string;
}

/**
 * NegotiationBanner - A responsive banner for user-admin price negotiation.
 * Follows the "Modern Industrial Vinyl" design system.
 */
export const NegotiationBanner: React.FC<NegotiationBannerProps> = ({
    adminPrice,
    currency,
    onAccept,
    onReject,
    isSubmitting = false,
    className
}) => {
    if (adminPrice <= 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "bg-[#0A0A0A] border-2 border-orange-500/40 rounded-3xl p-5 md:p-6 shadow-[0_0_50px_rgba(249,146,60,0.15)] overflow-hidden relative",
                className
            )}
        >
            {/* Background Accent */}
            <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none">
                <Handshake size={120} />
            </div>

            <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
                {/* Info Section */}
                <div className="flex-1 space-y-2 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2">
                        <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                            <Handshake className="h-3 w-3" />
                            Oferta de OBG
                        </span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-display font-black text-white uppercase tracking-tighter">
                        Propuesta Recibida
                    </h3>
                    <p className="text-sm text-gray-400 font-medium">
                        Oldie but Goldie ha definido un precio para tu lote.
                    </p>
                </div>

                {/* Price Display */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center min-w-[140px]">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Precio Final</span>
                    <span className="text-2xl font-mono font-black text-primary">
                        {currency === 'USD' ? 'US$' : '$'}{adminPrice.toLocaleString()}
                    </span>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <button
                        onClick={onAccept}
                        disabled={isSubmitting}
                        className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-black px-6 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2 group shadow-lg shadow-primary/20"
                    >
                        {isSubmitting ? (
                            <div className="h-4 w-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                        ) : (
                            <>
                                <CheckCircle2 className="h-4 w-4" />
                                Aceptar Oferta
                            </>
                        )}
                    </button>
                    <button
                        onClick={onReject}
                        disabled={isSubmitting}
                        className="flex-1 sm:flex-none bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                        <XCircle className="h-4 w-4" />
                        Rechazar
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

export default NegotiationBanner;
