import { ShoppingBag } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useLote } from "@/context/LoteContext";
import { motion, AnimatePresence } from "framer-motion";

export function FloatingLoteWidget() {
    const { totalCount } = useLote();
    const location = useLocation();

    // Don't show the widget if we are already in the checkout view
    if (location.pathname === "/revisar-lote") return null;

    return (
        <AnimatePresence>
            {totalCount > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className="fixed bottom-6 right-6 z-50 md:bottom-10 md:right-10"
                >
                    <Link
                        to="/revisar-lote"
                        className="group relative flex items-center justify-center bg-primary text-black hover:bg-white transition-all rounded-full p-4 md:p-5 shadow-[0_0_30px_rgba(204,255,0,0.4)] hover:shadow-[0_0_40px_rgba(255,255,255,0.6)]"
                    >
                        <ShoppingBag className="h-6 w-6 relative z-10" />

                        {/* Red notification badge */}
                        <motion.div
                            key={totalCount}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-2 -right-2 bg-red-600 text-white min-w-[24px] h-6 px-1.5 rounded-full flex items-center justify-center text-xs font-black shadow-lg z-20"
                        >
                            {totalCount}
                        </motion.div>

                        {/* Expandable text for desktop */}
                        <div className="hidden md:flex flex-col items-start ml-3 max-w-0 group-hover:max-w-xs overflow-hidden transition-all duration-300 ease-in-out">
                            <span className="text-xs font-black uppercase tracking-widest leading-tight whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity delay-100">
                                Revisar Lote
                            </span>
                        </div>
                    </Link>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
