import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Landmark, CreditCard, Banknote, HelpCircle } from 'lucide-react';
import { tradeService } from '@/services/tradeService';
import type { Trade } from '@/types/inventory';
import { useLoading } from '@/context/LoadingContext';

interface PaymentMethodModalProps {
    isOpen: boolean;
    onClose: () => void;
    tradeId: string;
    onSuccess?: () => void;
}

const PAYMENT_METHODS = [
    { id: 'efectivo', label: 'Efectivo', icon: Banknote, color: 'text-green-400', bg: 'bg-green-400/10' },
    { id: 'transferencia', label: 'Transferencia Bancaria', icon: Landmark, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { id: 'debito', label: 'Tarjeta de Débito', icon: CreditCard, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { id: 'credito', label: 'Tarjeta de Crédito', icon: CreditCard, color: 'text-orange-400', bg: 'bg-orange-400/10' },
    { id: 'otro', label: 'Otro / Billetera Virtual', icon: HelpCircle, color: 'text-gray-400', bg: 'bg-gray-400/10' },
] as const;

export default function PaymentMethodModal({ isOpen, onClose, tradeId, onSuccess }: PaymentMethodModalProps) {
    const { showLoading, hideLoading } = useLoading();
    const [selectedMethod, setSelectedMethod] = useState<Trade['payment_method'] | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);

    const handleConfirm = async () => {
        if (!selectedMethod || isConfirming) return;

        setIsConfirming(true);
        showLoading("Confirmando pago...");

        try {
            await tradeService.confirmPayment(tradeId, selectedMethod);
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Error confirming payment:", error);
            alert("Error al confirmar el pago. Intenta de nuevo.");
        } finally {
            setIsConfirming(false);
            hideLoading();
        }
    };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/90 backdrop-blur-xl"
                        onClick={onClose}
                    />
                    
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)]"
                    >
                        {/* Header */}
                        <div className="p-8 pb-4 flex items-start justify-between">
                            <div className="space-y-1">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[10px] font-black text-green-500 uppercase tracking-[0.2em]">Cierre de Orden</span>
                                </div>
                                <h2 className="text-3xl font-display font-black text-white uppercase tracking-tighter mt-2">¿Cómo recibiste <span className="text-primary italic">el pago?</span></h2>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-relaxed">Seleccioná el método para registrar la operación</p>
                            </div>
                            <button 
                                onClick={onClose} 
                                className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all active:scale-95"
                            >
                                <X size={18} className="text-gray-400" />
                            </button>
                        </div>

                        {/* Options */}
                        <div className="p-8 flex flex-col gap-3">
                            {PAYMENT_METHODS.map((method) => {
                                const Icon = method.icon;
                                const isSelected = selectedMethod === method.id;

                                return (
                                    <button
                                        key={method.id}
                                        onClick={() => setSelectedMethod(method.id as Trade['payment_method'])}
                                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 ${
                                            isSelected 
                                                ? 'bg-white/10 border-primary shadow-[0_0_30px_rgba(255,107,0,0.1)]' 
                                                : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10'
                                        }`}
                                    >
                                        <div className={`p-3 rounded-xl ${method.bg} ${method.color}`}>
                                            <Icon size={20} />
                                        </div>
                                        <span className={`text-[11px] font-black uppercase tracking-widest ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                                            {method.label}
                                        </span>
                                        {isSelected && (
                                            <motion.div 
                                                layoutId="selected-check"
                                                className="ml-auto"
                                            >
                                                <CheckCircle2 className="text-primary" size={20} />
                                            </motion.div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Actions */}
                        <div className="p-8 pt-0 flex gap-4">
                            <button
                                onClick={onClose}
                                className="flex-1 py-5 rounded-2xl border border-white/5 text-gray-500 font-black uppercase text-[10px] tracking-widest hover:bg-white/5 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={!selectedMethod || isConfirming}
                                className="flex-[2] py-5 rounded-2xl bg-white text-black font-black uppercase text-[10px] tracking-[0.2em] hover:bg-primary transition-all disabled:opacity-20 flex items-center justify-center gap-2 shadow-2xl active:scale-95"
                            >
                                Finalizar Orden
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
