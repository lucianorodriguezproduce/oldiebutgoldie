import { motion, AnimatePresence } from "framer-motion";
import { Disc } from "lucide-react";
import { useLoading } from "@/context/LoadingContext";
import { TEXTS } from "@/constants/texts";

export function LoadingOverlay() {
    const { isLoading, message } = useLoading();

    return (
        <AnimatePresence>
            {isLoading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md px-4"
                >
                    <div className="bg-[#0A0A0A] border border-white/10 p-8 md:p-12 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center gap-8 max-w-sm w-full text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-primary/5 opacity-20 pointer-events-none" />
                        <div className="relative w-20 h-20">
                            {/* Spinning outer ring */}
                            <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" style={{ animationDuration: '1s' }}></div>

                            {/* Reverse spinning inner ring with Vinyl icon */}
                            <div className="absolute inset-2 rounded-full border-r-2 border-white/10 animate-spin flex items-center justify-center" style={{ animationDirection: 'reverse', animationDuration: '2s' }}>
                                <Disc className="w-8 h-8 text-primary/40" />
                            </div>

                            {/* Center pulse */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_15px_rgba(204,255,0,0.8)]" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-xl font-display font-black text-white uppercase tracking-tighter">
                                {message}
                            </h3>
                            <div className="flex justify-center gap-1">
                                <motion.span
                                    animate={{ opacity: [0, 1, 0] }}
                                    transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                                    className="w-1.5 h-1.5 bg-primary rounded-full"
                                />
                                <motion.span
                                    animate={{ opacity: [0, 1, 0] }}
                                    transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                                    className="w-1.5 h-1.5 bg-primary/60 rounded-full"
                                />
                                <motion.span
                                    animate={{ opacity: [0, 1, 0] }}
                                    transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                                    className="w-1.5 h-1.5 bg-primary/30 rounded-full"
                                />
                            </div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] leading-relaxed max-w-[200px]">
                                {TEXTS.common.loading.safetyInstruction}
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
