import React, { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, CheckCircle, AlertCircle, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface BrandingStatus {
    loading: boolean;
    error: string | null;
    success: boolean;
}

export const BrandingManager: React.FC = () => {
    const [logoStatus, setLogoStatus] = useState<BrandingStatus>({ loading: false, error: null, success: false });
    const [faviconStatus, setFaviconStatus] = useState<BrandingStatus>({ loading: false, error: null, success: false });

    const logoInputRef = useRef<HTMLInputElement>(null);
    const faviconInputRef = useRef<HTMLInputElement>(null);

    const validateAndUpload = async (file: File, type: 'logo' | 'favicon') => {
        const setStatus = type === 'logo' ? setLogoStatus : setFaviconStatus;
        setStatus({ loading: true, error: null, success: false });

        try {
            // 1. Client-Side Validation
            if (type === 'favicon') {
                if (file.size > 500 * 1024) throw new Error('Favicon debe ser menor a 500KB');

                // Ratio 1:1 check
                const img = new Image();
                img.src = URL.createObjectURL(file);
                await new Promise((resolve, reject) => {
                    img.onload = () => {
                        if (img.width !== img.height) reject(new Error('Favicon debe ser cuadrado (Ratio 1:1)'));
                        resolve(true);
                    };
                    img.onerror = () => reject(new Error('Error al leer imagen'));
                });
            } else {
                if (file.size > 2 * 1024 * 1024) throw new Error('Logo debe ser menor a 2MB');
            }

            // 2. Convert to Base64
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve, reject) => {
                reader.onload = () => {
                    const res = reader.result as string;
                    resolve(res.split(',')[1]); // Remove data:image/xxx;base64,
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            // 3. API Call
            const response = await fetch('/api/admin/branding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    base64,
                    fileName: file.name,
                    mimeType: file.type
                })
            });

            const result = await response.json();
            if (!response.ok) {
                const errorDetail = result.details ? `: ${result.details}` : '';
                const errorCode = result.code ? ` [${result.code}]` : '';
                throw new Error(`${result.error || 'Upload failed'}${errorDetail}${errorCode}`);
            }

            setStatus({ loading: false, error: null, success: true });

            // Auto-reset success after 3s
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
                    <CardTitle className="flex items-center gap-2 text-lg font-bold uppercase tracking-tighter">
                        <ImageIcon className="h-5 w-5 text-indigo-500" />
                        Identidad Dinámica: LOGO
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative group">
                            <div className="h-32 w-64 rounded-lg bg-zinc-900 flex items-center justify-center border-2 border-dashed border-zinc-800 group-hover:border-indigo-500/50 transition-all overflow-hidden p-4">
                                <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors">Vista Previa Logo</span>
                            </div>
                            <input
                                type="file"
                                className="hidden"
                                ref={logoInputRef}
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, 'logo')}
                            />
                        </div>

                        <Button
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-wider py-6"
                            onClick={() => logoInputRef.current?.click()}
                            disabled={logoStatus.loading}
                        >
                            {logoStatus.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                            {logoStatus.loading ? 'Subiendo...' : 'Subir Nuevo Logo'}
                        </Button>

                        {logoStatus.error && (
                            <div className="flex items-center gap-2 text-red-500 text-sm mt-2 animate-pulse">
                                <AlertCircle className="h-4 w-4" />
                                {logoStatus.error}
                            </div>
                        )}
                        {logoStatus.success && (
                            <div className="flex items-center gap-2 text-green-500 text-sm mt-2">
                                <CheckCircle className="h-4 w-4" />
                                Logo actualizado en el Búnker.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* FAVICON MANAGER */}
            <Card className="border-zinc-800 bg-zinc-950 text-white shadow-xl">
                <CardHeader className="border-b border-zinc-900 pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg font-bold uppercase tracking-tighter">
                        <Camera className="h-5 w-5 text-amber-500" />
                        Identidad Dinámica: FAVICON
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative group">
                            <div className="h-24 w-24 rounded-lg bg-zinc-900 flex items-center justify-center border-2 border-dashed border-zinc-800 group-hover:border-amber-500/50 transition-all">
                                <span className="text-zinc-600 group-hover:text-zinc-400 text-xs">Favicon (1:1)</span>
                            </div>
                            <input
                                type="file"
                                className="hidden"
                                ref={faviconInputRef}
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, 'favicon')}
                            />
                        </div>

                        <ul className="text-[10px] text-zinc-500 uppercase tracking-widest leading-tight w-full text-center list-none">
                            <li>• Formato: PNG / ICO</li>
                            <li>• Ratio: 1:1 estricto</li>
                            <li>• Max: 500KB</li>
                        </ul>

                        <Button
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold uppercase tracking-wider py-6"
                            onClick={() => faviconInputRef.current?.click()}
                            disabled={faviconStatus.loading}
                        >
                            {faviconStatus.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                            {faviconStatus.loading ? 'Subiendo...' : 'Subir Nuevo Favicon'}
                        </Button>

                        {faviconStatus.error && (
                            <div className="flex items-center gap-2 text-red-500 text-sm mt-2 animate-pulse">
                                <AlertCircle className="h-4 w-4" />
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
