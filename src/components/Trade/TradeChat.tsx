import { useState, useEffect, useRef } from "react";
import { Send, User as UserIcon, Star, X, CheckCircle2 } from "lucide-react";
import { tradeService } from "@/services/tradeService";
import { formatDate } from "@/utils/date";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
    id: string;
    sender_uid: string;
    text: string;
    timestamp: any;
    read_status: boolean;
}

interface TradeChatProps {
    tradeId: string;
    currentUser: any;
    trade: any;
    otherParticipantName: string;
    conversationId?: string; // Standardized: Always includes @username
}

export default function TradeChat({ tradeId, currentUser, trade, otherParticipantName, conversationId }: TradeChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Rating Modal State
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);

    const isComprador = currentUser?.uid === trade?.buyerId || 
                       currentUser?.uid === trade?.buyer_uid ||
                       currentUser?.uid === trade?.participants?.senderId ||
                       currentUser?.uid === trade?.highest_bidder_uid;
    
    const isVendedor = currentUser?.uid === trade?.sellerId ||
                      currentUser?.uid === trade?.participants?.receiverId ||
                      currentUser?.uid === trade?.owner_uid ||
                      currentUser?.uid === trade?.user_id;
    
    const isCompleted = trade?.status === 'completed' || trade?.status === 'venta_finalizada';

    useEffect(() => {
        const callback = (msgs: Message[]) => {
            setMessages(msgs);
            setTimeout(() => {
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
            }, 100);
        };

        if (!tradeId) {
            console.warn("[TradeChat] tradeId is missing, skipping listener.");
            return;
        }

        const unsub = conversationId 
            ? tradeService.onSnapshotPrivateMessages(tradeId, conversationId, callback)
            : tradeService.onSnapshotMessages(tradeId, callback);
            
        return () => {
            if (unsub) unsub();
        };
    }, [tradeId, conversationId]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || isSending || isCompleted) return;

        setIsSending(true);
        try {
            if (conversationId) {
                await tradeService.sendPrivateMessage(tradeId, conversationId, currentUser.uid, newMessage.trim());
            } else {
                await tradeService.sendMessage(tradeId, currentUser.uid, newMessage.trim());
            }
            setNewMessage("");
        } catch (error) {
            console.error("Chat error:", error);
        } finally {
            setIsSending(false);
        }
    };

    const handleSubmitReview = async () => {
        if (rating === 0 || isSubmittingReview) return;
        setIsSubmittingReview(true);
        try {
            await tradeService.submitTradeReview(tradeId, {
                reviewer_uid: currentUser.uid,
                reviewee_uid: trade.owner_uid || trade.user_id, // Owner is the reviewee
                rating,
                comment: comment.trim()
            });
            setShowRatingModal(false);
        } catch (error) {
            console.error("Review submit error:", error);
            alert("Error al enviar la calificación");
        } finally {
            setIsSubmittingReview(false);
        }
    };

    return (
        <div className="flex flex-col h-[500px] bg-neutral-900/50 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-md shadow-2xl relative">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                        <UserIcon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-widest">{otherParticipantName}</h4>
                        <p className={`text-[10px] font-bold uppercase ${isCompleted ? 'text-gray-500' : 'text-emerald-500 animate-pulse'}`}>
                            {isCompleted ? 'Transacción Finalizada' : 'En línea'}
                        </p>
                    </div>
                </div>

                {isComprador && trade?.status === 'accepted' && (
                    <button 
                        onClick={() => setShowRatingModal(true)}
                        className="px-4 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-xl text-primary text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                        Finalizar y Calificar
                    </button>
                )}
            </div>

            {/* Messages Area */}
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar scroll-smooth"
            >
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-30">
                        <div className="w-12 h-12 rounded-full border border-dashed border-white/30 flex items-center justify-center">
                            <Send className="w-5 h-5" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">{isCompleted ? 'Conversación archivada' : 'Inicia la conversación para coordinar la entrega'}</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.sender_uid === currentUser.uid;
                        return (
                            <div 
                                key={msg.id} 
                                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
                            >
                                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${
                                    isMe 
                                    ? 'bg-primary text-black font-bold rounded-tr-none' 
                                    : 'bg-white/10 text-white font-medium rounded-tl-none border border-white/5'
                                } shadow-lg`}>
                                    {msg.text}
                                </div>
                                <span className="text-[8px] text-gray-500 font-mono uppercase px-1">
                                    {formatDate(msg.timestamp)}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} className="p-4 bg-white/[0.02] border-t border-white/5">
                <div className="relative group">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={isCompleted ? "Esta conversación está cerrada" : "Escribe un mensaje..."}
                        disabled={isCompleted}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-5 pr-14 text-sm text-white focus:border-primary/50 outline-none transition-all placeholder:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || isSending || isCompleted}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:scale-100"
                    >
                        {isSending ? (
                            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </form>

            {/* Rating Modal */}
            <AnimatePresence>
                {showRatingModal && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 bg-black/90 backdrop-blur-md flex items-center justify-center p-6"
                    >
                        <div className="w-full max-w-sm space-y-8 text-center">
                            <div className="space-y-2">
                                <Trophy className="w-12 h-12 text-primary mx-auto mb-4" />
                                <h3 className="text-2xl font-display font-black text-white uppercase tracking-tighter">Calificar Experiencia</h3>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">¿Cómo fue el trato con {otherParticipantName}?</p>
                            </div>

                            <div className="flex justify-center gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        onClick={() => setRating(star)}
                                        onMouseEnter={() => !rating && setRating(star)}
                                        onMouseLeave={() => !rating && setRating(0)}
                                        className="transition-transform hover:scale-125"
                                    >
                                        <Star 
                                            className={`w-10 h-10 ${
                                                star <= rating 
                                                ? 'fill-primary text-primary drop-shadow-[0_0_10px_rgba(204,255,0,0.3)]' 
                                                : 'text-white/10'
                                            } transition-all`} 
                                        />
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-4">
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="Comentario opcional (máx 140 caracteres)..."
                                    maxLength={140}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-primary/50 outline-none transition-all h-24 resize-none"
                                />

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowRatingModal(false)}
                                        className="flex-1 py-4 bg-white/5 border border-white/10 rounded-xl text-gray-400 font-black uppercase text-[10px] tracking-widest hover:bg-white/10"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSubmitReview}
                                        disabled={rating === 0 || isSubmittingReview}
                                        className="flex-1 py-4 bg-primary text-black rounded-xl font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
                                    >
                                        {isSubmittingReview ? "Enviando..." : "Finalizar Trato"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function Trophy(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
    )
}
