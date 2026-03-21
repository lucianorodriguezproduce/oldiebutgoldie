import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Disc, DollarSign, ArrowRightLeft, ShieldCheck, Tag, Minus, Plus, Package, Play, Pause, Waves } from "lucide-react";
import { LazyImage } from "@/components/ui/LazyImage";
import type { UserAsset } from "@/types/inventory";
import { userAssetService } from "@/services/userAssetService";

interface UserAssetCardProps {
    asset: UserAsset;
    onUpdate: () => void;
    readonly?: boolean;
    isNegotiating?: boolean;
    isReserved?: boolean;
}

export default function UserAssetCard({ 
    asset, 
    onUpdate, 
    readonly = false,
    isNegotiating = false,
    isReserved = false
}: UserAssetCardProps) {
    const [isUpdating, setIsUpdating] = useState(false);
    const [showPricing, setShowPricing] = useState(false);
    const [price, setPrice] = useState(asset.logistics?.price?.toString() || "0");
    const [localStock, setLocalStock] = useState(asset.logistics?.stock ?? 1);
    const [isHovered, setIsHovered] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const handleStockChange = async (delta: number) => {
        const newStock = Math.max(0, localStock + delta);
        setLocalStock(newStock);
        try {
            await userAssetService.updateStock(asset.id, newStock);
        } catch (error) {
            console.error("Error updating stock:", error);
            setLocalStock(localStock); // revert
        }
    };

    const handleToggleTradeable = async () => {
        setIsUpdating(true);
        try {
            await userAssetService.toggleTradeable(asset.id, !asset.logistics.isTradeable);
            onUpdate();
        } catch (error) {
            console.error("Error toggling tradeable:", error);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleUpdatePrice = async () => {
        const val = parseFloat(price);
        if (isNaN(val)) return;

        setIsUpdating(true);
        try {
            await userAssetService.toggleTradeable(asset.id, asset.logistics.isTradeable, val);
            setShowPricing(false);
            onUpdate();
        } catch (error) {
            console.error("Error updating price:", error);
        } finally {
            setIsUpdating(false);
        }
    };

    const togglePlay = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (asset.metadata.preview_url) {
            if (audioRef.current) {
                if (isPlaying) {
                    audioRef.current.pause();
                    setIsPlaying(false);
                } else {
                    audioRef.current.play()
                        .then(() => setIsPlaying(true))
                        .catch(err => {
                            console.error("Audio playback failed:", err);
                        });
                }
            }
        } else {
            // Fallback: Si tiene spotify_id o youtube_id, podríamos delegar
            // por ahora mantenemos el comportamiento de navegación si no hay preview
            if (!readonly) {
                window.location.href = `/archivo/${asset.id}#play`;
            }
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                if (isPlaying && audioRef.current) {
                    audioRef.current.pause();
                    setIsPlaying(false);
                }
            }}
            className={`group relative bg-white/[0.03] border rounded-[2rem] overflow-hidden transition-all duration-500 backdrop-blur-sm ${
                isReserved 
                    ? 'border-orange-500/50 ring-2 ring-orange-500/20 animate-pulse-subtle' 
                    : isNegotiating 
                        ? 'border-primary/50' 
                        : 'border-white/5 hover:border-primary/30'
            }`}
        >
            {/* Image Container */}
            <div className="aspect-square relative overflow-hidden">
                <LazyImage
                    src={asset.media.full_res_image_url || asset.media.thumbnail}
                    alt={asset.metadata.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className={`absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent transition-opacity duration-500 ${isHovered ? 'opacity-90' : 'opacity-60'}`} />

                {/* Audio Player */}
                {asset.metadata.preview_url && (
                    <audio
                        ref={audioRef}
                        src={asset.metadata.preview_url}
                        onEnded={() => setIsPlaying(false)}
                        preload="none"
                    />
                )}

                {/* Play Button Overlay */}
                {(asset.metadata.preview_url || asset.metadata.spotify_id || asset.metadata.youtube_id) && (
                    <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 z-30 ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
                        <button
                            onClick={togglePlay}
                            className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${isPlaying ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'bg-primary/90 text-black hover:scale-110'}`}
                        >
                            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} className="ml-0.5" fill="currentColor" />}
                        </button>
                    </div>
                )}

                {/* Status Badges */}
                <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
                    {isReserved ? (
                        <div className="bg-orange-500 text-black px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-xl animate-pulse">
                            <ArrowRightLeft className="w-3 h-3" /> RESERVADO (Esq. Pago)
                        </div>
                    ) : isNegotiating ? (
                        <div className="bg-primary/80 backdrop-blur-md text-black px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-xl">
                            <ArrowRightLeft className="w-3 h-3" /> En Negociación
                        </div>
                    ) : asset.logistics?.isTradeable ? (
                        <div className="bg-primary text-black px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-xl">
                            <ArrowRightLeft className="w-3 h-3" /> Disponible
                        </div>
                    ) : null}
                    
                    <div className="bg-black/60 backdrop-blur-md text-white/70 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-white/10 flex items-center gap-1.5">
                        <ShieldCheck className="w-3 h-3 text-primary" /> Propiedad Verificada
                    </div>
                </div>

                {/* BPM / Key Overlay (Bottom Left) */}
                <div className={`absolute left-4 bottom-4 flex gap-2 transition-all duration-500 z-20 ${isHovered ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                    {asset.metadata.bpm && (
                        <div className="bg-black/80 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">
                            <span className="text-[7px] text-white/40 block leading-none uppercase tracking-widest mb-0.5">BPM</span>
                            <span className="text-[10px] font-black text-white">{asset.metadata.bpm}</span>
                        </div>
                    )}
                    {asset.metadata.key && (
                        <div className="bg-black/80 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">
                            <span className="text-[7px] text-white/40 block leading-none uppercase tracking-widest mb-0.5">KEY</span>
                            <span className="text-[10px] font-black text-primary">{asset.metadata.key}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 relative">
                <div className="space-y-1">
                    <h3 className="text-sm font-black text-white uppercase tracking-tight truncate group-hover:text-primary transition-colors">
                        {asset.metadata.title}
                    </h3>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">
                        {asset.metadata.artist}
                    </p>
                </div>

                {/* Tracklist Resumido (On Hover) */}
                {isHovered && asset.tracklist && asset.tracklist.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="overflow-hidden border-l-2 border-primary/30 pl-3 py-1"
                    >
                        <ul className="space-y-1">
                            {asset.tracklist.slice(0, 3).map((track, i) => (
                                <li key={i} className="text-[9px] font-mono text-gray-400 truncate">
                                    <span className="text-primary/50 mr-2">{track.position}</span>
                                    {track.title}
                                </li>
                            ))}
                            {asset.tracklist.length > 3 && (
                                <li className="text-[8px] text-gray-600 italic">+{asset.tracklist.length - 3} pistas más...</li>
                            )}
                        </ul>
                    </motion.div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Valoración</span>
                        <span className="text-xs font-black text-white">${asset.logistics?.price?.toLocaleString()}</span>
                    </div>
                    {!readonly && (
                        <button
                            onClick={() => !isReserved && setShowPricing(!showPricing)}
                            disabled={isReserved}
                            className={`p-2 rounded-xl transition-colors ${isReserved ? 'opacity-20 cursor-not-allowed' : 'hover:bg-white/5 text-gray-400'}`}
                        >
                            <Tag className="w-4 h-4" />
                        </button>
                    )}
                    {isPlaying && (
                        <div className="flex items-center gap-1 text-primary">
                            <Waves size={14} className="animate-pulse" />
                        </div>
                    )}
                </div>

                {/* Stock Control */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                        <Package className="w-3 h-3 text-gray-600" />
                        <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Stock</span>
                    </div>
                    <div className="flex items-center gap-1">
                        {!readonly && !isReserved ? (
                            <>
                                <button
                                    onClick={() => handleStockChange(-1)}
                                    disabled={localStock <= 0 || isUpdating}
                                    className="w-6 h-6 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                                >
                                    <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-7 text-center text-xs font-black text-white tabular-nums">{localStock}</span>
                                <button
                                    onClick={() => handleStockChange(1)}
                                    disabled={isUpdating}
                                    className="w-6 h-6 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-all disabled:opacity-20"
                                >
                                    <Plus className="w-3 h-3" />
                                </button>
                            </>
                        ) : (
                            <span className="text-xs font-black text-white px-2 opacity-50">{localStock}</span>
                        )}
                    </div>
                </div>

                {/* Controls */}
                {!readonly && (
                    <div className="grid grid-cols-1 gap-2 pt-2">
                        <button
                            onClick={handleToggleTradeable}
                            disabled={isUpdating || isReserved}
                            className={`w-full py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                                isReserved
                                    ? "bg-white/5 text-gray-500 border border-white/10 cursor-not-allowed"
                                    : asset.logistics?.isTradeable
                                        ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20"
                                        : "bg-primary text-black hover:bg-white"
                                }`}
                        >
                            {isUpdating ? "Procesando..." : isReserved ? "ITEM CONGELADO / RESERVADO" : asset.logistics?.isTradeable ? "Retirar de Comercio" : "Poner en Comercio"}
                        </button>
                    </div>
                )}
            </div>

            {/* Pricing Overlay */}
            {showPricing && (
                <div className="absolute inset-0 bg-black/90 backdrop-blur-sm p-6 flex flex-col justify-center gap-4 animate-in fade-in zoom-in duration-300 z-50">
                    <h4 className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">Definir Precio de Oferta</h4>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-9 py-3 text-white font-bold text-sm focus:border-primary focus:outline-none transition-all"
                            placeholder="Ej: 45000"
                            autoFocus
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleUpdatePrice}
                            className="flex-1 bg-white text-black py-3 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary transition-colors"
                        >
                            Confirmar
                        </button>
                        <button
                            onClick={() => setShowPricing(false)}
                            className="px-4 bg-white/5 text-gray-400 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
                        >
                            X
                        </button>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
