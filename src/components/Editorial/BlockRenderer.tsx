import React from 'react';
import type { EditorialBlock } from '@/types/editorial';
import { TextBlock } from './Blocks/TextBlock';
import { AsymmetricImageBlock } from './Blocks/AsymmetricImageBlock';
import { QuoteBlock } from './Blocks/QuoteBlock';
import { SpacerBlock } from './Blocks/SpacerBlock';
import { EditorialItemCard } from './EditorialItemCard';
import { SharedStorytellingBlock } from './Blocks/SharedStorytellingBlock';

interface BlockRendererProps {
    blocks: EditorialBlock[];
    depth?: number;
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({ blocks, depth = 0 }) => {
    if (!blocks || blocks.length === 0) return null;

    return (
        <div className="editorial-blocks space-y-8 md:space-y-16 relative">
            {blocks.map((block) => {
                switch (block.type) {
                    case 'text':
                        return <TextBlock key={block.id} payload={block.payload} />;
                    case 'image_asymmetric':
                        return <AsymmetricImageBlock key={block.id} payload={block.payload} />;
                    case 'quote':
                        return <QuoteBlock key={block.id} payload={block.payload} />;
                    case 'spacer':
                        return <SpacerBlock key={block.id} payload={block.payload} />;
                    case 'vinyl_card':
                        return <div key={block.id} className="max-w-2xl mx-auto"><EditorialItemCard id={block.payload.releaseId} /></div>;
                    case 'shared_storytelling':
                        return <SharedStorytellingBlock key={block.id} itemId={block.payload.itemId} depth={depth} />;
                    default:
                        console.warn(`[BlockRenderer] Unknown block type: ${block.type}`);
                        return null;
                }
            })}
        </div>
    );
};
