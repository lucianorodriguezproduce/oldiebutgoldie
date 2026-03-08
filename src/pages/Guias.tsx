import React from 'react';
import { Book, Shield, MessageSquare, Info } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Guias() {
    const guias = [
        {
            title: "Cómo Comprar",
            description: "Guía paso a paso para adquirir vinilos y reliquias en Oldie But Goldie.",
            icon: Book,
            color: "text-primary"
        },
        {
            title: "Cómo Vender",
            description: "Aprendé a cotizar tu lote y enviarlo a nuestro La Batea de forma segura.",
            icon: Shield,
            color: "text-secondary"
        },
        {
            title: "Sistema de Trading",
            description: "Entendé cómo funcionan las contraofertas y el cambio de turno.",
            icon: MessageSquare,
            color: "text-accent"
        },
        {
            title: "Estado y Calificación",
            description: "Nuestros estándares de calidad (Goldmine Standard) explicados.",
            icon: Info,
            color: "text-gray-400"
        }
    ];

    return (
        <div className="min-h-screen bg-black pt-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                <header className="space-y-4 max-w-2xl">
                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl md:text-5xl font-black font-display tracking-tightest leading-tight"
                    >
                        GUÍAS DE <span className="text-primary">PROTOCOLO</span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="text-gray-400 text-sm leading-relaxed"
                    >
                        Manuales técnicos para dominar el arte del coleccionismo analógico y la soberanía de datos en nuestra red.
                    </motion.p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {guias.map((guia, idx) => (
                        <motion.div
                            key={guia.title}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="p-8 rounded-[2rem] bg-white/[0.03] border border-white/10 hover:border-primary/30 transition-all group"
                        >
                            <guia.icon className={`w-8 h-8 ${guia.color} mb-6 group-hover:scale-110 transition-transform`} />
                            <h3 className="text-xl font-display font-black text-white uppercase tracking-widest mb-2">{guia.title}</h3>
                            <p className="text-gray-500 text-sm leading-relaxed">{guia.description}</p>
                            <button className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:text-white transition-colors">
                                Leer Manual Completo +
                            </button>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}
