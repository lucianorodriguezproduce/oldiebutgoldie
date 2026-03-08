import React, { useState } from "react";
import { motion } from "framer-motion";
import { Disc, DollarSign, ArrowRightLeft, ShieldCheck, Tag, Minus, Plus, Package } from "lucide-react";
import { LazyImage } from "@/components/ui/LazyImage";
import type { UserAsset } from "@/types/inventory";
import { userAssetService } from "@/services/userAssetService";

interface UserAssetCardProps {
    asset: UserAsset;
    onUpdate: () => void;
    readonly?: boolean;
}

export default function UserAssetCard({ asset, onUpdate, readonly = false }: UserAssetCardProps) {
    const [isUpdating, setIsUpdating] = useState(false);
    const [showPricing, setShowPricing] = useState(false);
    const [price, setPrice] = useState(asset.valuation?.toString() || "");
    const [localStock, setLocalStock] = useState(asset.stock ?? 1);

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
            await userAssetService.toggleTradeable(asset.id, !asset.isTradeable);
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
            await userAssetService.toggleTradeable(asset.id, asset.isTradeable, val);
            setShowPricing(false);
            onUpdate();
        } catch (error) {
            console.error("Error updating price:", error);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="group relative bg-white/[0.03] border border-white/5 rounded-[2rem] overflow-hidden hover:border-primary/30 transition-all duration-500"
        >
            {/* Image Container */}
            <div className="aspect-square relative overflow-hidden">
                <LazyImage
                    src={asset.media.full_res_image_url || asset.media.thumbnail}
                    alt={asset.metadata.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />

                {/* Status Badges */}
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                    {asset.isTradeable && (
                        <div className="bg-primary text-black px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-xl">
                            <ArrowRightLeft className="w-3 h-3" /> Disponible
                        </div>
                    )}
                    <div className="bg-black/60 backdrop-blur-md text-white/70 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-white/10 flex items-center gap-1.5">
                        <ShieldCheck className="w-3 h-3 text-primary" /> Propiedad Verificada
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
                <div className="space-y-1">
                    <h3 className="text-sm font-black text-white uppercase tracking-tight truncate">
                        {asset.metadata.title}
                    </h3>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">
                        {asset.metadata.artist}
                    </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Valoración</span>
                        <span className="text-xs font-black text-white">${asset.valuation?.toLocaleString()}</span>
                    </div>
                    {!readonly && (
                        <button
                            onClick={() => setShowPricing(!showPricing)}
                            className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                        >
                            <Tag className="w-4 h-4 text-gray-400" />
                        </button>
                    )}
                </div>

                {/* Stock Control */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                        <Package className="w-3 h-3 text-gray-600" />
                        <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Stock</span>
                    </div>
                    <div className="flex items-center gap-1">
                        {!readonly ? (
                            <>
                                <button
                                    onClick={() => handleStockChange(-1)}
                                    disabled={localStock <= 0}
                                    className="w-6 h-6 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                                >
                                    <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-7 text-center text-xs font-black text-white tabular-nums">{localStock}</span>
                                <button
                                    onClick={() => handleStockChange(1)}
                                    className="w-6 h-6 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-all"
                                >
                                    <Plus className="w-3 h-3" />
                                </button>
                            </>
                        ) : (
                            <span className="text-xs font-black text-white px-2">{localStock}</span>
                        )}
                    </div>
                </div>

                {/* Controls */}
                {!readonly && (
                    <div className="grid grid-cols-1 gap-2 pt-2">
                        <button
                            onClick={handleToggleTradeable}
                            disabled={isUpdating}
                            className={`w-full py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${asset.isTradeable
                                ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20"
                                : "bg-primary text-black hover:bg-white"
                                }`}
                        >
                            {isUpdating ? "Procesando..." : asset.isTradeable ? "Retirar de Comercio" : "Poner en Comercio"}
                        </button>
                    </div>
                )}
            </div>

            {/* Pricing Overlay */}
            {showPricing && (
                <div className="absolute inset-0 bg-black/90 backdrop-blur-sm p-6 flex flex-col justify-center gap-4 animate-in fade-in zoom-in duration-300">
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
