import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Disc, Layers, Plus, ArrowRight } from 'lucide-react';
import { TEXTS } from '@/constants/texts';

interface ItemConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: any;
    onConfirm: (config: { format: string; condition: string }, action: 'another' | 'finish') => void;
}

const FORMATS = ['VINILO', 'CD', 'CASETTE', 'DVD'];
const CONDITIONS = ['NUEVO', 'USADO'];

export default function ItemConfigModal({ isOpen, onClose, item, onConfirm }: ItemConfigModalProps) {
    const [format, setFormat] = useState<string>('');
    const [condition, setCondition] = useState<string>('');

    const isComplete = format !== '' && condition !== '';

    if (!item) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-lg bg-[#0A0A0A] border-2 border-primary/20 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-primary/10"
                    >
                        {/* Header with Item Info */}
                        <div className="relative h-32 overflow-hidden">
                            <img
                                src={item.cover_image || item.thumb}
                                alt=""
                                className="w-full h-full object-cover blur-sm opacity-30"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] to-transparent" />
                            <div className="absolute inset-0 flex items-end p-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-black">
                                        <img src={item.thumb} alt="" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-xl font-display font-black text-white uppercase tracking-tighter truncate">{item.title}</h3>
                                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{item.normalizedArtist || 'Configuración de Ítem'}</p>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all hover:bg-white/10"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-8 space-y-8">
                            {/* Format Selection */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 italic px-2">
                                    {TEXTS.album.item.steps.format}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {FORMATS.map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setFormat(f)}
                                            className={`py-4 rounded-2xl text-[10px] font-black tracking-widest border-2 transition-all flex items-center justify-center gap-2 ${format === f ? 'bg-primary border-primary text-black' : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/10'}`}
                                        >
                                            <Disc className="w-3 h-3" />
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Condition Selection */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 italic px-2">
                                    {TEXTS.album.item.steps.condition}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {CONDITIONS.map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setCondition(c)}
                                            className={`py-4 rounded-2xl text-[10px] font-black tracking-widest border-2 transition-all flex items-center justify-center gap-2 ${condition === c ? 'bg-primary border-primary text-black' : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/10'}`}
                                        >
                                            <Layers className="w-3 h-3" />
                                            {c}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="pt-4 space-y-3">
                                <button
                                    disabled={!isComplete}
                                    onClick={() => onConfirm({ format, condition }, 'another')}
                                    className="w-full flex items-center justify-center gap-2 py-5 rounded-2xl bg-white/5 border border-white/10 text-white font-black uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all disabled:opacity-20 disabled:grayscale"
                                >
                                    <Plus className="w-4 h-4" />
                                    {TEXTS.album.item.steps.addAnother}
                                </button>

                                <button
                                    disabled={!isComplete}
                                    onClick={() => onConfirm({ format, condition }, 'finish')}
                                    className="w-full flex items-center justify-center gap-2 py-5 rounded-2xl bg-primary text-black font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20 disabled:grayscale"
                                >
                                    {TEXTS.album.item.steps.finishOrder}
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
