import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Disc, Search, SlidersHorizontal } from "lucide-react";
import { userAssetService } from "@/services/userAssetService";
import type { UserAsset } from "@/types/inventory";
import UserAssetCard from "./UserAssetCard";
import { CardSkeleton } from "@/components/ui/Skeleton";

interface UserCollectionProps {
    userId: string;
    readonly?: boolean;
}

export default function UserCollection({ userId, readonly = false }: UserCollectionProps) {
    const [assets, setAssets] = useState<UserAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        loadAssets();
    }, [userId]);

    const loadAssets = async () => {
        setLoading(true);
        try {
            const data = await userAssetService.getUserAssets(userId);
            setAssets(data);
        } catch (error) {
            console.error("Error loading user collection:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredAssets = assets.filter(asset =>
        asset.metadata.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.metadata.artist.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => <CardSkeleton key={i} />)}
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder={readonly ? "Buscar en la colección..." : "Buscar en mi búnker..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-12 py-4 text-sm text-white focus:border-primary/40 focus:outline-none transition-all"
                    />
                </div>
                <button className="flex items-center gap-2 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all">
                    <SlidersHorizontal className="w-4 h-4" /> Filtros
                </button>
            </div>

            {/* Grid */}
            {filteredAssets.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    <AnimatePresence mode="popLayout">
                        {filteredAssets.map(asset => (
                            <UserAssetCard
                                key={asset.id}
                                asset={asset}
                                onUpdate={loadAssets}
                                readonly={readonly}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            ) : (
                <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[3rem] space-y-6 text-center">
                    <Disc className="h-12 w-12 text-gray-700 animate-[spin_10s_linear_infinite]" />
                    <div className="space-y-2">
                        <p className="text-xl font-display font-medium text-gray-500">
                            {searchQuery ? "No se encontraron discos para esta búsqueda" : (readonly ? "Esta colección aún está vacía" : "Tu búnker personal está vacío")}
                        </p>
                        {!searchQuery && (
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">
                                Los discos que compres aparecerán aquí para comercio
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
