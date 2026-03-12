import { useState, useEffect, useRef } from "react";
import { Send, User as UserIcon } from "lucide-react";
import { tradeService } from "@/services/tradeService";
import { formatDate } from "@/utils/date";

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
    otherParticipantName: string;
}

export default function TradeChat({ tradeId, currentUser, otherParticipantName }: TradeChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsub = tradeService.onSnapshotMessages(tradeId, (msgs) => {
            setMessages(msgs);
            // Autofocus/scroll to bottom on new messages
            setTimeout(() => {
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
            }, 100);
        });
        return () => unsub();
    }, [tradeId]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || isSending) return;

        setIsSending(true);
        try {
            await tradeService.sendMessage(tradeId, currentUser.uid, newMessage.trim());
            setNewMessage("");
        } catch (error) {
            console.error("Chat error:", error);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="flex flex-col h-[500px] bg-neutral-900/50 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-md shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                        <UserIcon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-widest">{otherParticipantName}</h4>
                        <p className="text-[10px] text-emerald-500 font-bold uppercase animate-pulse">En línea</p>
                    </div>
                </div>
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
                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Inicia la conversación para coordinar la entrega</p>
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
                        placeholder="Escribe un mensaje..."
                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-5 pr-14 text-sm text-white focus:border-primary/50 outline-none transition-all placeholder:text-gray-600"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || isSending}
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
        </div>
    );
}
