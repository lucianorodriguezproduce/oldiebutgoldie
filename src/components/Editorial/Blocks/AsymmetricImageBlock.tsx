import React from 'react';
import type { ImageAsymmetricPayload } from '@/types/editorial';
import { cn } from '@/lib/utils';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

export const AsymmetricImageBlock: React.FC<{ payload: ImageAsymmetricPayload }> = ({ payload }) => {
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"]
    });

    // Parallax logic
    const y = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);

    // Determine constraints and styling based on width/alignment
    const alignments = {
        left: "mr-auto",
        center: "mx-auto",
        right: "ml-auto",
        full: "w-full mx-auto"
    };

    const widths = {
        auto: "w-auto max-w-[80%] md:max-w-2xl",
        '50%': "w-full md:w-1/2",
        '100vw': "w-screen max-w-none relative left-1/2 -translate-x-1/2"
    };

    return (
        <div ref={ref} className={cn("py-8 md:py-16 overflow-hidden", payload.width === '100vw' && "px-0")}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-20%" }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                className={cn(alignments[payload.alignment], widths[payload.width || 'auto'], "px-4 md:px-0")}
            >
                <div className="overflow-hidden rounded-2xl md:rounded-[3rem] shadow-2xl relative">
                    <motion.img
                        style={{ y: payload.parallaxSpeed ? y : 0, scale: payload.parallaxSpeed ? 1.2 : 1 }}
                        src={payload.url}
                        alt={payload.caption || "Editorial imagery"}
                        className="w-full h-full object-cover grayscale-[0.2] hover:grayscale-0 transition-all duration-1000"
                    />
                </div>
                {payload.caption && (
                    <motion.p
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="text-[10px] uppercase font-black tracking-widest text-gray-500 mt-6 text-center md:text-left"
                    >
                        {payload.caption}
                    </motion.p>
                )}
            </motion.div>
        </div>
    );
};
