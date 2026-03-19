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
    Trophy,
    Truck,
    Hash,
    Package,
    ClipboardCheck,
    Maximize2,
    Minimize2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { tradeService } from "@/services/tradeService";
import TradeChat from "./TradeChat";
import type { Trade, TradeManifest } from "@/types/inventory";
import { cn } from "@/lib/utils";
import { useLoading } from "@/context/LoadingContext";
import { useAuth } from "@/context/AuthContext";
import { ADMIN_UIDS, isAdminEmail } from "@/constants/admin";
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

    // Protocol V77.0: Logistics Management
    const [courier, setCourier] = useState(trade.logistics?.courier || "");
    const [trackingCode, setTrackingCode] = useState(trade.logistics?.tracking_code || "");
    const [isChatExpanded, setIsChatExpanded] = useState(false);
    const [shippingStatus, setShippingStatus] = useState<string>(trade.logistics?.shipping_status || 'pending');

    const handleUpdateLogistics = async () => {
        if (!trade.id) return;
        showLoading("Actualizando logística...");
        try {
            await tradeService.updateTradeLogistics(trade.id, {
                courier,
                tracking_code: trackingCode,
                shipping_status: shippingStatus as any,
                lastUpdated: new Date()
            });
            alert("Información logística actualizada.");
            onUpdate();
        } catch (error) {
            console.error("Error updating logistics:", error);
            alert("Error al actualizar logística.");
        } finally {
            hideLoading();
        }
    };

    // Multi-chat management
    const [conversations, setConversations] = useState<any[]>([]);
    const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);

    const isAdmin = isAdminEmail(user?.email) || ADMIN_UIDS.includes(user?.uid || '');
    const isOwner = user?.uid === trade.participants.senderId || user?.uid === trade.participants.receiverId;
    const isDirectSale = trade.type === 'direct_sale';
    
    // isMyTurn logic
    const isMyTurn = trade.currentTurn === user?.uid || (trade.currentTurn === 'admin' && isAdmin) || (ADMIN_UIDS.includes(trade.currentTurn || '') && isAdmin);

    useEffect(() => {
        if (isDirectSale && (isOwner || isAdmin) && trade.id) {
            const unsub = tradeService.onSnapshotTradeChats(trade.id, (convs) => {
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
        
        // Protocol V82.0: Resolution Braking for Sourcing & C2B
        const isOfficialFlow = ['sourcing_request', 'admin_negotiation', 'direct_sale'].includes(trade.type || '');
        
        if (isOfficialFlow) {
            if (!window.confirm("¿Aceptar esta propuesta? El estado cambiará a ACEPTADO y se notificará al cliente. El stock NO se moverá hasta la confirmación del pago.")) return;
            
            showLoading("Actualizando estado...");
            try {
                // Protocol V84.0: RAMA 3 - C2B Resolution on Acceptance
                if (trade.type === 'admin_negotiation') {
                    showLoading("Resolviendo oferta C2B y coordinando entrega...");
                    await tradeService.resolveTrade(trade.id, trade.manifest, { forceExecution: true });
                    alert("Oferta C2B aceptada y procesada. Los activos han sido transferidos al búnker.");
                } else {
                    await tradeService.updateTradeStatus(trade.id, 'accepted');
                    alert("Propuesta aceptada. Pendiente de pago/coordinación.");
                }
                onUpdate();
                onClose();
            } catch (error: any) {
                console.error("Error accepting official trade:", error);
                alert(`Error: ${error.message}`);
            } finally {
                hideLoading();
            }
            return;
        }

        const confirm = window.confirm("¿Confirmar resolución de INTERCAMBIO P2P? Esto gestionará el stock y los activos de forma atómica.");
        if (!confirm) return;

        showLoading("Resolviendo transacción P2P...");
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
        if (!window.confirm("¿Confirmar que este pedido ha sido pagado? Esto cerrará la operación y descontará el stock.")) return;
        
        showLoading("Confirmando pago y resolviendo assets...");
        try {
            // Protocol V80.1: Linking payment with resolution
            await tradeService.resolveTrade(trade.id, trade.manifest, { forceExecution: true });
            alert("Pedido marcado como PAGADO y stock actualizado.");
            onUpdate();
            onClose();
        } catch (error: any) {
            console.error("Error marking as paid:", error);
            alert(`Error crítico en resolución: ${error.message}`);
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

    const handleRequestPayment = async () => {
        if (!trade.id) return;
        const amount = prompt("Ingrese el monto final para generar la tarjeta de cobro:", trade.manifest?.cashAdjustment?.toString());
        if (!amount || isNaN(Number(amount))) return;

        showLoading("Generando tarjeta de cobro...");
        try {
            const chatId = `${trade.id}_${trade.participants.senderId}`;
            await tradeService.requestOfficialPayment(trade.id, chatId, Number(amount));
            alert("Tarjeta de cobro enviada al chat.");
            onUpdate();
        } catch (error: any) {
            console.error("Error generating payment card:", error);
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

    const getStatusBadge = (status: Trade['status'], logistics?: Trade['logistics']) => {
        const shippingStatus = logistics?.shipping_status;
        
        // Protocol V77.0: Combined Badge Logic
        if (status === 'completed' && shippingStatus === 'delivered') {
            return <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> ENTREGADO</span>;
        }

        switch (status) {
            case 'pending':
                return <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse"><Clock className="h-3 w-3" /> PENDING</span>;
            case 'completed_unpaid':
            case 'pending_payment':
                return <span className="bg-orange-500/10 text-orange-500 border border-orange-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse"><DollarSign className="h-3 w-3" /> PENDIENTE PAGO</span>;
            case 'payment_reported':
                return <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse"><CheckCircle2 className="h-3 w-3" /> PAGO REPORTADO</span>;
            case 'in_process':
                return <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse"><Disc className="h-3 w-3" /> EN PROCESO (BÚSQUEDA)</span>;
            case 'accepted':
            case 'completed':
                if (isDirectSale) {
                    return (
                        <div className="flex flex-col items-end gap-1">
                            <span className="bg-green-500/10 text-green-500 border border-green-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> PAGADO</span>
                            {shippingStatus === 'shipped' ? (
                                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-sm text-[7px] font-black uppercase tracking-widest flex items-center gap-1"><Truck size={8} /> EN CAMINO</span>
                            ) : shippingStatus === 'ready_for_pickup' ? (
                                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-sm text-[7px] font-black uppercase tracking-widest flex items-center gap-1"><Package size={8} /> LISTO DESPACHO</span>
                            ) : (
                                <span className="bg-gray-500/10 text-gray-500 border border-gray-500/20 px-2 py-0.5 rounded-sm text-[7px] font-black uppercase tracking-widest flex items-center gap-1"><Clock size={8} /> PEND. ENVÍO</span>
                            )}
                        </div>
                    );
                }
                return <span className="bg-green-500/10 text-green-500 border border-green-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> COMPLETADO</span>;
            case 'cancelled':
                return <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5"><XCircle className="h-3 w-3" /> CANCELLED</span>;
            case 'counter_offer':
                return <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5"><ArrowRightLeft className="h-3 w-3" /> NEGOTIATING</span>;
            default:
                return <span className="text-[9px] font-black uppercase">{status}</span>;
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">
            {/* Header / Protocol V82.0 */}
            <div className="p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="p-4 bg-primary rounded-2xl shadow-lg shadow-primary/20">
                        <Handshake className="w-6 h-6 text-black" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-black uppercase tracking-tighter text-white">
                                {trade.type === 'direct_sale' ? 'VENTA DIRECTA B2C' : 
                                 trade.type === 'sourcing_request' ? 'PEDIDO DE BÚSQUEDA' : 
                                 trade.type === 'admin_negotiation' ? 'OFERTA DE USUARIO (C2B)' : 
                                 'DETALLE DE INTERCAMBIO'}
                            </h2>
                            {getStatusBadge(trade.status, trade.logistics)}
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">
                                ID Operación: {trade.id?.slice(-8)}
                            </p>
                            {isAdmin && (
                                <button 
                                    onClick={() => {
                                        const buyerId = trade.participants.senderId || trade.participants.receiverId; 
                                        if (buyerId) {
                                            const chatId = `${trade.id}_${buyerId}`;
                                            window.open(`/mensajes?chat=${chatId}`, '_blank');
                                        } else {
                                            alert("No se pudo identificar al cliente para abrir el chat.");
                                        }
                                    }}
                                    className="px-3 py-1.5 bg-primary text-black rounded-xl hover:bg-white transition-all flex items-center gap-2 text-[9px] font-black uppercase tracking-wider shadow-lg shadow-primary/20"
                                >
                                    <MessageSquare size={12} />
                                    Abrir Chat con el Cliente
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {!isDirectSale && (
                        <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                            Turno: {isMyTurn ? "Tú" : "Contraparte"}
                        </div>
                    )}
                    <button 
                        onClick={onClose}
                        className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors"
                    >
                        <XCircle className="w-6 h-6 text-gray-400" />
                    </button>
                </div>
            </div>

            <div className="p-8 space-y-8 flex flex-col h-full overflow-y-auto">

            {/* Protocol V77.0: Logistics Section for Admins */}
            {isAdmin && (trade.status === 'completed' || trade.status === 'accepted' || trade.status === 'payment_reported') && (
                <div className="p-8 bg-white/[0.03] border border-white/10 rounded-[2.5rem] space-y-6">
                    <div className="flex items-center gap-3">
                        <Truck className="w-5 h-5 text-primary" />
                        <h4 className="text-sm font-black text-white uppercase tracking-tight">Gestión Logística Operativa</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <Package className="w-3 h-3" /> Correo / Courier
                            </label>
                            <input 
                                type="text"
                                value={courier}
                                onChange={(e) => setCourier(e.target.value)}
                                placeholder="Ej: Correo Argentino"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-primary/50 transition-all font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <Hash className="w-3 h-3" /> Tracking Code
                            </label>
                            <input 
                                type="text"
                                value={trackingCode}
                                onChange={(e) => setTrackingCode(e.target.value)}
                                placeholder="N° de seguimiento"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-primary/50 transition-all font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <ClipboardCheck className="w-3 h-3" /> Estado de Envío
                            </label>
                            <select 
                                value={shippingStatus}
                                onChange={(e) => setShippingStatus(e.target.value as any)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-primary/50 transition-all font-bold"
                            >
                                <option value="pending" className="bg-black">Pendiente de Procesar</option>
                                <option value="ready_for_pickup" className="bg-black">Listo para Despacho</option>
                                <option value="shipped" className="bg-black">Enviado / En Camino</option>
                                <option value="delivered" className="bg-black">Entregado</option>
                            </select>
                        </div>
                    </div>
                    
                    <button
                        onClick={handleUpdateLogistics}
                        className="w-full py-3 bg-white/5 border border-white/10 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-primary hover:text-black transition-all"
                    >
                        Guardar Información Logística
                    </button>
                </div>
            )}

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
                                            <span className="font-black text-white text-sm">@{conv.buyerName || conv.buyerUsername}</span>
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
                                <div className={cn(
                                    "bg-black border border-white/10 transition-all duration-500 overflow-hidden",
                                    isChatExpanded 
                                        ? "fixed inset-0 z-[100] flex flex-col p-6 md:p-12" 
                                        : "p-6 bg-white/[0.03] rounded-[2.5rem] space-y-6"
                                )}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <MessageSquare className="w-5 h-5 text-primary" />
                                            <h4 className="text-sm font-black text-white uppercase tracking-tight">Chat con @{selectedConv?.buyerName || selectedConv?.buyerUsername}</h4>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setIsChatExpanded(!isChatExpanded)}
                                                className="p-2 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-primary transition-all"
                                                title={isChatExpanded ? "Contraer" : "Expandir"}
                                            >
                                                {isChatExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={handleAdjudicate}
                                                className="px-6 py-2.5 bg-primary text-black rounded-xl font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-all shadow-lg shadow-primary/20"
                                            >
                                                <Trophy className="w-3.5 h-3.5 inline mr-2" /> Adjudicar
                                            </button>
                                        </div>
                                    </div>
                                    <div className={cn("flex-1 overflow-hidden", isChatExpanded ? "h-full py-6" : "")}>
                                        <TradeChat 
                                            tradeId={trade.id!}
                                            chatId={selectedConv?.id}
                                            currentUser={user} 
                                            trade={trade} 
                                            otherParticipantName={`@${selectedConv?.buyerName || selectedConv?.buyerUsername}`} 
                                        />
                                    </div>
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
                                    {(trade.status === 'completed_unpaid' || trade.status === 'accepted' || trade.status === 'payment_reported' || (trade.status === 'pending_payment' && isDirectSale)) && (isAdmin || isOwner) ? (
                                        <button
                                            onClick={handleMarkAsPaid}
                                            className="flex-1 flex items-center justify-center gap-3 py-4 bg-green-500 text-black rounded-2xl font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg shadow-green-500/20"
                                        >
                                            <DollarSign className="h-5 w-5" /> Confirmar Pago
                                        </button>
                                    ) : trade.status === 'in_process' && isAdmin ? (
                                        <button
                                            onClick={handleFoundRequest}
                                            className="flex-1 flex items-center justify-center gap-3 py-4 bg-primary text-black rounded-2xl font-black uppercase tracking-widest hover:bg-white transition-all shadow-xl shadow-primary/20"
                                        >
                                            <CheckCircle2 className="h-5 w-5" /> Pedido Encontrado
                                        </button>
                                    ) : !isDirectSale ? (
                                        <button
                                            onClick={handleAcceptTrade}
                                            className="flex-1 flex items-center justify-center gap-3 py-4 bg-primary text-black rounded-2xl font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg shadow-primary/20"
                                        >
                                            <CheckCircle2 className="h-5 w-5" /> Aceptar Propuesta
                                        </button>
                                    ) : null}
                                    
                                    {!isDirectSale && trade.type !== 'sourcing_request' && (
                                        <>
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

                                    {/* Protocol V84.0: GENERAR COBRO (Sourcing & Negotiations) */}
                                    {isAdmin && (trade.type === 'sourcing_request' || trade.type === 'admin_negotiation') && trade.status !== 'pending_payment' && (
                                        <button
                                            onClick={handleRequestPayment}
                                            className="w-full mt-4 flex items-center justify-center gap-3 py-4 bg-orange-500 text-black rounded-2xl font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg shadow-orange-500/20"
                                        >
                                            <DollarSign className="h-5 w-5" /> Generar Cobro
                                        </button>
                                    )}
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
        </div>
    );
}
