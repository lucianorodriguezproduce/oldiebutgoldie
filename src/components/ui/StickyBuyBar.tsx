import React from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { TEXTS } from '@/constants/texts';

interface StickyBuyBarProps {
    title: string;
    artist: string;
    price: number;
    stock: number;
    onBuy: () => void;
    isLocal: boolean;
}

export const StickyBuyBar: React.FC<StickyBuyBarProps> = ({ title, artist, price, stock, onBuy, isLocal }) => {
    const { scrollY } = useScroll();
    // Show the bar only after the user has scrolled past the main hero (e.g. 800px)
    const opacity = useTransform(scrollY, [600, 800], [0, 1]);
    const y = useTransform(scrollY, [600, 800], [50, 0]);

    // Determine if it should be visible based on scroll
    const [isVisible, setIsVisible] = React.useState(false);

    React.useEffect(() => {
        return scrollY.onChange((latest) => {
            if (latest > 700 && !isVisible) setIsVisible(true);
            if (latest <= 700 && isVisible) setIsVisible(false);
        });
    }, [scrollY, isVisible]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 50 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-2xl"
                >
                    <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-full p-2 pr-4 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                        <div className="flex flex-col pl-6">
                            <span className="text-white font-bold text-sm truncate max-w-[200px] md:max-w-[300px]">{title}</span>
                            <span className="text-gray-400 font-black uppercase tracking-widest text-[9px] truncate max-w-[200px] md:max-w-[300px]">{artist}</span>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="hidden md:flex flex-col text-right">
                                <span className="text-primary font-black tracking-widest text-lg">${price.toLocaleString()}</span>
                                <span className={cn("text-[9px] font-black uppercase tracking-widest", stock > 0 ? "text-green-500" : "text-amber-500")}>
                                    {stock > 0 ? `${stock} EN STOCK` : "AGOTADO"}
                                </span>
                            </div>
                            <Button
                                onClick={onBuy}
                                variant="secondary"
                                className={cn(
                                    "h-12 rounded-full px-8 font-black uppercase text-xs transition-colors",
                                    stock > 0 ? "bg-white text-black hover:bg-primary" : "bg-white/10 text-white hover:bg-white/20"
                                )}
                            >
                                <ShoppingBag className="w-4 h-4 mr-2" />
                                {isLocal ? (stock > 0 ? "Comprar" : "Pedir") : "Cotizar"}
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
