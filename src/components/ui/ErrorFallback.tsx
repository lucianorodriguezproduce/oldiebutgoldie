import { motion } from "framer-motion";
import { RefreshCcw, Terminal, AlertTriangle, Zap } from "lucide-react";
import { useEffect, useState } from "react";

interface ErrorFallbackProps {
    error: Error;
    resetErrorBoundary: () => void;
    eventId?: string;
}

export default function ErrorFallback({ error, resetErrorBoundary, eventId }: ErrorFallbackProps) {
    const [isAutoRepairing, setIsAutoRepairing] = useState(false);

    useEffect(() => {
        const isChunkError = error.message?.includes("Failed to fetch dynamically imported module") ||
            error.message?.includes("Loading chunk") ||
            error.message?.includes("ChunkLoadError");

        if (isChunkError) {
            setIsAutoRepairing(true);
            const timer = setTimeout(() => {
                window.location.reload();
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    return (
        <div className="fixed inset-0 bg-[#050505] flex items-center justify-center p-6 z-[9999]">
            <div className="absolute inset-0 bg-red-500/5 blur-[120px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-2xl w-full bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-12 relative overflow-hidden shadow-2xl shadow-red-500/10"
            >
                <div className="flex items-center gap-4 mb-8">
                    <div className={`p-3 border rounded-2xl transition-colors duration-500 ${isAutoRepairing ? 'bg-primary/10 border-primary/20' : 'bg-red-500/10 border-red-500/20'}`}>
                        {isAutoRepairing ? (
                            <Zap className="h-6 w-6 text-primary animate-pulse" />
                        ) : (
                            <AlertTriangle className="h-6 w-6 text-red-500" />
                        )}
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-tighter italic">
                            {isAutoRepairing ? 'Protocolo de' : 'Critical'} <span className={isAutoRepairing ? 'text-primary' : 'text-red-500'}>{isAutoRepairing ? 'Autocuración' : 'System Failure'}</span>
                        </h1>
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1">
                            batea Protocol 7.1.3: Resiliencia Dinámica
                        </p>
                    </div>
                </div>

                <div className="space-y-6">
                    {isAutoRepairing ? (
                        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-8 text-center space-y-4">
                            <RefreshCcw className="h-8 w-8 text-primary mx-auto animate-spin" />
                            <p className="text-sm font-black text-white uppercase tracking-widest italic animate-pulse">
                                Actualizando sistemas a la última versión disponible...
                            </p>
                            <p className="text-[9px] text-primary/60 font-mono uppercase tracking-[0.2em]">
                                Reinicio de terminal en curso para sincronizar módulos.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-black/40 border border-white/5 rounded-2xl p-6 font-mono text-sm">
                            <div className="flex items-center gap-2 text-gray-400 mb-2">
                                <Terminal className="h-4 w-4" />
                                <span className="text-[10px] uppercase font-black tracking-widest">Stack Trace Traceback</span>
                            </div>
                            <p className="text-red-400/80 leading-relaxed break-all">
                                {error.message || "Unknown kernel panic recorded."}
                            </p>
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row items-center gap-4 pt-4">
                        {!isAutoRepairing && (
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full md:w-auto flex items-center justify-center gap-3 bg-white text-black px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-red-500 transition-all group"
                            >
                                <RefreshCcw className="h-4 w-4 group-hover:rotate-180 transition-transform duration-500" />
                                Reiniciar Terminal
                            </button>
                        )}

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
