export type BlockType = 'text' | 'image_asymmetric' | 'quote' | 'vinyl_card' | 'spacer' | 'shared_storytelling';

export interface EditorialBlock {
    id: string; // unique identifier for the block
    type: BlockType;
    payload: any; // specific data based on type
    depth?: number; // Internal recursion control
}

// Payload Interfaces

export interface TextBlockPayload {
    content: string; // HTML string
    dropCap?: boolean;
}

export interface ImageAsymmetricPayload {
    url: string;
    caption?: string;
    alignment: 'left' | 'right' | 'center' | 'full';
    parallaxSpeed?: number;
    width?: 'auto' | '50%' | '100vw'; // Simplified for layout
}

export interface QuoteBlockPayload {
    quote: string;
    author?: string;
    floating?: boolean; // Breaks the grid and floats to the side
}

export interface VinylCardPayload {
    releaseId: string; // For [DISCO:ID] replacement
}

export interface SharedStorytellingPayload {
    itemId: string; // Internal_id to mirror blocks from
}

export interface SpacerPayload {
    height: 'sm' | 'md' | 'lg' | 'xl';
}
