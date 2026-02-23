import { Disc } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useLote } from "@/context/LoteContext";
import { motion, AnimatePresence } from "framer-motion";
import { TEXTS } from "@/constants/texts";

export function FloatingCartCounter() {
    const { totalCount } = useLote();
    const location = useLocation();

    // Don't show the widget if we are already in the checkout view
    if (location.pathname === "/revisar-lote") return null;

    return (
        <AnimatePresence>
            {totalCount > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.8 }}
                    key="cart-counter"
                    className="fixed bottom-6 right-6 z-[9999]"
                >
                    <Link
                        to="/revisar-lote"
                        className="group relative flex items-center justify-center w-16 h-16 bg-black border-2 border-primary rounded-full shadow-[0_10px_30px_rgba(204,255,0,0.2)] hover:border-white transition-all hover:scale-110 active:scale-95 overflow-visible"
                    >
                        <motion.div
                            key={totalCount}
                            initial={{ scale: 1 }}
                            animate={{ scale: [1, 1.4, 1] }}
                            transition={{ duration: 0.5, ease: "easeInOut" }}
                            className="absolute inset-0 rounded-full bg-primary/20 -z-10"
                        />
                        <Disc className={`h-8 w-8 text-primary group-hover:text-white transition-colors ${totalCount > 0 ? 'animate-[spin_4s_linear_infinite]' : ''}`} />

                        {/* Red Badge for Count */}
                        <motion.div
                            key={totalCount}
                            initial={{ scale: 0, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            className="absolute -top-1 -right-1 bg-red-600 text-white min-w-[24px] h-6 px-1.5 rounded-full flex items-center justify-center text-xs font-black shadow-[0_2px_10px_rgba(220,38,38,0.5)] border-2 border-black z-20"
                        >
                            {totalCount}
                        </motion.div>

                        {/* Tooltip hint on hover (Desktop) */}
                        <span className="absolute right-20 bg-black/90 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none backdrop-blur-sm shadow-2xl">
                            {TEXTS.common.batchReview.reviewBatch}
                        </span>
                    </Link>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
