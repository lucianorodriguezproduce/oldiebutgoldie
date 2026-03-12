import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Users, ShoppingBag, Check, Save } from "lucide-react";
import { siteConfigService, type SiteConfig } from "@/services/siteConfigService";
import { useLoading } from "@/context/LoadingContext";

export default function PermissionConsole() {
    const [config, setConfig] = useState<SiteConfig | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const { showLoading, hideLoading } = useLoading();

    useEffect(() => {
        const unsubscribe = siteConfigService.onSnapshotConfig((newConfig) => {
            setConfig(newConfig);
        });
        return () => unsubscribe();
    }, []);

    const handleToggle = async (field: keyof SiteConfig) => {
        if (!config) return;
        const newValue = !config[field as keyof SiteConfig];

        try {
            await siteConfigService.updateConfig({ [field]: newValue });
        } catch (error) {
            console.error("Error updating config:", error);
            alert("Error al actualizar la configuración.");
        }
    };

    if (!config) return (
        <div className="flex items-center justify-center p-20 text-gray-500 font-mono animate-pulse">
            [ CARGANDO PROTOCOLOS DE SEGURIDAD... ]
        </div>
    );

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <header>
                <h1 className="text-5xl font-display font-black text-white tracking-tightest uppercase">
                    Consola de <span className="text-primary">Permisos</span>
                </h1>
                <p className="text-gray-500 mt-2 font-medium">
                    Control centralizado de mecánicas sociales y comerciales del Coliseo.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Friendship Permission */}
                <motion.div
                    whileHover={{ scale: 1.02 }}
                    className={`p-8 rounded-[2.5rem] border transition-all ${config.allow_user_friendships ? 'bg-primary/5 border-primary/20' : 'bg-white/5 border-white/10'}`}
                >
                    <div className="flex items-start justify-between">
                        <div className="space-y-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${config.allow_user_friendships ? 'bg-primary text-black' : 'bg-white/5 text-gray-500'}`}>
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-display font-black text-white uppercase tracking-tight">Alianzas Sociales</h3>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Permitir solicitudes de amistad entre usuarios</p>
                            </div>
                        </div>
                        <Switch
                            enabled={config.allow_user_friendships}
                            onChange={() => handleToggle('allow_user_friendships')}
                        />
                    </div>
                    <div className="mt-8 pt-6 border-t border-white/5">
                        <p className="text-[10px] font-mono text-gray-600 leading-relaxed uppercase">
                            {config.allow_user_friendships
                                ? "ESTADO: ACTIVO. Los usuarios pueden buscar y aliarse entre sí para ver colecciones privadas."
                                : "ESTADO: RESTRINGIDO. El radar social funciona en modo consulta. No se permiten nuevas alianzas."}
                        </p>
                    </div>
                </motion.div>

                {/* Master P2P Control (Protocol V24.8) */}
                <motion.div
                    whileHover={{ scale: 1.02 }}
                    className={`p-8 rounded-[2.5rem] border transition-all ${config.p2p_global_enabled ? 'bg-primary/5 border-primary/20' : 'bg-white/5 border-white/10'}`}
                >
                    <div className="flex items-start justify-between">
                        <div className="space-y-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${config.p2p_global_enabled ? 'bg-primary text-black' : 'bg-white/5 text-gray-500'}`}>
                                <Shield className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-display font-black text-white uppercase tracking-tight">Master P2P Switch</h3>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Habilitar visibilidad pública del Mercado P2P</p>
                            </div>
                        </div>
                        <Switch
                            enabled={config.p2p_global_enabled}
                            onChange={() => handleToggle('p2p_global_enabled' as any)}
                        />
                    </div>
                    <div className="mt-8 pt-6 border-t border-white/5">
                        <p className="text-[10px] font-mono text-gray-600 leading-relaxed uppercase">
                            {config.p2p_global_enabled
                                ? "ESTADO: GLOBAL. El acceso a /comercio está abierto para todos los usuarios."
                                : "ESTADO: DESACTIVADO. Solo administradores pueden ver el mercado activo."}
                        </p>
                    </div>
                </motion.div>

                {/* P2P Offers Permission */}
                <motion.div
                    whileHover={{ scale: 1.02 }}
                    className={`p-8 rounded-[2.5rem] border transition-all ${config.allow_p2p_public_offers ? 'bg-secondary/5 border-secondary/20' : 'bg-white/5 border-white/10'}`}
                >
                    <div className="flex items-start justify-between">
                        <div className="space-y-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${config.allow_p2p_public_offers ? 'bg-secondary text-black' : 'bg-white/5 text-gray-500'}`}>
                                <ShoppingBag className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-display font-black text-white uppercase tracking-tight">Ofertas Públicas</h3>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Permitir que usuarios hagan ofertas en discos de otros</p>
                            </div>
                        </div>
                        <Switch
                            enabled={config.allow_p2p_public_offers}
                            onChange={() => handleToggle('allow_p2p_public_offers')}
                        />
                    </div>
                    <div className="mt-8 pt-6 border-t border-white/5">
                        <p className="text-[10px] font-mono text-gray-600 leading-relaxed uppercase">
                            {config.allow_p2p_public_offers
                                ? "ESTADO: HABILITADO. Los botones de 'Ofertar' son visibles para el público."
                                : "ESTADO: BLOQUEADO. Las ofertas públicas están restringidas."}
                        </p>
                    </div>
                </motion.div>
            </div>

            {/* Warning Box */}
            <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-4">
                <Shield className="w-6 h-6 text-amber-500 shrink-0" />
                <p className="text-xs font-bold text-amber-500 uppercase tracking-widest leading-relaxed">
                    Atención: Los cambios en estos permisos afectan instantáneamente la visibilidad de botones y funcionalidades de negociación en toda la plataforma. Use con discreción.
                </p>
            </div>
        </div>
    );
}

function Switch({ enabled, onChange }: { enabled: boolean, onChange: () => void }) {
    return (
        <button
            onClick={onChange}
            className={`w-14 h-8 rounded-full transition-all relative ${enabled ? 'bg-primary shadow-[0_0_15px_rgba(204,255,0,0.3)]' : 'bg-white/10'}`}
        >
            <motion.div
                animate={{ x: enabled ? 24 : 4 }}
                className={`absolute top-1 w-6 h-6 rounded-full shadow-lg ${enabled ? 'bg-black' : 'bg-gray-400'}`}
            >
                {enabled && <Check className="w-4 h-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />}
            </motion.div>
        </button>
    );
}
