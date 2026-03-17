import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Search, 
    MessageSquare, 
    User, 
    Clock, 
    ChevronRight,
    ArrowLeft,
    Inbox,
    ShieldCheck
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { tradeService } from "@/services/tradeService";
import TradeChat from "@/components/Trade/TradeChat";
import { formatDate } from "@/utils/date";
import { LazyImage } from "@/components/ui/LazyImage";
import { useSearchParams } from "react-router-dom";

export default function MessageCenter() {
    const { user, dbUser } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedConv, setSelectedConv] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState("");

    const chatIdFromUrl = searchParams.get("chat");

    useEffect(() => {
        if (!user) return;

        setLoading(true);
        console.log("[InboxV2] Initializing modern snapshot for:", user.uid);
        
        const unsub = tradeService.onSnapshotP2PChats(user.uid, (chats) => {
            console.log("[InboxV2] Chats received:", chats.length);
            setConversations(chats);
            
            // Auto-Apertura (Protocolo V56.2: Búsqueda Híbrida Inteligente)
            if (chatIdFromUrl) {
                const targetChat = chats.find(c => 
                    c.id === chatIdFromUrl || 
                    c.tradeId === chatIdFromUrl || 
                    c.id?.includes(chatIdFromUrl)
                );
                
                if (targetChat) {
                    console.log("[InboxV2] Auto-selecting target chat:", targetChat.id);
                    setSelectedConv(targetChat);
                } else {
                    console.warn("[InboxV2] No matching chat found for URL ID:", chatIdFromUrl);
                    // Prohibición V56.2: No redireccionar a /perfil. Simplemente renderizar bandeja general.
                }
            }
            setLoading(false);
        });

        return () => unsub();
    }, [user, chatIdFromUrl]);

    const filteredConversations = conversations.filter(c => 
        c.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.buyerUsername?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.sellerUsername?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!user) return null;

    return (
        <div className="min-h-[80vh] flex flex-col md:flex-row bg-[#0A0A0A] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl my-8">
            {/* Left Column: Sidebar / Conversation List */}
            <div className={`w-full md:w-[380px] border-r border-white/5 flex flex-col ${selectedConv && 'hidden md:flex'}`}>
                <div className="p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-display font-black text-white uppercase tracking-tighter">Mensajes</h2>
                        <Inbox className="w-5 h-5 text-primary" />
                    </div>

                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input 
                            type="text"
                            placeholder="Buscar chats..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-xs text-white focus:border-primary/40 outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-8 space-y-2">
                    {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-20 bg-white/[0.02] rounded-2xl animate-pulse" />
                        ))
                    ) : filteredConversations.length === 0 ? (
                        <div className="py-20 text-center space-y-4 opacity-30">
                            <MessageSquare className="w-8 h-8 mx-auto text-gray-500" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No hay conversaciones</p>
                        </div>
                    ) : (
                        filteredConversations.map((conv) => {
                            const isMeSeller = conv.sellerId === user.uid;
                            const otherPartyName = isMeSeller ? conv.buyerUsername : (conv.sellerUsername || "Vendedor");
                            const isSelected = selectedConv?.id === conv.id;

                            return (
                                <button
                                    key={conv.id}
                                    onClick={() => setSelectedConv(conv)}
                                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all group ${
                                        isSelected 
                                        ? 'bg-primary text-black' 
                                        : 'hover:bg-white/[0.05] text-white'
                                    }`}
                                >
                                    <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/10 overflow-hidden flex-shrink-0">
                                        {conv.cover ? (
                                            <LazyImage src={conv.cover} alt={conv.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <User className="w-5 h-5 opacity-20" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0 text-left space-y-0.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className={`text-[10px] font-black uppercase tracking-widest truncate ${isSelected ? 'text-black' : 'text-primary'}`}>
                                                {conv.title}
                                            </p>
                                            <span className={`text-[8px] font-bold shrink-0 ${isSelected ? 'text-black/60' : 'text-gray-600'}`}>
                                                {formatDate(conv.timestamp)}
                                            </span>
                                        </div>
                                        <p className="text-xs font-bold truncate">
                                            {conv.sellerId === user.uid ? (conv.buyerUsername || conv.buyerName || "Cliente") : (conv.sellerUsername || conv.sellerName || "Vendedor")}
                                        </p>
                                        <p className={`text-[10px] truncate ${isSelected ? 'text-black/70' : 'text-gray-500'}`}>
                                            {conv.lastMessage}
                                        </p>
                                    </div>
                                    <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'text-black scale-110' : 'text-gray-800 group-hover:translate-x-1'}`} />
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right Column: Active Chat */}
            <div className={`flex-1 flex flex-col bg-white/[0.01] ${!selectedConv && 'hidden md:flex'}`}>
                {selectedConv ? (
                    <div className="h-full flex flex-col">
                        {/* Chat Header (Mobile back button) */}
                        <div className="p-6 border-b border-white/5 flex items-center gap-4">
                            <button 
                                onClick={() => setSelectedConv(null)}
                                className="md:hidden p-2 bg-white/5 rounded-xl text-white"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            
                            <div className="flex-1 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 overflow-hidden">
                                     {selectedConv.cover && <LazyImage src={selectedConv.cover} alt={selectedConv.title} className="w-full h-full object-cover" />}
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-widest">{selectedConv.title}</h3>
                                    <div className="flex items-center gap-2">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase">
                                            Chat con {selectedConv.sellerId === user.uid ? (selectedConv.buyerUsername || selectedConv.buyerName || "Cliente") : (selectedConv.sellerUsername || selectedConv.sellerName || "Vendedor")}
                                        </p>
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-full">
                                            <ShieldCheck className="w-2.5 h-2.5 text-primary" />
                                            <span className="text-[8px] font-black text-primary uppercase">Transacción Segura</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Integrated TradeChat */}
                        <div className="flex-1 p-6">
                            <TradeChat 
                                tradeId={selectedConv.tradeId}
                                currentUser={user}
                                trade={{ 
                                    status: selectedConv.status,
                                    buyerId: selectedConv.buyerId,
                                    sellerId: selectedConv.sellerId,
                                    owner_uid: selectedConv.sellerId, // Needed for reviews
                                    participants: {
                                        senderId: selectedConv.buyerId,
                                        receiverId: selectedConv.sellerId
                                    }
                                }}
                                otherParticipantName={selectedConv.sellerId === user.uid ? (selectedConv.buyerUsername || selectedConv.buyerName || "Cliente") : (selectedConv.sellerUsername || selectedConv.sellerName || "Vendedor")}
                                conversationId={selectedConv.buyerUsername}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-6">
                        <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/10">
                            <MessageSquare className="w-8 h-8 text-primary opacity-50" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-display font-black text-white uppercase tracking-tighter">Bandeja de Entrada</h3>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest max-w-[240px] leading-relaxed">
                                Selecciona una conversación para coordinar el pago y envío de tus discos.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
