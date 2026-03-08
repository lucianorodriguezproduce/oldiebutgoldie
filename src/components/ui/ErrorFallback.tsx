import { motion } from "framer-motion";
import { RefreshCcw, Terminal, AlertTriangle } from "lucide-react";

interface ErrorFallbackProps {
    error: Error;
    resetErrorBoundary: () => void;
    eventId?: string;
}

export default function ErrorFallback({ error, resetErrorBoundary, eventId }: ErrorFallbackProps) {
    return (
        <div className="fixed inset-0 bg-[#050505] flex items-center justify-center p-6 z-[9999]">
            <div className="absolute inset-0 bg-red-500/5 blur-[120px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-2xl w-full bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-12 relative overflow-hidden shadow-2xl shadow-red-500/10"
            >
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl">
                        <AlertTriangle className="h-6 w-6 text-red-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-tighter italic">
                            Critical <span className="text-red-500">System Failure</span>
                        </h1>
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1">
                            Bunker Protocol 7.1: Observabilidad Proactiva
                        </p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-black/40 border border-white/5 rounded-2xl p-6 font-mono text-sm">
                        <div className="flex items-center gap-2 text-gray-400 mb-2">
                            <Terminal className="h-4 w-4" />
                            <span className="text-[10px] uppercase font-black tracking-widest">Stack Trace Traceback</span>
                        </div>
                        <p className="text-red-400/80 leading-relaxed break-all">
                            {error.message || "Unknown kernel panic recorded."}
                        </p>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-4 pt-4">
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full md:w-auto flex items-center justify-center gap-3 bg-white text-black px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-red-500 transition-all group"
                        >
                            <RefreshCcw className="h-4 w-4 group-hover:rotate-180 transition-transform duration-500" />
                            Reiniciar Terminal
                        </button>

                        {eventId && (
                            <div className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                Event ID: <span className="text-white ml-2">{eventId}</span>
                            </div>
                        )}
                    </div>
                </div>

                <footer className="mt-12 text-center">
                    <p className="text-[10px] text-gray-700 font-black uppercase tracking-[0.4em]">
                        OBG Tactical Systems | Estabilidad Garantizada
                    </p>
                </footer>
            </motion.div>
        </div>
    );
}
