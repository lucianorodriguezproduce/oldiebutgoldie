import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, CheckCircle, AlertCircle, Loader2, Upload, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { siteConfigService, type SiteConfig } from '@/services/siteConfigService';

interface BrandingStatus {
    loading: boolean;
    error: string | null;
    success: boolean;
}

export const BrandingManager: React.FC = () => {
    const [logoStatus, setLogoStatus] = useState<BrandingStatus>({ loading: false, error: null, success: false });
    const [faviconStatus, setFaviconStatus] = useState<BrandingStatus>({ loading: false, error: null, success: false });
    const [config, setConfig] = useState<SiteConfig | null>(null);

    // Estados de validación previa (V11.3)
    const [isLogoValid, setIsLogoValid] = useState(true);
    const [isFaviconValid, setIsFaviconValid] = useState(true);

    const logoInputRef = useRef<HTMLInputElement>(null);
    const faviconInputRef = useRef<HTMLInputElement>(null);

    // Cargar configuración actual al montar
    useEffect(() => {
        const fetchConfig = async () => {
            const currentConfig = await siteConfigService.getConfig();
            if (currentConfig) setConfig(currentConfig);
        };
        fetchConfig();

        // Suscripción en tiempo real opcional para el panel
        return siteConfigService.onSnapshotConfig(setConfig);
    }, []);

    const validateAndUpload = async (file: File, type: 'logo' | 'favicon') => {
        const setStatus = type === 'logo' ? setLogoStatus : setFaviconStatus;
        const setValidity = type === 'logo' ? setIsLogoValid : setIsFaviconValid;

        setStatus({ loading: true, error: null, success: false });

        try {
            // 1. Client-Side Validation
            if (type === 'favicon') {
                if (file.size > 500 * 1024) throw new Error('Favicon debe ser menor a 500KB');
                const img = new Image();
                img.src = URL.createObjectURL(file);
                await new Promise((resolve, reject) => {
                    img.onload = () => {
                        if (img.width !== img.height) {
                            setValidity(false);
                            reject(new Error('Error de Proporción: El Favicon debe ser cuadrado (1:1) para evitar deformaciones en la pestaña del navegador.'));
                        }
                        resolve(true);
                    };
                    img.onerror = () => reject(new Error('Error al leer imagen'));
                });
            } else {
                if (file.size > 2 * 1024 * 1024) throw new Error('Logo debe ser menor a 2MB');
            }

            setValidity(true);

            // 2. Upload to Firebase Storage
            const extension = file.name.split('.').pop() || 'png';
            const storagePath = `branding/${type}_current.${extension}`;
            const storageRef = ref(storage, storagePath);

            const snapshot = await uploadBytes(storageRef, file, {
                contentType: file.type,
                cacheControl: 'public, max-age=3600'
            });

            const downloadURL = await getDownloadURL(snapshot.ref);

            // 3. Update Firestore via service
            await siteConfigService.updateConfig({
                [type]: {
                    url: downloadURL,
                    updatedAt: new Date().toISOString()
                }
            });

            setStatus({ loading: false, error: null, success: true });
            setTimeout(() => setStatus(s => ({ ...s, success: false })), 3000);

        } catch (err: any) {
            console.error(`Branding ${type} error:`, err);
            setStatus({ loading: false, error: err.message, success: false });
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
        const file = e.target.files?.[0];
        if (file) validateAndUpload(file, type);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
            {/* LOGO MANAGER */}
            <Card className="border-zinc-800 bg-zinc-950 text-white shadow-xl">
                <CardHeader className="border-b border-zinc-900 pb-4">
                    <CardTitle className="flex items-center justify-between text-lg font-bold uppercase tracking-tighter w-full">
                        <div className="flex items-center gap-2 text-indigo-500">
                            <ImageIcon className="h-5 w-5" />
                            Identidad Dinámica: LOGO
                        </div>
                        <div className="group relative">
                            <Info className="h-4 w-4 text-zinc-500 cursor-help hover:text-white transition-colors" />
                            <div className="absolute right-0 top-6 w-64 p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-[9px] font-medium text-zinc-400 opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 shadow-2xl">
                                Para evitar el pixelado en pantallas 4K, utiliza archivos exportados a 72 PPI o superior en formato vectorial (SVG).
                            </div>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative group w-full">
                            <div className="h-40 w-full rounded-lg bg-zinc-900 flex items-center justify-center border-2 border-dashed border-zinc-800 group-hover:border-indigo-500/50 transition-all overflow-hidden p-6">
                                {config?.logo?.url ? (
                                    <img
                                        src={config.logo.url}
                                        alt="Logo actual"
                                        className="max-h-full max-w-full object-contain filter drop-shadow-lg"
                                    />
                                ) : (
                                    <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors text-xs uppercase tracking-widest">Sin Logo Configurado</span>
                                )}
                            </div>
                            <input
                                type="file"
                                className="hidden"
                                ref={logoInputRef}
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, 'logo')}
                            />
                        </div>

                        <p className="text-[10px] text-zinc-500 font-medium text-center px-4 leading-relaxed group-hover:text-zinc-400 transition-colors">
                            Recomendado: 1200x400px. Formato: SVG o PNG (fondo transparente). El sistema escalará la imagen automáticamente conservando la nitidez.
                        </p>

                        <Button
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-wider py-6"
                            onClick={() => logoInputRef.current?.click()}
                            disabled={logoStatus.loading || !isLogoValid}
                        >
                            {logoStatus.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                            {logoStatus.loading ? 'Subiendo...' : 'Actualizar Logo'}
                        </Button>

                        {logoStatus.error && (
                            <div className="flex items-center gap-2 text-red-500 text-sm mt-2 font-bold text-center px-4">
                                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                {logoStatus.error}
                            </div>
                        )}
                        {logoStatus.success && (
                            <div className="flex items-center gap-2 text-green-500 text-sm mt-2">
                                <CheckCircle className="h-4 w-4" />
                                Logo actualizado globalmente.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* FAVICON MANAGER */}
            <Card className="border-zinc-800 bg-zinc-950 text-white shadow-xl">
                <CardHeader className="border-b border-zinc-900 pb-4">
                    <CardTitle className="flex items-center justify-between text-lg font-bold uppercase tracking-tighter w-full">
                        <div className="flex items-center gap-2 text-amber-500">
                            <Camera className="h-5 w-5" />
                            Identidad Dinámica: FAVICON
                        </div>
                        <div className="group relative">
                            <Info className="h-4 w-4 text-zinc-500 cursor-help hover:text-white transition-colors" />
                            <div className="absolute right-0 top-6 w-64 p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-[9px] font-medium text-zinc-400 opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 shadow-2xl">
                                Los navegadores modernos prefieren SVGs para nitidez infinita en dispositivos de alta densidad. PNG es una alternativa robusta.
                            </div>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative group">
                            <div className="h-24 w-24 rounded-lg bg-zinc-900 flex items-center justify-center border-2 border-dashed border-zinc-800 group-hover:border-amber-500/50 transition-all overflow-hidden">
                                {config?.favicon?.url ? (
                                    <img
                                        src={config.favicon.url}
                                        alt="Favicon actual"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-zinc-600 group-hover:text-zinc-400 text-[8px] uppercase tracking-widest text-center px-1">Sin Icono</span>
                                )}
                            </div>
                            <input
                                type="file"
                                className="hidden"
                                ref={faviconInputRef}
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, 'favicon')}
                            />
                        </div>

                        <p className="text-[10px] text-zinc-500 font-medium text-center px-4 leading-relaxed group-hover:text-zinc-400 transition-colors">
                            Requerido: Relación 1:1 (Cuadrado). Recomendado: 512x512px. Formato: PNG o SVG.
                        </p>

                        <ul className="text-[9px] text-zinc-600 uppercase tracking-widest leading-tight w-full text-center list-none space-y-1 opacity-60">
                            <li>• Formato: PNG / ICO / SVG</li>
                            <li>• Ratio: 1:1 estricto</li>
                            <li>• Max: 500KB</li>
                        </ul>

                        <Button
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold uppercase tracking-wider py-6"
                            onClick={() => faviconInputRef.current?.click()}
                            disabled={faviconStatus.loading || !isFaviconValid}
                        >
                            {faviconStatus.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                            {faviconStatus.loading ? 'Subiendo...' : 'Actualizar Favicon'}
                        </Button>

                        {faviconStatus.error && (
                            <div className="flex items-center gap-2 text-red-500 text-sm mt-2 font-bold text-center px-4">
                                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                {faviconStatus.error}
                            </div>
                        )}
                        {faviconStatus.success && (
                            <div className="flex items-center gap-2 text-green-500 text-sm mt-2">
                                <CheckCircle className="h-4 w-4" />
                                Favicon actualizado con éxito.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
