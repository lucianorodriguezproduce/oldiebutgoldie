import { motion } from "framer-motion";
import { Activity, ExternalLink, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function AdminStats() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-12">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-5xl font-display font-black text-white tracking-tightest uppercase italic">
                        Stitch <span className="text-primary">Intelligence</span>
                    </h1>
                    <p className="text-gray-500 mt-2 font-bold uppercase tracking-widest text-sm">Radar de Telemetría Looker V4.8.3</p>
                </div>

                <div className="flex items-center gap-4">
                    <a
                        href="https://lookerstudio.google.com/reporting/a7052b79-636f-455f-bee2-5242b1b107dc/page/kIV1C"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-2.5 rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all group"
                    >
                        <ExternalLink className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white">Abrir en Looker</span>
                    </a>
                    <button
                        onClick={() => window.location.reload()}
                        className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-gray-400 hover:text-primary"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>
            </header>

            <Card className="bg-[#0a0a0a] border-white/5 rounded-[2.5rem] overflow-hidden relative group">
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                <div className="p-8 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Activity className="h-5 w-5 text-primary animate-pulse" />
                        <span className="text-xs font-black uppercase tracking-widest text-white">Live Intelligence Stream</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Sistema Conectado</span>
                    </div>
                </div>

                <div className="relative w-full aspect-video md:aspect-[16/9] min-h-[600px] lg:min-h-[800px] bg-black">
                    <iframe
                        title="Looker Intelligence Radar"
                        src="https://lookerstudio.google.com/embed/reporting/a7052b79-636f-455f-bee2-5242b1b107dc/page/kIV1C"
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        style={{ border: 0 }}
                        allowFullScreen
                        loading="lazy"
                        className="absolute inset-0 w-full h-full"
                    />
                </div>
            </Card>

            <footer className="mt-8 flex justify-center">
                <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.3em]">
                    End-to-End Analytics Integration | OBG Tactical Systems
                </p>
            </footer>
        </div>
    );
}
