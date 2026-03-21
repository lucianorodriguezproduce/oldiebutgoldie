import React from 'react';
import type { TextBlockPayload } from '@/types/editorial';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export const TextBlock: React.FC<{ payload: TextBlockPayload }> = ({ payload }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
                "prose prose-invert prose-lg max-w-[800px] mx-auto text-gray-300 leading-[1.8] text-xl md:text-2xl font-serif px-4 md:px-0",
                payload.dropCap && "first-letter:text-7xl first-letter:font-black first-letter:text-primary first-letter:mr-3 first-letter:float-left first-letter:leading-none"
            )}
            dangerouslySetInnerHTML={{ __html: payload.content }}
        />
    );
};
