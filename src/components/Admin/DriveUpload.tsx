import { useState, useCallback } from "react";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DriveUploadProps {
    onUploadSuccess: (link: string) => void;
}

export const DriveUpload = ({ onUploadSuccess }: DriveUploadProps) => {
    const [isDragging, setIsDragging] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState("");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const handleUpload = async (file: File) => {
        // Validate 1920x1080px (Optional but recommended)
        // For now, let's just ensure it's an image
        if (!file.type.startsWith('image/')) {
            setUploadStatus('error');
            setErrorMessage("Por favor, selecciona una imagen.");
            return;
        }

        setUploadStatus('uploading');
        setPreviewUrl(URL.createObjectURL(file));

        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64Content = (reader.result as string).split(',')[1];

                const response = await fetch('/api/drive_upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        file: base64Content,
                        fileName: file.name,
                        fileType: file.type
                    })
                });

                const data = await response.json();

                if (data.success) {
                    setUploadStatus('success');
                    onUploadSuccess(data.directLink);
                } else {
                    throw new Error(data.error || "Fallo en la carga");
                }
            };
        } catch (error: any) {
            setUploadStatus('error');
            setErrorMessage(error.message);
        }
    };

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleUpload(file);
    }, []);

    const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleUpload(file);
    };

    return (
        <div className="w-full">
            <motion.div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`relative min-h-[300px] rounded-[2.5rem] border-2 border-dashed transition-all duration-500 flex flex-col items-center justify-center p-8 overflow-hidden bg-black/40 backdrop-blur-xl ${isDragging ? 'border-[#CCFF00] bg-[#CCFF00]/5 scale-[1.02]' : 'border-white/10 hover:border-white/20'
                    }`}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent -z-10" />

                <AnimatePresence mode="wait">
                    {uploadStatus === 'idle' && (
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center space-y-6"
                        >
                            <div className="w-20 h-20 bg-[#CCFF00]/10 rounded-[2rem] flex items-center justify-center mx-auto ring-1 ring-[#CCFF00]/20">
                                <Upload className="h-8 w-8 text-[#CCFF00]" />
                            </div>
                            <div>
                                <h4 className="text-xl font-display font-black text-white tracking-tightest uppercase mb-2">
                                    Carga tu <span className="text-[#CCFF00]">Imagen Editorial</span>
                                </h4>
                                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">
                                    Drag & Drop o click para seleccionar 1920x1080
                                </p>
                            </div>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={onFileSelect}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                        </motion.div>
                    )}

                    {uploadStatus === 'uploading' && (
                        <motion.div
                            key="uploading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center space-y-6"
                        >
                            <Loader2 className="h-12 w-12 text-[#CCFF00] animate-spin mx-auto" />
                            <p className="text-[#CCFF00] font-black uppercase tracking-widest text-xs animate-pulse">
                                Sincronizando con Google Drive...
                            </p>
                            {previewUrl && (
                                <div className="w-48 h-27 bg-white/5 rounded-2xl overflow-hidden ring-1 ring-white/10 mx-auto aspect-video">
                                    <img src={previewUrl} className="w-full h-full object-cover opacity-50 grayscale" alt="Preview" />
                                </div>
                            )}
                        </motion.div>
                    )}

                    {uploadStatus === 'success' && (
                        <motion.div
                            key="success"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-center space-y-6"
                        >
                            <div className="w-20 h-20 bg-green-500/10 rounded-[2rem] flex items-center justify-center mx-auto ring-1 ring-green-500/20">
                                <CheckCircle className="h-8 w-8 text-green-500" />
                            </div>
                            <h4 className="text-green-500 font-black uppercase tracking-widest text-xs">
                                Archivo Público Generado
                            </h4>
                            <button
                                onClick={() => setUploadStatus('idle')}
                                className="px-6 py-2 bg-white/10 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all"
                            >
                                Subir Otro
                            </button>
                        </motion.div>
                    )}

                    {uploadStatus === 'error' && (
                        <motion.div
                            key="error"
                            initial={{ x: 10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className="text-center space-y-6"
                        >
                            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                            <div>
                                <h4 className="text-red-500 font-black uppercase tracking-widest text-xs mb-2">
                                    Error de Sincronización
                                </h4>
                                <p className="text-gray-500 text-[10px] font-medium">{errorMessage}</p>
                            </div>
                            <button
                                onClick={() => setUploadStatus('idle')}
                                className="px-6 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                            >
                                Reintentar
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};
