import { useQuery } from "@tanstack/react-query";
import { archivoService } from "@/services/archivoService";
import { Link } from "react-router-dom";
import { ShoppingCart, Zap, Layers } from "lucide-react";
import { LazyImage } from "@/components/ui/LazyImage";
import { motion } from "framer-motion";

interface EditorialItemCardProps {
    id: string;
}

export function EditorialItemCard({ id }: EditorialItemCardProps) {
    const { data: item, isLoading } = useQuery({
        queryKey: ['editorial-item', id],
        queryFn: () => archivoService.getItemById(id)
    });

    if (isLoading) {
        return (
            <div className="my-8 w-full max-w-md bg-white/5 border border-white/5 rounded-2xl p-4 animate-pulse">
                <div className="flex gap-4">
                    <div className="w-24 h-24 bg-white/5 rounded-xl" />
                    <div className="flex-1 space-y-3 py-2">
                        <div className="h-4 bg-white/5 rounded w-3/4" />
                        <div className="h-3 bg-white/5 rounded w-1/2" />
                    </div>
                </div>
            </div>
        );
    }

    if (!item) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="my-8 w-full max-w-md bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden hover:border-primary/30 transition-all group"
        >
            <div className="flex p-4 gap-5">
                <div className="w-24 md:w-32 aspect-square rounded-xl overflow-hidden border border-white/10 shadow-xl flex-shrink-0">
                    <LazyImage
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                </div>

                <div className="flex flex-col justify-between flex-1 py-1">
                    <div>
                        <h4 className="text-white font-display font-black text-sm md:text-md uppercase tracking-tight line-clamp-1 group-hover:text-primary transition-colors">
                            {item.title}
                        </h4>
                        <p className="text-gray-500 text-[10px] font-mono uppercase tracking-widest mb-2 italic">
                            {item.artist}
                        </p>
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${item.source === 'inventory' ? 'bg-primary/20 text-primary' : 'bg-white/5 text-gray-400'
                                }`}>
                                {item.source === 'inventory' ? 'TIENDA OBG' : 'COLECCIÓN PRIVADA'}
                            </span>
                        </div>
                    </div>

                    <div className="mt-4">
                        {item.source === 'inventory' ? (
                            <Link
                                to={`/?add=${item.id}`}
                                className="flex items-center justify-center gap-2 w-full py-2.5 bg-primary text-black rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-white transition-all shadow-lg shadow-primary/10"
                            >
                                <ShoppingCart className="w-3.5 h-3.5" />
                                COMPRAR AHORA
                            </Link>
                        ) : (
                            <Link
                                to="/"
                                className="flex items-center justify-center gap-2 w-full py-2.5 bg-white/10 text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-primary hover:text-black transition-all border border-white/10"
                            >
                                <Layers className="w-3.5 h-3.5" />
                                SOLICITAR TRADE
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
