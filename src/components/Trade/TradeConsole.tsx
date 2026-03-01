import { useState } from "react";
import {
    Handshake,
    ArrowRightLeft,
    CheckCircle2,
    XCircle,
    Clock,
    User,
    ShoppingBag,
    AlertCircle,
    Disc,
    Edit2
} from "lucide-react";
import { motion } from "framer-motion";
import { tradeService } from "@/services/tradeService";
import type { Trade, TradeManifest } from "@/types/inventory";
import { useLoading } from "@/context/LoadingContext";
import { useAuth } from "@/context/AuthContext";
import ManifestEditor from "./ManifestEditor";

interface TradeConsoleProps {
    trade: Trade;
    onUpdate: () => void;
    onClose: () => void;
}

export default function TradeConsole({ trade, onUpdate, onClose }: TradeConsoleProps) {
    const { showLoading, hideLoading } = useLoading();
    const { user } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [editedManifest, setEditedManifest] = useState<TradeManifest | null>(null);

    const isMyTurn = trade.currentTurn === user?.uid;
    const canAction = trade.status !== 'accepted' && trade.status !== 'cancelled' && isMyTurn;

    const handleAcceptTrade = async () => {
        if (!trade.id) return;
        const confirm = window.confirm("¿Confirmar resolución de Trade? Esto descontará stock automáticamente.");
        if (!confirm) return;

        showLoading("Resolviendo conflicto de stock...");
        try {
            await tradeService.resolveTrade(trade.id, trade.manifest);
            alert("Trade aceptado y stock actualizado correctamente.");
            onUpdate();
            onClose();
        } catch (error: any) {
            console.error("Error accepting trade:", error);
            alert(`Error crítico: ${error.message}`);
        } finally {
            hideLoading();
        }
    };

    const handleCounterOffer = async () => {
        if (!trade.id || !editedManifest || !user) return;

        showLoading("Enviando contra-oferta...");
        try {
            await tradeService.counterTrade(trade.id, editedManifest, user.uid);
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

    const getStatusBadge = (status: Trade['status']) => {
        switch (status) {
            case 'pending':
                return <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse"><Clock className="h-3 w-3" /> PENDING</span>;
            case 'accepted':
                return <span className="bg-green-500/10 text-green-500 border border-green-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> COMPLETED</span>;
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
                        {isEditing ? "Editando Propuesta" : "Detalle de Propuesta"}
                    </h3>
                    {getStatusBadge(trade.status)}
                </div>
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-xl">
                    Turno: {isMyTurn ? "Tú" : "Contraparte"}
                </div>
            </div>

            <ManifestEditor
                manifest={isEditing ? (editedManifest as TradeManifest) : trade.manifest}
                onChange={(m) => setEditedManifest(m)}
                isLocked={!isEditing}
                myItems={[]}
                theirItems={[]}
            />

            {canAction && (
                <div className="flex gap-4 pt-8">
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
                            <button
                                onClick={handleAcceptTrade}
                                className="flex-1 flex items-center justify-center gap-3 py-4 bg-primary text-black rounded-2xl font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg shadow-primary/20"
                            >
                                <CheckCircle2 className="h-5 w-5" /> Aceptar Propuesta
                            </button>
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

            {trade.status === 'accepted' && (
                <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-[2rem] flex items-center gap-4">
                    <div className="p-3 bg-green-500 rounded-2xl">
                        <CheckCircle2 className="h-6 w-6 text-black" />
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Trato Cerrado</p>
                        <p className="text-sm font-bold text-white">El stock ha sido descontado atómicamente y la operación está completa.</p>
                    </div>
                </div>
            )}

            {!isMyTurn && trade.status !== 'accepted' && trade.status !== 'cancelled' && (
                <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] flex items-center gap-4">
                    <AlertCircle className="h-5 w-5 text-gray-500" />
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Esperando respuesta de la contraparte...</p>
                </div>
            )}
        </div>
    );
}
