import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, Clock, Info, ShieldCheck, X } from "lucide-react";
import { TEXTS } from "@/constants/texts";

interface OrderDetailsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    status?: string; // Protocolo V63.0: Para el Stepper
    children: React.ReactNode;
    footer?: React.ReactNode;
}

export default function OrderDetailsDrawer({ isOpen, onClose, title, status, children, footer }: OrderDetailsDrawerProps) {
    // ... (rest of the component)

    // Lógica de pasos para el Stepper (V63.0)
    const getStep = (currentStatus: string) => {
        if (!currentStatus) return 0;
        if (["pending", "counter_offer"].includes(currentStatus)) return 1;
        if (["accepted", "pending_payment", "confirmed"].includes(currentStatus)) return 2;
        if (["completed", "venta_finalizada", "resolved", "completed_unpaid"].includes(currentStatus)) return 3;
        return 0;
    };

    const currentStep = getStep(status || "");

    const steps = [
        { label: "Negociación", icon: Clock },
        { label: "Adjudicado", icon: CheckCircle2 },
        { label: "Finalizado", icon: ShieldCheck }
    ];

    const drawerContent = (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        className="fixed inset-y-0 right-0 z-[1000] flex h-[100dvh] w-full max-w-md flex-col bg-neutral-950 shadow-2xl transition-transform border-l border-white/5"
                    >
                        {/* Botón de Cierre */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 w-10 h-10 bg-white/5 hover:bg-white/10 text-white rounded-full flex items-center justify-center border border-white/10 z-50 transition-all active:scale-95"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        {/* Header */}
                        <div className="flex-none px-8 pt-8 pb-4">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-2 block">
                                {title || "Detalle de Orden"}
                            </span>
                            
                            {/* Stepper (Protocolo V63.0) */}
                            {status && (
                                <div className="mt-8 relative">
                                    <div className="flex justify-between items-center relative z-10">
                                        {steps.map((step, idx) => {
                                            const stepNum = idx + 1;
                                            const isActive = currentStep >= stepNum;
                                            const isCurrent = currentStep === stepNum;
                                            const Icon = step.icon;

                                            return (
                                                <div key={idx} className="flex flex-col items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 border-2 ${
                                                        isCurrent 
                                                            ? "bg-primary text-black border-primary shadow-lg shadow-primary/20 scale-110" 
                                                            : isActive 
                                                                ? "bg-primary/20 text-primary border-primary/30" 
                                                                : "bg-white/5 text-gray-600 border-white/10"
                                                    }`}>
                                                        <Icon size={18} strokeWidth={isActive ? 3 : 2} />
                                                    </div>
                                                    <span className={`text-[8px] font-black uppercase tracking-widest ${
                                                        isActive ? "text-white" : "text-gray-600"
                                                    }`}>
                                                        {step.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    
                                    {/* Line connecting steps */}
                                    <div className="absolute top-5 left-0 w-full h-[2px] bg-white/5 -z-0" />
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%' }}
                                        className="absolute top-5 left-0 h-[2px] bg-primary -z-0 transition-all duration-1000"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Body */}
                        <div
                            className="flex-1 overflow-y-auto overscroll-none p-8 pt-4 space-y-6 custom-scrollbar"
                            style={{ WebkitOverflowScrolling: "touch" }}
                        >
                            {children}
                        </div>

                        {/* Footer */}
                        {footer && (
                            <div className="flex-none px-8 py-8 border-t border-white/10 bg-black/40 backdrop-blur-3xl pb-safe">
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    return createPortal(drawerContent, document.body);
}
