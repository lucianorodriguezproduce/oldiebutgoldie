import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

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
                        {/* Header */}
                        <div className="flex-none flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5 border-b border-white/5 safe-area-top">
                            <span className="text-sm font-mono font-bold text-gray-400 uppercase tracking-widest truncate">
                                {title || "Detalle de Pedido"}
                            </span>
                            <button
                                onClick={onClose}
                                className="p-2.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all active:scale-90"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Body — scrollable with touch support */}
                        <div
                            className="flex-1 overflow-y-auto overscroll-none p-4 space-y-6"
                            style={{ WebkitOverflowScrolling: "touch" }}
                        >
                            {children}
                        </div>

                        {/* Footer — fixed bottom */}
                        {footer && (
                            <div className="flex-none px-5 sm:px-8 py-4 sm:py-5 border-t border-white/5 space-y-3 pb-safe">
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
