import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { archivoService } from '@/services/archivoService';
import { BlockRenderer } from '../BlockRenderer';
import { Loader2 } from 'lucide-react';

interface SharedStorytellingBlockProps {
    itemId: string;
    depth?: number;
}

export const SharedStorytellingBlock: React.FC<SharedStorytellingBlockProps> = ({ itemId, depth = 0 }) => {
    // Safety Guard: Max recursion depth of 2
    if (depth > 2) {
        console.warn(`[SharedStorytelling] Max recursion depth reached for item: ${itemId}`);
        return null;
    }

    const { data: item, isLoading, error } = useQuery({
        queryKey: ['storytelling_mirror', itemId],
        queryFn: () => archivoService.getItemById(itemId),
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
        );
    }

    if (error || !item || !item.blocks || item.blocks.length === 0) {
        return null; // Silent fail for shared blocks
    }

    return (
        <div className="shared-storytelling-wrapper bg-white/[0.01] rounded-[3rem] p-8 md:p-12 border border-white/[0.03]">
            <BlockRenderer blocks={item.blocks} depth={depth + 1} />
        </div>
    );
};
