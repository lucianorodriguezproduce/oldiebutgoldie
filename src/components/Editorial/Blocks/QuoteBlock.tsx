import React from 'react';
import type { QuoteBlockPayload } from '@/types/editorial';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export const QuoteBlock: React.FC<{ payload: QuoteBlockPayload }> = ({ payload }) => {
    return (
        <motion.div
            initial={{ opacity: 0, x: payload.floating ? 50 : 0, y: payload.floating ? 0 : 30 }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
                "relative z-10 py-12 md:py-24",
                payload.floating
                    ? "md:w-[120%] md:-ml-[10%] text-right"
                    : "max-w-4xl mx-auto text-center"
            )}
        >
            <blockquote className="space-y-6">
                <p className={cn(
                    "font-display font-black leading-[1.1] text-white tracking-tighter uppercase",
                    payload.floating ? "text-4xl md:text-6xl" : "text-4xl md:text-7xl"
                )}>
                    "{payload.quote}"
                </p>
                {payload.author && (
                    <footer className="text-primary font-bold tracking-widest uppercase text-xs">
                        — {payload.author}
                    </footer>
                )}
            </blockquote>
        </motion.div>
    );
};
