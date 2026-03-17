import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Trophy, MessageSquare } from "lucide-react";
import { tradeService } from "@/services/tradeService";
import { useAuth } from "@/context/AuthContext";

interface GlobalReviewModalProps {
    pendingTrades: any[];
}

export default function GlobalReviewModal({ pendingTrades }: GlobalReviewModalProps) {
    const { user } = useAuth();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (pendingTrades.length === 0) return null;

    const currentTrade = pendingTrades[0];
    const isVendedor = user?.uid === currentTrade.participants?.senderId || user?.uid === currentTrade.user_id;
    
    // Resolve other participant name
    const otherName = isVendedor 
        ? (currentTrade.buyerUsername || currentTrade.buyer_name || "el comprador")
        : (currentTrade.sellerUsername || currentTrade.seller_name || "el vendedor");

    const tradeTitle = currentTrade.details?.album || currentTrade.manifest?.items?.[0]?.title || "disco";

    const handleSubmit = async () => {
        if (rating === 0 || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await tradeService.submitTradeReview(currentTrade.id, {
                reviewer_uid: user!.uid,
                reviewee_uid: isVendedor ? (currentTrade.participants?.receiverId || currentTrade.buyer_uid) : (currentTrade.participants?.senderId || currentTrade.user_id),
                rating,
                comment: comment.trim()
            });
            // Reset state for next pending trade if any
            setRating(0);
            setComment("");
        } catch (error) {
            console.error("Global Review Submit Error:", error);
            alert("Error al enviar la calificación. Intenta de nuevo.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-[1000] bg-black flex items-center justify-center p-6 backdrop-blur-xl"
            >
                <div className="w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-10 shadow-2xl space-y-8 text-center relative overflow-hidden">
                    {/* Background Decorative */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-white to-primary opacity-50" />
                    
                    <div className="space-y-4">
                        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20">
                            <Trophy className="w-10 h-10 text-primary" />
                        </div>
                        <h2 className="text-3xl font-display font-black text-white uppercase tracking-tighter">¡Transacción Completada!</h2>
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                            Para seguir operando, califica tu experiencia con <span className="text-primary">@{otherName}</span> por <span className="text-white">"{tradeTitle}"</span>.
                        </p>
                    </div>

                    {/* Star Rating Section */}
                    <div className="flex justify-center gap-3">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                onClick={() => setRating(star)}
                                className="transition-all hover:scale-125 active:scale-95"
                            >
                                <Star
                                    className={`w-12 h-12 ${
                                        star <= rating
                                            ? 'fill-primary text-primary drop-shadow-[0_0_15px_rgba(204,255,0,0.4)]'
                                            : 'text-white/5'
                                    } transition-colors duration-300`}
                                />
                            </button>
                        ))}
                    </div>

                    {/* Feedback Area */}
                    <div className="space-y-4 text-left">
                        <div className="relative group">
                            <div className="absolute left-4 top-4 text-gray-500 group-focus-within:text-primary transition-colors">
                                <MessageSquare className="w-4 h-4" />
                            </div>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Escribe una breve reseña (opcional)..."
                                maxLength={140}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-12 text-sm text-white focus:border-primary/50 outline-none transition-all h-28 resize-none placeholder:text-gray-700"
                            />
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={rating === 0 || isSubmitting}
                            className="w-full py-5 bg-primary text-black rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 disabled:opacity-30 disabled:grayscale disabled:scale-100"
                        >
                            {isSubmitting ? "Enviando Reseña..." : "Finalizar y Continuar →"}
                        </button>
                    </div>

                    <p className="text-[9px] font-black text-gray-700 uppercase tracking-widest italic">
                        El sistema de reputación es la base de la confianza P2P.
                    </p>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
