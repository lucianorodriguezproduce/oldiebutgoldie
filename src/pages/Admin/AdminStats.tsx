import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Activity, ExternalLink, RefreshCw, Disc, Music, PlayCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { quotaService, type QuotaStats } from "@/services/quotaService";

export default function AdminStats() {
    const [stats, setStats] = useState<QuotaStats>(quotaService.getStats());

    useEffect(() => {
        const handleUpdate = (e: any) => setStats(e.detail);
        window.addEventListener('obg_quota_update', handleUpdate);
        return () => window.removeEventListener('obg_quota_update', handleUpdate);
    }, []);

    // YouTube Search Quota is ~10,000 units/day. Each search is 100.
    const ytPercent = Math.min((stats.youtube / 10000) * 100, 100);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-12">
            {/* ... header remains same ... */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-5xl font-display font-black text-white tracking-tightest uppercase italic">
                        OBG <span className="text-primary">Intelligence</span>
                    </h1>
                    <p className="text-gray-500 mt-2 font-bold uppercase tracking-widest text-sm">Radar de Telemetría Looker V4.8.3</p>
                </div>
                {/* ... existing buttons ... */}
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
                </div>
            </header>

            {/* Quota Telemetry Grid (V14.4) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 rounded-3xl bg-zinc-900/50 border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Disc className="h-12 w-12 text-white" />
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Carga Discogs</p>
                    <p className="text-3xl font-display font-black text-white">{stats.discogs}</p>
                    <p className="text-[9px] text-zinc-500 font-mono mt-2 uppercase">UNIDADES DE PROCESAMIENTO</p>
                </div>

                <div className="p-6 rounded-3xl bg-zinc-900/50 border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Music className="h-12 w-12 text-[#1DB954]" />
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Hits Spotify</p>
                    <p className="text-3xl font-display font-black text-white">{stats.spotify}</p>
                    <p className="text-[9px] text-zinc-500 font-mono mt-2 uppercase">BÚSQUEDAS AUTÓNOMAS</p>
                </div>

                <div className="p-6 rounded-3xl bg-zinc-900/50 border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <PlayCircle className="h-12 w-12 text-red-500" />
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Consumo YouTube (Cuota)</p>
                    <div className="flex items-end gap-2">
                        <p className="text-3xl font-display font-black text-white">{stats.youtube}</p>
                        <span className="text-zinc-500 font-mono text-xs mb-1">/ 10,000</span>
                    </div>
                    <div className="mt-4 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${ytPercent}%` }}
                            className={`h-full ${ytPercent > 80 ? 'bg-red-500' : 'bg-primary'}`}
                        />
                    </div>
                </div>
            </div>

            <Card className="bg-[#0a0a0a] border-white/5 rounded-[2.5rem] overflow-hidden relative group">
                {/* ... existing card content ... */}
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
                        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
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
