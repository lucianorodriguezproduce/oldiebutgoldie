import { memo } from "react";
import { motion } from "framer-motion";
import { LazyImage } from "@/components/ui/LazyImage";
import { Star } from "lucide-react";
import type { DiscogsSearchResult } from "@/lib/discogs";

export const CompactSearchCard = memo(({ result, idx, onClick }: { result: DiscogsSearchResult, idx: number, onClick: () => void }) => {
    const isLocal = (result as any).isLocal === true;

    return (
        <motion.button
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.03, 0.3) }}
            onClick={onClick}
            className={`group relative flex flex-col items-start bg-white/[0.03] border ${isLocal ? 'border-primary/30 shadow-[0_0_30px_rgba(204,255,0,0.1)]' : 'border-white/5'} hover:border-primary/40 rounded-xl overflow-hidden transition-all text-left aspect-square md:aspect-[3/4] shadow-2xl w-full`}
        >
            <div className="w-full h-full relative">
                <LazyImage
                    src={result.cover_image || result.thumb}
                    alt={result.title}
                    className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-transform duration-700 group-hover:scale-110"
                />

                {/* Local Inventory Badge */}
                {isLocal && (
                    <div className="absolute top-2 left-2 z-20">
                        <div className="px-2 py-1 bg-primary text-black rounded-lg flex items-center gap-1 shadow-lg transform scale-75 md:scale-100 origin-top-left">
                            <Star className="h-2.5 w-2.5 fill-black" />
                            <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest">EN STOCK</span>
                        </div>
                    </div>
                )}

                {/* Style Badge */}
                {(result.style?.[0] || result.genre?.[0]) && (
                    <div className="absolute top-2 right-2 z-20">
                        <div className="px-2 py-1 bg-white/10 backdrop-blur-md text-white/70 border border-white/10 rounded-lg transform scale-75 md:scale-100 origin-top-right">
                            <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest">
                                {result.style?.[0] || result.genre?.[0]}
                            </span>
                        </div>
                    </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-80 group-hover:opacity-40 transition-opacity" />

                <div className="absolute inset-x-0 bottom-0 p-2 md:p-6 space-y-0.5 z-10">
                    <h5 className="text-[9px] md:text-lg font-bold font-display italic text-white leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                        {(result as any).normalizedAlbum || (result.title.includes(' - ') ? result.title.split(' - ')[1] : result.title)}
                    </h5>
                    <span className="text-[7px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none truncate block">
                        {(result as any).normalizedArtist || (result.title.includes(' - ') ? result.title.split(' - ')[0] : result.title)}
                    </span>
                </div>

                {/* Mobile Type Indicator - Hidden when Local to avoid clutter */}
                {!isLocal && result.type && (
                    <div className="absolute top-1.5 left-1.5 px-1 py-0.5 rounded-sm bg-black/60 backdrop-blur-md border border-white/5 md:top-4 md:left-4 md:px-2 md:py-1">
                        <span className="text-[5px] md:text-[8px] font-black uppercase tracking-tighter text-white/60">{result.type}</span>
                    </div>
                )}
            </div>
        </motion.button>
    );
});

CompactSearchCard.displayName = "CompactSearchCard";
