import { useState } from "react";
import {
    Handshake,
    ArrowRightLeft,
    CheckCircle2,
    XCircle,
    Clock,
    User,
    DollarSign,
    AlertCircle,
    Disc,
    Edit2,
    Users,
    MessageSquare,
    Trophy
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { tradeService } from "@/services/tradeService";
import TradeChat from "./TradeChat";
import type { Trade, TradeManifest } from "@/types/inventory";
import { useLoading } from "@/context/LoadingContext";
import { useAuth } from "@/context/AuthContext";
import { ADMIN_UID, isAdminEmail } from "@/constants/admin";
import ManifestEditor from "./ManifestEditor";
import { useEffect } from "react";

interface TradeConsoleProps {
    trade: Trade;
    onUpdate: () => void;
    onClose: () => void;
}

export default function TradeConsole({ trade, onUpdate, onClose }: TradeConsoleProps) {
    const { showLoading, hideLoading } = useLoading();
    const { user, dbUser } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [editedManifest, setEditedManifest] = useState<TradeManifest | null>(null);

    // Multi-chat management
    const [conversations, setConversations] = useState<any[]>([]);
    const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);

    const isAdmin = isAdminEmail(user?.email) || user?.uid === ADMIN_UID;
    const isOwner = user?.uid === trade.participants.senderId || user?.uid === trade.participants.receiverId;
    const isDirectSale = trade.type === 'direct_sale';
    
    // isMyTurn logic
    const isMyTurn = trade.currentTurn === user?.uid || (trade.currentTurn === 'admin' && isAdmin) || (trade.currentTurn === ADMIN_UID && isAdmin);

    useEffect(() => {
        if (isDirectSale && (isOwner || isAdmin) && trade.id) {
            const unsub = tradeService.onSnapshotConversations(trade.id, (convs) => {
                setConversations(convs);
                if (convs.length > 0 && !selectedBuyerId) {
                    setSelectedBuyerId(convs[0].buyerId);
                }
            });
            return () => unsub();
        }
    }, [trade.id, isDirectSale, isOwner, isAdmin]);

    const selectedConv = conversations.find(c => c.buyerId === selectedBuyerId);

    // Admin can always action if the status is counter_offer or contraoferta_usuario
    const canAction = (trade.status !== 'accepted' && trade.status !== 'completed' && trade.status !== 'cancelled' && isMyTurn) ||
        (isAdmin && ['counter_offer', 'contraoferta_usuario', 'contraofertado', 'completed_unpaid', 'in_process'].includes(trade.status));

    const handleAcceptTrade = async () => {
        if (!trade.id) return;
        const confirm = window.confirm("¿Confirmar resolución de Trade? Esto gestionará el stock y los activos según el tipo de operación.");
        if (!confirm) return;

        showLoading("Resolviendo transacción...");
        try {
            await tradeService.resolveTrade(trade.id, trade.manifest);
            alert("Operación procesada correctamente.");
            onUpdate();
            onClose();
        } catch (error: any) {
            console.error("Error accepting trade:", error);
            alert(`Error crítico: ${error.message}`);
        } finally {
            hideLoading();
        }
    };

    const handleMarkAsPaid = async () => {
        if (!trade.id) return;
        if (!window.confirm("¿Confirmar que este pedido ha sido pagado? El estado pasará a COMPLETADO.")) return;
        
        showLoading("Actualizando estado de pago...");
        try {
            await tradeService.updateTradeStatus(trade.id, 'completed');
            alert("Pedido marcado como PAGADO.");
            onUpdate();
            onClose();
        } catch (error) {
            console.error("Error marking as paid:", error);
        } finally {
            hideLoading();
        }
    };

    const handleFoundRequest = async () => {
        if (!trade.id) return;
        if (!window.confirm("¿Confirmar que el hallazgo ha sido completado? Pasará a PENDIENTE DE PAGO.")) return;

        showLoading("Actualizando hallazgo...");
        try {
            await tradeService.updateTradeStatus(trade.id, 'completed_unpaid');
            alert("El hallazgo ahora está pendiente de pago.");
            onUpdate();
            onClose();
        } catch (error) {
            console.error("Error updating finding status:", error);
        } finally {
            hideLoading();
        }
    };

    const handleCounterOffer = async () => {
        if (!trade.id || !editedManifest || !user) return;

        showLoading("Enviando contra-oferta...");
        try {
            await tradeService.counterTrade(trade.id, editedManifest, user.uid, isAdmin);
            alert("Contra-oferta enviada correctamente.");
            setIsEditing(false);
            onUpdate();
            onClose();
        } catch (error: any) {
            console.error("Error sending counter offer:", error);
            alert(`Error: ${error.message}`);
        } finally {
            hideLoading();
        }
    };

    const handleDeclineTrade = async () => {
        if (!trade.id) return;
        if (!window.confirm("¿Rechazar esta propuesta de intercambio?")) return;

        showLoading("Cancelando trade...");
        try {
            await tradeService.updateTradeStatus(trade.id, 'cancelled');
            onUpdate();
            onClose();
        } catch (error) {
            console.error("Error declining trade:", error);
        } finally {
            hideLoading();
        }
    };

    const handleAdjudicate = async () => {
        if (!trade.id || !selectedBuyerId || !selectedConv) return;
        if (!window.confirm(`¿Confirmar venta a @${selectedConv.buyerName}? Esto cerrará la publicación para otros interesados.`)) return;

        showLoading("Adjudicando venta...");
        try {
            await tradeService.adjudicateTrade(trade.id, selectedBuyerId, selectedConv.buyerName);
            alert("¡Venta adjudicada con éxito! Coordiná los detalles finales en el chat.");
            onUpdate();
        } catch (error: any) {
            console.error("Adjudication error:", error);
            alert(`Error: ${error.message}`);
        } finally {
            hideLoading();
        }
    };

    const getStatusBadge = (status: Trade['status']) => {
        switch (status) {
            case 'pending':
                return <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse"><Clock className="h-3 w-3" /> PENDING</span>;
            case 'completed':
                return <span className="bg-green-500/10 text-green-500 border border-green-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> COMPLETADO</span>;
            case 'completed_unpaid':
                return <span className="bg-orange-500/10 text-orange-500 border border-orange-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse"><DollarSign className="h-3 w-3" /> PENDIENTE PAGO</span>;
            case 'in_process':
                return <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse"><Disc className="h-3 w-3" /> EN PROCESO (BÚSQUEDA)</span>;
            case 'accepted':
                return <span className="bg-orange-500/10 text-orange-500 border border-orange-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse"><Handshake className="h-3 w-3" /> PENDIENTE PAGO / COORDINANDO</span>;
            case 'cancelled':
                return <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5"><XCircle className="h-3 w-3" /> CANCELLED</span>;
            case 'counter_offer':
                return <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5"><ArrowRightLeft className="h-3 w-3" /> NEGOTIATING</span>;
            default:
                return status;
        }
    };

    return (
        <div className="p-8 space-y-8 flex flex-col h-full overflow-y-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                        {isEditing ? (
                            "Editando Propuesta"
                        ) : isDirectSale ? (
                            "Gestión de Venta Directa"
                        ) : (
                            trade.manifest.requestedItems.length > 0 && trade.manifest.offeredItems.length === 0 ? "Detalle de Compra" :
                            trade.manifest.offeredItems.length > 0 && trade.manifest.requestedItems.length === 0 ? "Detalle de Venta" :
                            "Detalle de Propuesta"
                        )}
                    </h3>
                    {getStatusBadge(trade.status)}
                </div>
                {!isDirectSale && (
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-xl">
                        Turno: {isMyTurn ? "Tú" : "Contraparte"}
                    </div>
                )}
            </div>

            {isDirectSale && (isOwner || isAdmin) && (trade.status === 'pending' || trade.status === 'accepted') ? (
                /* Multi-Conversation Interface */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Inquiry List Sidebar */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <Users className="w-4 h-4 text-primary" />
                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Interesados ({conversations.length})</h4>
                        </div>
                        <div className="space-y-2">
                            {conversations.length === 0 ? (
                                <div className="p-8 border border-dashed border-white/10 rounded-3xl text-center">
                                    <Clock className="w-8 h-8 text-white/10 mx-auto mb-2" />
                                    <p className="text-[10px] font-bold text-gray-600 uppercase">Sin consultas aún</p>
                                </div>
                            ) : (
                                conversations.map(conv => (
                                    <button
                                        key={conv.id}
                                        onClick={() => setSelectedBuyerId(conv.buyerId)}
                                        className={`w-full p-4 rounded-2xl border text-left transition-all ${
                                            selectedBuyerId === conv.buyerId 
                                            ? 'bg-primary/10 border-primary/50 shadow-lg shadow-primary/5' 
                                            : 'bg-white/5 border-white/5 hover:border-white/20'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-black text-white text-sm">@{conv.buyerName}</span>
                                            {conv.status === 'accepted' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                                        </div>
                                        <p className="text-[10px] text-gray-500 truncate font-bold uppercase tracking-tight">{conv.lastMessage}</p>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Active Conversation Chat */}
                    <div className="lg:col-span-2 space-y-6">
                        {selectedBuyerId ? (
                            <>
                                <div className="p-6 bg-white/[0.03] border border-white/10 rounded-[2.5rem] space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <MessageSquare className="w-5 h-5 text-primary" />
                                            <h4 className="text-sm font-black text-white uppercase tracking-tight">Chat con @{selectedConv?.buyerName}</h4>
                                        </div>
                                        <button
                                            onClick={handleAdjudicate}
                                            className="px-6 py-2.5 bg-primary text-black rounded-xl font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-all shadow-lg shadow-primary/20"
                                        >
                                            <Trophy className="w-3.5 h-3.5 inline mr-2" /> Adjudicar Venta
                                        </button>
                                    </div>
                                    <TradeChat 
                                        tradeId={trade.id!} 
                                        currentUser={user} 
                                        trade={trade} 
                                        otherParticipantName={`@${selectedConv?.buyerName}`} 
                                        conversationId={selectedConv?.buyerUsername}
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-30 text-center">
                                <Disc className="w-16 h-16 text-white animate-spin-slow" />
                                <p className="text-xs font-bold text-white uppercase tracking-widest">Selecciona un interesado para chatear</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Legacy / Exchange Manifest Editor */
                <>
                    <ManifestEditor
                        manifest={isEditing ? (editedManifest as TradeManifest) : trade.manifest}
                        onChange={(m) => setEditedManifest(m)}
                        isLocked={!isEditing}
                        myItems={[]}
                        theirItems={[]}
                    />

                    {canAction && (
                        <div className="flex gap-4 pt-8 pb-[env(safe-area-inset-bottom)] mb-4">
                            {isEditing ? (
                                <>
                                    <button
                                        onClick={handleCounterOffer}
                                        className="flex-1 flex items-center justify-center gap-3 py-4 bg-primary text-black rounded-2xl font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg shadow-primary/20"
                                    >
                                        <ArrowRightLeft className="h-5 w-5" /> Enviar Contra-Oferta
                                    </button>
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className="px-8 py-4 bg-white/5 text-gray-400 rounded-2xl font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                                    >
                                        Cancelar
                                    </button>
                                </>
                            ) : (
                                <>
                                    {(trade.status === 'completed_unpaid' || trade.status === 'accepted') && (isAdmin || isOwner) ? (
                                        <button
                                            onClick={handleMarkAsPaid}
                                            className="flex-1 flex items-center justify-center gap-3 py-4 bg-green-500 text-black rounded-2xl font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg shadow-green-500/20"
                                        >
                                            <DollarSign className="h-5 w-5" /> Confirmar Pago
                                        </button>
                                    ) : trade.status === 'in_process' && isAdmin ? (
                                        <button
                                            onClick={handleFoundRequest}
                                            className="flex-1 flex items-center justify-center gap-3 py-4 bg-primary text-black rounded-2xl font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg shadow-primary/20"
                                        >
                                            <CheckCircle2 className="h-5 w-5" /> Pedido Encontrado
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleAcceptTrade}
                                            className="flex-1 flex items-center justify-center gap-3 py-4 bg-primary text-black rounded-2xl font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg shadow-primary/20"
                                        >
                                            <CheckCircle2 className="h-5 w-5" /> Aceptar Propuesta
                                        </button>
                                    )}
                                    
                                    <button
                                        onClick={() => { setEditedManifest(trade.manifest); setIsEditing(true); }}
                                        className="flex-1 flex items-center justify-center gap-3 py-4 bg-white/5 text-white border border-white/10 rounded-2xl font-black uppercase tracking-widest hover:bg-primary hover:text-black transition-all"
                                    >
                                        <Edit2 className="h-5 w-5" /> Regatear
                                    </button>
                                    <button
                                        onClick={handleDeclineTrade}
                                        className="flex-1 flex items-center justify-center gap-3 py-4 bg-white/5 text-red-500 border border-red-500/20 rounded-2xl font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                                    >
                                        <XCircle className="h-5 w-5" /> Rechazar
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </>
            )}

            {!canAction && trade.status !== 'accepted' && trade.status !== 'cancelled' && !isDirectSale && (
                <div className="flex gap-4 pt-4">
                    <button
                        onClick={handleAcceptTrade}
                        className="flex-1 flex items-center justify-center gap-3 py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                    >
                        <AlertCircle className="h-5 w-5" /> Forzar Cierre Administrativo
                    </button>
                </div>
            )}

            {trade.status === 'accepted' && (
                <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-[2rem] flex items-center gap-4">
                    <div className="p-3 bg-green-500 rounded-2xl">
                        <CheckCircle2 className="h-6 w-6 text-black" />
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Trato Cerrado</p>
                        <p className="text-sm font-bold text-white">El comprador ha sido adjudicado exitosamente. Coordinen la entrega en el chat público.</p>
                    </div>
                </div>
            )}

            {!isMyTurn && trade.status !== 'accepted' && trade.status !== 'cancelled' && !isDirectSale && (
                <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] flex items-center gap-4">
                    <AlertCircle className="h-5 w-5 text-gray-500" />
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Esperando respuesta de la contraparte...</p>
                </div>
            )}
        </div>
    );
}
