import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, CreditCard, ShieldCheck, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { tradeService } from "@/services/tradeService";
import { useLoading } from "@/context/LoadingContext";
import { useAuth } from "@/context/AuthContext";

export default function PublicationCheckout() {
    const { tradeId } = useParams();
    const navigate = useNavigate();
    const { showLoading, hideLoading } = useLoading();
    const { user } = useAuth();
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [isPaid, setIsPaid] = useState(false);

    useEffect(() => {
        if (!tradeId) navigate('/perfil');
    }, [tradeId, navigate]);

    const handleSimulatePayment = async () => {
        if (!tradeId || !user) {
            console.error("[checkout] Missing tradeId or user:", { tradeId, userId: user?.uid });
            alert("No estás autenticado o la operación es inválida.");
            return;
        }

        setIsProcessing(true);
        showLoading("Procesando pago de publicación...");

        try {
            console.log(`[checkout] Starting payment simulation for trade: ${tradeId}`);
            
            // Simulamos un delay de red
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Actualizamos el estado del trade a 'pending'
            console.log(`[checkout] Updating trade status to 'pending'...`);
            await tradeService.updateTradeStatus(tradeId, 'pending');
            
            console.log(`[checkout] Payment successful for trade: ${tradeId}`);
            setIsPaid(true);
            hideLoading();
        } catch (error: any) {
            console.error("[checkout] Error during payment simulation:", error);
            const errorMessage = error.code === 'permission-denied' 
                ? "Error de permisos: No eres el dueño de esta publicación o no tienes autorización."
                : "Error al procesar el pago. Intenta nuevamente.";
            alert(errorMessage);
            setIsProcessing(false);
            hideLoading();
        }
    };

    if (isPaid) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center p-6 bg-black">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-10 text-center space-y-8 shadow-2xl"
                >
                    <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(204,255,0,0.3)]">
                        <CheckCircle2 size={40} className="text-black" />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-3xl font-display font-black text-white uppercase tracking-tighter">¡Publicación Exitosa!</h1>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest leading-relaxed">
                            Tu oferta ya está disponible en el mercado público. El mundo ya puede ver tus discos.
                        </p>
                    </div>
                    <button 
                        onClick={() => navigate(`/orden/${tradeId}`)}
                        className="w-full bg-primary text-black py-5 rounded-2xl font-black uppercase text-sm tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_40px_rgba(204,255,0,0.15)] flex items-center justify-center gap-2"
                    >
                        Ver Publicación <ArrowRight size={18} />
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-[90vh] py-12 px-6 bg-black">
            <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                {/* Left: Info */}
                <div className="space-y-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full">
                        <Sparkles size={14} className="text-primary" />
                        <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Paso Final</span>
                    </div>
                    
                    <div className="space-y-4">
                        <h1 className="text-5xl md:text-6xl font-display font-black text-white uppercase tracking-tighter leading-[0.9]">
                            Derecho de <span className="text-primary">Piso</span>
                        </h1>
                        <p className="text-gray-500 text-sm font-bold uppercase tracking-widest leading-relaxed max-w-sm">
                            Aboná la tarifa de publicación para que tu oferta aparezca en el Mercado Global y llegue a todos los coleccionistas.
                        </p>
                    </div>

                    <div className="space-y-4 pt-6">
                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                            <ShieldCheck className="text-primary mt-1" size={20} />
                            <div>
                                <h4 className="text-white text-xs font-black uppercase">Visibilidad Destacada</h4>
                                <p className="text-gray-500 text-[10px] font-bold uppercase">Tu disco aparecerá en el feed principal de /comercio.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                            <CreditCard className="text-primary mt-1" size={20} />
                            <div>
                                <h4 className="text-white text-xs font-black uppercase">Seguridad en la Transacción</h4>
                                <p className="text-gray-500 text-[10px] font-bold uppercase">Garantizamos que el flujo de negociación sea seguro y verificado.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Payment Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#0f0f0f] border border-white/10 rounded-[3rem] p-8 md:p-12 space-y-10 shadow-3xl relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[120px] -z-10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest font-mono">Resumen de Cargo</span>
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest font-mono">#{tradeId?.slice(-8).toUpperCase()}</span>
                    </div>

                    <div className="py-6 border-y border-white/5 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-white text-sm font-bold uppercase">Publicación P2P</span>
                            <span className="text-white font-mono">$ 500</span>
                        </div>
                        <div className="flex justify-between items-center opacity-50">
                            <span className="text-white text-xs font-bold uppercase tracking-tight">Cargos de Plataforma</span>
                            <span className="text-white font-mono">$ 0</span>
                        </div>
                    </div>

                    <div className="flex justify-between items-end">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total a Pagar</span>
                        <span className="text-5xl font-display font-black text-white tracking-tighter">$ 500</span>
                    </div>

                    <div className="space-y-4">
                        <button 
                            onClick={handleSimulatePayment}
                            disabled={isProcessing}
                            className="w-full bg-white text-black py-6 rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-primary transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {isProcessing ? (
                                <Loader2 size={24} className="animate-spin" />
                            ) : (
                                <>Abonar con MercadoPago <ArrowRight size={20} /></>
                            )}
                        </button>
                        <p className="text-center text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">Pago Seguro Codificado con SSL 256-bit</p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
