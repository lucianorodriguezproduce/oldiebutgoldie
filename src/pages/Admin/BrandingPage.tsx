import React from 'react';
import { BrandingManager } from '@/components/Admin/BrandingManager';
import { Shield, Sparkles } from 'lucide-react';

const BrandingPage: React.FC = () => {
    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                        <Shield className="h-6 w-6 text-indigo-500" />
                    </div>
                    <h1 className="text-4xl font-black uppercase tracking-tighter">
                        Operación: <span className="text-indigo-500">Identidad Dinámica</span>
                    </h1>
                </div>
                <p className="text-zinc-500 font-medium max-w-2xl flex items-center gap-2 uppercase text-[10px] tracking-[0.2em]">
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    Gestión centralizada de activos de marca, blindaje de interfaz y sincronización con el búnker.
                </p>
            </div>

            <div className="border-t border-zinc-900 pt-8">
                <BrandingManager />
            </div>

            <div className="bg-zinc-950/50 border border-zinc-900 rounded-2xl p-6 mt-8">
                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    Protocolos de Seguridad Activos
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] text-zinc-500 uppercase tracking-tight">
                    <div className="p-4 bg-black/40 rounded-xl border border-zinc-900">
                        <span className="text-indigo-400 block mb-1">Capa 1: Validador</span>
                        Verificación de ratio y peso en tiempo real antes de la transmisión.
                    </div>
                    <div className="p-4 bg-black/40 rounded-xl border border-zinc-900">
                        <span className="text-amber-400 block mb-1">Capa 2: El Almacén</span>
                        Persistencia redundante en Google Drive (Oldie_Assets).
                    </div>
                    <div className="p-4 bg-black/40 rounded-xl border border-zinc-900">
                        <span className="text-emerald-400 block mb-1">Capa 3: Sincronía</span>
                        Punteros atómicos en Firestore para renderizado sin latencia.
                    </div>
                </div>
            </div>
        </div>
    );
};

// Re-using Terminal just in case it's needed for the UI, but I need to import it properly or use a placeholder
import { Terminal } from 'lucide-react';

export default BrandingPage;
