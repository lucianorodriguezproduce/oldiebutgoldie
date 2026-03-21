import React, { useState } from 'react';
import type { EditorialBlock, BlockType } from '@/types/editorial';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ChevronUp, ChevronDown, List, AlignLeft, AlignRight, AlignCenter, Image as ImageIcon, Type, Quote, Box, Disc } from 'lucide-react';
import { DriveUpload } from '@/components/Admin/DriveUpload';

interface BlockEditorProps {
    blocks: EditorialBlock[];
    onChange: (blocks: EditorialBlock[]) => void;
}

export const BlockEditor: React.FC<BlockEditorProps> = ({ blocks, onChange }) => {
    
    const generateId = () => Math.random().toString(36).substr(2, 9);

    const addBlock = (type: BlockType) => {
        let payload: any = {};
        if (type === 'text') payload = { content: '', dropCap: false };
        if (type === 'image_asymmetric') payload = { url: '', alignment: 'center', width: 'auto', parallaxSpeed: 0 };
        if (type === 'quote') payload = { quote: '', author: '', floating: false };
        if (type === 'spacer') payload = { height: 'md' };
        if (type === 'vinyl_card') payload = { releaseId: '' };

        onChange([...blocks, { id: generateId(), type, payload }]);
    };

    const updateBlock = (index: number, payload: any) => {
        const newBlocks = [...blocks];
        newBlocks[index].payload = { ...newBlocks[index].payload, ...payload };
        onChange(newBlocks);
    };

    const removeBlock = (index: number) => {
        const newBlocks = [...blocks];
        newBlocks.splice(index, 1);
        onChange(newBlocks);
    };

    const moveBlock = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === blocks.length - 1) return;
        const newBlocks = [...blocks];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        const temp = newBlocks[index];
        newBlocks[index] = newBlocks[swapIndex];
        newBlocks[swapIndex] = temp;
        onChange(newBlocks);
    };

    const renderPayloadEditor = (block: EditorialBlock, index: number) => {
        switch (block.type) {
            case 'text':
                return (
                    <div className="space-y-4">
                        <textarea
                            value={block.payload.content}
                            onChange={e => updateBlock(index, { content: e.target.value })}
                            className="w-full bg-white/5 border-white/5 font-mono text-sm rounded-xl p-4 text-white focus:border-primary h-32"
                            placeholder="<p>HTML content goes here...</p>"
                        />
                        <label className="flex items-center gap-2 text-xs text-gray-400">
                            <input type="checkbox" checked={block.payload.dropCap} onChange={e => updateBlock(index, { dropCap: e.target.checked })} />
                            Enable Drop Cap (First Letra Grande)
                        </label>
                    </div>
                );
            case 'image_asymmetric':
                return (
                    <div className="space-y-4">
                        <div className="flex gap-4 items-center">
                            <DriveUpload onUploadSuccess={(url) => updateBlock(index, { url })} />
                            <input 
                                value={block.payload.url} 
                                onChange={e => updateBlock(index, { url: e.target.value })}
                                placeholder="Image URL (or upload from Drive)"
                                className="flex-1 bg-white/5 border-white/5 rounded-xl p-3 text-white text-xs"
                            />
                        </div>
                        <input 
                            value={block.payload.caption || ''} 
                            onChange={e => updateBlock(index, { caption: e.target.value })}
                            placeholder="Caption (optional)"
                            className="w-full bg-white/5 border-white/5 rounded-xl p-3 text-white text-xs"
                        />
                        <div className="grid grid-cols-3 gap-4">
                            <select value={block.payload.alignment} onChange={e => updateBlock(index, { alignment: e.target.value })} className="bg-white/5 text-white p-2 rounded-lg text-xs">
                                <option value="left">Left Align</option>
                                <option value="center">Center</option>
                                <option value="right">Right Align</option>
                                <option value="full">Full Bleed</option>
                            </select>
                            <select value={block.payload.width} onChange={e => updateBlock(index, { width: e.target.value })} className="bg-white/5 text-white p-2 rounded-lg text-xs">
                                <option value="auto">Auto (Contained)</option>
                                <option value="50%">50% Width</option>
                                <option value="100vw">100vw (Full Width)</option>
                            </select>
                            <label className="flex items-center gap-2 text-xs text-gray-400">
                                <input type="checkbox" checked={block.payload.parallaxSpeed > 0} onChange={e => updateBlock(index, { parallaxSpeed: e.target.checked ? 0.2 : 0 })} />
                                Parallax FX
                            </label>
                        </div>
                    </div>
                );
            case 'quote':
                return (
                    <div className="space-y-4">
                        <textarea
                            value={block.payload.quote}
                            onChange={e => updateBlock(index, { quote: e.target.value })}
                            className="w-full bg-white/5 border-white/5 rounded-xl p-4 text-white text-xl font-bold h-24"
                            placeholder="Quote text..."
                        />
                        <div className="flex gap-4">
                            <input 
                                value={block.payload.author || ''} 
                                onChange={e => updateBlock(index, { author: e.target.value })}
                                placeholder="Author"
                                className="flex-1 bg-white/5 border-white/5 rounded-xl p-3 text-white text-xs"
                            />
                            <label className="flex items-center gap-2 text-xs text-gray-400">
                                <input type="checkbox" checked={block.payload.floating} onChange={e => updateBlock(index, { floating: e.target.checked })} />
                                Floating Asymmetric
                            </label>
                        </div>
                    </div>
                );
            case 'vinyl_card':
                return (
                    <input 
                        value={block.payload.releaseId} 
                        onChange={e => updateBlock(index, { releaseId: e.target.value })}
                        placeholder="Discogs Release ID / Inventory ID"
                        className="w-full bg-white/5 border-white/5 rounded-xl p-3 text-white text-xs"
                    />
                );
            case 'spacer':
                return (
                    <select value={block.payload.height} onChange={e => updateBlock(index, { height: e.target.value })} className="w-full bg-white/5 text-white p-3 rounded-xl text-xs">
                        <option value="sm">Small (32px)</option>
                        <option value="md">Medium (64px)</option>
                        <option value="lg">Large (96px)</option>
                        <option value="xl">X-Large (128px)</option>
                    </select>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <Box className="w-4 h-4 text-primary" /> Block Builder
                </h3>
            </div>
            
            <div className="space-y-4">
                {blocks.map((block, index) => (
                    <div key={block.id} className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden group">
                        <div className="bg-white/5 px-4 py-2 flex justify-between items-center border-b border-white/5">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{block.type.replace('_', ' ')}</span>
                            <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                                <button type="button" onClick={() => moveBlock(index, 'up')} className="p-1 hover:bg-white/10 rounded"><ChevronUp className="w-4 h-4 text-white" /></button>
                                <button type="button" onClick={() => moveBlock(index, 'down')} className="p-1 hover:bg-white/10 rounded"><ChevronDown className="w-4 h-4 text-white" /></button>
                                <button type="button" onClick={() => removeBlock(index)} className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <div className="p-4">
                            {renderPayloadEditor(block, index)}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => addBlock('text')} className="bg-white/5 border-white/10 hover:bg-primary hover:text-black text-xs h-10 gap-2"><Type className="w-4 h-4"/> Text</Button>
                <Button type="button" variant="outline" onClick={() => addBlock('image_asymmetric')} className="bg-white/5 border-white/10 hover:bg-primary hover:text-black text-xs h-10 gap-2"><ImageIcon className="w-4 h-4"/> Image</Button>
                <Button type="button" variant="outline" onClick={() => addBlock('quote')} className="bg-white/5 border-white/10 hover:bg-primary hover:text-black text-xs h-10 gap-2"><Quote className="w-4 h-4"/> Quote</Button>
                <Button type="button" variant="outline" onClick={() => addBlock('vinyl_card')} className="bg-white/5 border-white/10 hover:bg-primary hover:text-black text-xs h-10 gap-2"><Disc className="w-4 h-4"/> Vinyl Card</Button>
                <Button type="button" variant="outline" onClick={() => addBlock('spacer')} className="bg-white/5 border-white/10 hover:bg-primary hover:text-black text-xs h-10 gap-2"><Box className="w-4 h-4"/> Spacer</Button>
            </div>
        </div>
    );
};
