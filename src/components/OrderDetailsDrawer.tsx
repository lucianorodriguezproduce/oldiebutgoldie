import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { TEXTS } from "@/constants/texts";

interface OrderDetailsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

export default function OrderDetailsDrawer({ isOpen, onClose, title, children, footer }: OrderDetailsDrawerProps) {
    // Lock body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

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
                        className="fixed inset-y-0 right-0 z-[1000] flex h-[100dvh] w-full max-w-md flex-col bg-neutral-950 shadow-2xl transition-transform"
                    >
                        {/* Botón de Cierre DEFINITIVO — Tarea 3 de Fase 2 */}
                        <button
                            onClick={onClose}
                            style={{
                                position: 'absolute',
                                top: '12px',
                                right: '12px',
                                width: '32px',
                                height: '32px',
                                background: '#f3f4f6',
                                color: '#000',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                border: '1px solid #e5e7eb',
                                zIndex: 50
                            }}
                            className="shadow-sm active:scale-95 transition-transform"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        {/* Header */}
                        <div className="flex-none flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5 border-b border-white/5 safe-area-top">
                            <span className="text-sm font-mono font-bold text-gray-400 uppercase tracking-widest truncate">
                                {title || TEXTS.profile.orderDetail}
                            </span>
                        </div>

                        {/* Body — scrollable with touch support */}
                        <div
                            className="flex-1 overflow-y-auto overscroll-none p-4 space-y-6"
                            style={{ WebkitOverflowScrolling: "touch" }}
                        >
                            {children}
                        </div>

                        {/* Footer — fixed bottom, but scrollable if it grows too large (mobile keyboard safe) */}
                        {footer && (
                            <div className="flex-none px-5 sm:px-8 py-5 border-t border-white/10 space-y-3 pb-safe max-h-[40vh] overflow-y-auto custom-scrollbar bg-black/80 backdrop-blur-xl">
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
