import { memo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Disc, Layers } from "lucide-react";
import type { UnifiedItem } from "@/services/archivoService";
import { LazyImage } from "@/components/ui/LazyImage";

interface ArchivoCardProps {
    item: UnifiedItem;
    idx: number;
    onPlay?: (url: string) => void;
}

export const ArchivoCard = memo(({ item, idx, onPlay }: ArchivoCardProps) => {
    const [isHovered, setIsHovered] = useState(false);

    // Color extraction can be added later if needed. For now we use the primary theme color.
    const color = '#ffeb3b'; // Fallback color (Primary)

    const isGoldSelection = (item.wants || 0) > (item.have || 1) * 5;
    const playUrl = item.spotify_id || item.youtube_id;

    const handlePlayClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (playUrl && onPlay) {
            onPlay(playUrl);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (idx % 10) * 0.05 }}
            className="break-inside-avoid mb-4 md:mb-6"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <Link
                to={`/archivo/${item.id}`}
                className="group block relative bg-[#0a0a0a] rounded-2xl md:rounded-[2rem] overflow-hidden border border-white/5 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl"
                style={{
                    boxShadow: isHovered && color ? `0 25px 50px -12px ${color}30` : '0 25px 50px -12px rgba(0,0,0,0.5)',
                    borderColor: isHovered && color ? `${color}40` : 'rgba(255,255,255,0.05)'
                }}
            >
                {/* 1. EFECTO FUNDA (Vinilo) */}
                <div className="aspect-square relative overflow-hidden">
                    <LazyImage
                        src={item.image}
                        alt={item.title}
                        priority={idx < 4}
                        width={300}
                        height={300}
                        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />

                    {/* Shadow overlay base */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-500" />

                    {/* Plástico Funda Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent mix-blend-overlay pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute inset-0 border border-white/10 rounded-t-2xl md:rounded-t-[2rem] pointer-events-none" />

                    {/* Quick Access: Play Flotante */}
                    {playUrl && (
                        <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 pointer-events-none z-30 ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                            {/* Evitamos que el Link envuelva al botón modificando el evento */}
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Comportamiento por defecto: Si no hay onPlay inyectado, redirigimos al detalle con hash #play
                                    if (onPlay) {
                                        onPlay(playUrl);
                                    } else {
                                        window.location.href = `/archivo/${item.id}#play`;
                                    }
                                }}
                                className="w-16 h-16 rounded-full bg-primary/90 text-black flex items-center justify-center backdrop-blur-md shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-110 hover:bg-white transition-all cursor-pointer pointer-events-auto"
                            >
                                <Play size={28} className="ml-1" fill="currentColor" />
                            </button>
                        </div>
                    )}

                    {/* Badges Superiores */}
                    <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                        {item.source === 'inventory' ? (
                            <div className="px-3 py-1.5 bg-primary text-black text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg border border-primary/20">
                                EN TIENDA
                            </div>
                        ) : (
                            <div className="px-3 py-1.5 bg-white/10 backdrop-blur-md text-white/90 text-[9px] font-black uppercase tracking-widest rounded-full border border-white/20 shadow-lg">
                                COLECCIÓN
                            </div>
                        )}
                        {isGoldSelection && (
                            <div className="px-2 py-1 bg-yellow-500/20 backdrop-blur-md text-yellow-500 text-[8px] font-black uppercase tracking-widest rounded-full border border-yellow-500/30 flex items-center gap-1 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                                <Disc size={10} /> ORO
                            </div>
                        )}
                    </div>

                    {/* MÓDULO DATA (Hover: Tracklist Preview) */}
                    <div className={`absolute inset-x-0 bottom-0 p-4 transform transition-all duration-500 ${isHovered ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'} pointer-events-none`}>
                        {item.tracklist && item.tracklist.length > 0 && (
                            <div className="mb-2">
                                <p className="text-[9px] text-white/50 uppercase tracking-[0.2em] mb-1 font-mono">Tracklist</p>
                                <ul className="text-white/80 text-[10px] space-y-1 font-mono truncate">
                                    {item.tracklist.slice(0, 3).map((track, i) => (
                                        <li key={i} className="truncate">
                                            {track.position} {track.title}
                                        </li>
                                    ))}
                                    {item.tracklist.length > 3 && <li className="text-white/40">+{item.tracklist.length - 3} tracks...</li>}
                                </ul>
                            </div>
                        )}

                        {/* Data Técnica */}
                        <div className="flex flex-wrap gap-2 mt-3">
                            {item.bpm && (
                                <span className="text-[9px] font-mono text-white/60 bg-white/5 px-2 py-1 rounded">BPM: {item.bpm}</span>
                            )}
                            {item.key && (
                                <span className="text-[9px] font-mono text-white/60 bg-white/5 px-2 py-1 rounded">KEY: {item.key}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Base Metadata */}
                <div className={`p-4 md:p-5 transition-transform duration-500 z-20 relative bg-[#0a0a0a] ${isHovered && item.tracklist?.length ? '-translate-y-2' : ''}`}>
                    <h3 className="text-white font-display font-black text-sm md:text-md truncate uppercase tracking-tight mb-1 group-hover:text-primary transition-colors">
                        {item.title}
                    </h3>
                    <div className="flex items-center justify-between">
                        <p className="text-gray-500 text-[10px] font-mono truncate uppercase tracking-widest opacity-70">
                            {item.artist}
                        </p>
                        {item.year && item.year !== 0 && (
                            <p className="text-white/30 text-[9px] font-mono">
                                {item.year}
                            </p>
                        )}
                    </div>
                    {/* Color Accent line */}
                    {color && (
                        <div
                            className="absolute bottom-0 left-0 h-1 transition-all duration-1000"
                            style={{
                                backgroundColor: color,
                                width: isHovered ? '100%' : '15%',
                                opacity: isHovered ? 1 : 0.5
                            }}
                        />
                    )}
                </div>
            </Link>
        </motion.div>
    );
});
