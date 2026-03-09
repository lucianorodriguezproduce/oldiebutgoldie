import { memo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Pause, Disc, Waves } from "lucide-react";
import type { UnifiedItem } from "@/services/archivoService";
import { LazyImage } from "@/components/ui/LazyImage";

interface ArchivoCardProps {
    item: UnifiedItem;
    idx: number;
    onPlay?: (url: string) => void;
}

export const ArchivoCard = memo(({ item, idx, onPlay }: ArchivoCardProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const color = '#ffeb3b'; // Fallback color (Primary)
    const isGoldSelection = (item.wants || 0) > (item.have || 1) * 5;
    const fallbackPlayUrl = item.spotify_id || item.youtube_id;

    const togglePlay = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (item.preview_url) {
            if (audioRef.current) {
                if (isPlaying) {
                    audioRef.current.pause();
                    setIsPlaying(false);
                } else {
                    // Try to play locally
                    audioRef.current.play()
                        .then(() => setIsPlaying(true))
                        .catch(err => {
                            console.error("Audio playback failed:", err);
                        });
                }
            }
        } else {
            // Fallback Genérico si no resolvió Preview URL
            if (fallbackPlayUrl && onPlay) {
                onPlay(fallbackPlayUrl);
            } else {
                window.location.href = `/archivo/${item.id}#play`;
            }
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (idx % 10) * 0.05 }}
            className="break-inside-avoid mb-4 md:mb-6 cursor-pointer"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                if (isPlaying && audioRef.current) {
                    audioRef.current.pause();
                    setIsPlaying(false);
                }
            }}
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
                    <div className={`absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10 transition-opacity duration-500 ${isHovered ? 'opacity-90' : 'opacity-40'}`} />

                    {/* Plástico Funda Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent mix-blend-overlay pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute inset-0 border border-white/10 rounded-t-2xl md:rounded-t-[2rem] pointer-events-none" />

                    {/* Audio Invisible Player */}
                    {item.preview_url && (
                        <audio
                            ref={audioRef}
                            src={item.preview_url}
                            onEnded={() => setIsPlaying(false)}
                            preload="none"
                        />
                    )}

                    {/* Botón Central de Play/Pause */}
                    {(item.preview_url || fallbackPlayUrl) && (
                        <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 pointer-events-none z-30 ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
                            <button
                                onClick={togglePlay}
                                className={`w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-md transition-all cursor-pointer pointer-events-auto ${isPlaying ? 'bg-primary border border-white text-black shadow-[0_0_40px_rgba(255,255,255,0.4)]' : 'bg-primary/90 text-black shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-110 hover:bg-white'}`}
                            >
                                {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} className="ml-1" fill="currentColor" />}
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
                        {item.status_warning && (
                            <div className="px-2 py-1 bg-red-500/20 backdrop-blur-md text-red-400 text-[8px] font-black uppercase tracking-widest rounded-full border border-red-500/30 shadow-lg">
                                OFFLINE
                            </div>
                        )}
                    </div>

                    {/* CABINA DE DJ (Hover Panel) */}
                    <div className={`absolute inset-x-0 bottom-0 p-4 transform transition-all duration-500 ${isHovered ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'} pointer-events-none`}>
                        {/* Indicadores BPM/Key de Alta Jerarquía */}
                        <div className="flex items-center gap-3 mb-4">
                            {item.bpm && (
                                <div className="flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-2 w-auto flex-1">
                                    <span className="text-[8px] text-white/40 uppercase tracking-[0.3em] font-mono mb-1">TEMPO</span>
                                    <span className="text-xl font-black text-white leading-none tracking-tight">{item.bpm}</span>
                                </div>
                            )}
                            {item.key && (
                                <div className="flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-2 w-auto flex-1">
                                    <span className="text-[8px] text-white/40 uppercase tracking-[0.3em] font-mono mb-1">KEY</span>
                                    <span className={`text-xl font-black leading-none tracking-tight ${item.key.includes('Major') ? 'text-primary' : 'text-purple-400'}`}>
                                        {item.key.split(' ')[0]}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Tracklist Resumido */}
                        {item.tracklist && item.tracklist.length > 0 && (
                            <div className="mt-2 pl-1 border-l-2 border-primary/30">
                                <ul className="text-white/80 text-[10px] space-y-1 font-mono">
                                    {item.tracklist.slice(0, 3).map((track, i) => (
                                        <li key={i} className="truncate select-none">
                                            <span className="text-primary/70 mr-2">{track.position}</span>
                                            {track.title}
                                        </li>
                                    ))}
                                    {item.tracklist.length > 3 && (
                                        <li className="text-white/40 italic">+{item.tracklist.length - 3} pistas más...</li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                {/* Base Metadata (Mantiene su estilo original pero más minimalista) */}
                <div className={`p-5 transition-transform duration-500 z-20 relative bg-[#0a0a0a] ${isHovered ? 'bg-[#0f0f0f]' : ''}`}>
                    <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-white font-display font-black text-sm md:text-md truncate uppercase tracking-tight mb-1 group-hover:text-primary transition-colors">
                                {item.title}
                            </h3>
                            <p className="text-gray-500 text-[10px] font-mono truncate uppercase tracking-widest opacity-80">
                                {item.artist}
                            </p>
                        </div>
                        {isPlaying && (
                            <div className="flex items-center gap-1 text-primary">
                                <Waves size={16} className="animate-pulse" />
                            </div>
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

