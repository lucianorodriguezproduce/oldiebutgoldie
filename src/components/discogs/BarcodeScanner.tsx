import { useState } from "react";
import { ScanLine, X, Search, Disc, CheckCircle2 } from "lucide-react";
import { discogsService, type DiscogsSearchResult } from "@/lib/discogs";
import { motion, AnimatePresence } from "framer-motion";

interface BarcodeScannerProps {
    onClose: () => void;
    onResultSelected: (result: DiscogsSearchResult) => void;
}

export function BarcodeScanner({ onClose, onResultSelected }: BarcodeScannerProps) {
    const [scannedCode, setScannedCode] = useState<string>("");
    const [isScanning, setIsScanning] = useState(false);
    const [status, setStatus] = useState<"idle" | "searching" | "found" | "error">("idle");
    const [searchResult, setSearchResult] = useState<DiscogsSearchResult | null>(null);

    // Mockup para la integración de cámara/escáner
    const handleSimulateScan = async () => {
        setIsScanning(true);
        setStatus("searching");

        // Simulación: Consultar un código válido (ej. UPC/EAN) a la API de Búsqueda
        const barcodeToTest = "194397758614";

        try {
            // El endpoint de discogs database/search acepta "barcode"
            // Por simplicidad en este esqueleto, usamos el querystring estándar de nuestro servicio
            // O idealmente extender discogsService.searchReleases para soportar query param 'barcode'
            const response = await discogsService.searchReleases(barcodeToTest, 1, undefined, "release");

            if (response.results && response.results.length > 0) {
                setSearchResult(response.results[0]);
                setStatus("found");
                setScannedCode(barcodeToTest);
            } else {
                setStatus("error");
            }
        } catch (error) {
            console.error(error);
            setStatus("error");
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-[#0a0a0a] rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl flex flex-col"
            >
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <ScanLine className="w-5 h-5 text-primary" />
                        <h2 className="font-bold uppercase tracking-widest text-sm text-white">Escáner de Batea</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Viewfinder Area */}
                <div className="relative aspect-square bg-black border-b border-white/5 flex items-center justify-center">
                    {!isScanning ? (
                        <div className="absolute inset-8 border-2 border-dashed border-white/20 rounded-3xl flex flex-col items-center justify-center text-center p-6 space-y-4">
                            <Disc className="w-12 h-12 text-gray-700" />
                            <p className="text-sm font-medium text-gray-400">Enfoca el código de barras del disco</p>
                            <button
                                onClick={handleSimulateScan}
                                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 transition-colors"
                            >
                                Simular Captura
                            </button>
                        </div>
                    ) : (
                        <div className="absolute inset-x-0 h-0.5 bg-primary/50 shadow-[0_0_20px_rgba(204,255,0,0.5)] animate-scan" />
                    )}

                    {status === "searching" && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                            <Search className="w-8 h-8 text-primary animate-pulse" />
                            <span className="ml-3 text-sm font-black uppercase tracking-widest text-primary">Buscando...</span>
                        </div>
                    )}
                </div>

                {/* Result Area */}
                <div className="p-6 bg-[#0a0a0a]">
                    <AnimatePresence mode="wait">
                        {status === "idle" && (
                            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center text-xs text-gray-500 uppercase tracking-widest">
                                Esperando Escaneo
                            </motion.p>
                        )}

                        {status === "found" && searchResult && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 text-center">
                                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto" />
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-1">Disco Identificado</p>
                                    <h3 className="font-bold text-white line-clamp-1">{searchResult.title}</h3>
                                    <p className="text-xs text-primary">{scannedCode}</p>
                                </div>
                                <button
                                    onClick={() => onResultSelected(searchResult)}
                                    className="w-full py-4 bg-primary text-black rounded-xl font-black uppercase tracking-widest text-xs hover:bg-white transition-colors"
                                >
                                    Abrir Ficha Técnica
                                </button>
                            </motion.div>
                        )}

                        {status === "error" && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center space-y-2">
                                <p className="text-sm text-red-500 font-bold uppercase tracking-widest">No Encontrado</p>
                                <p className="text-xs text-gray-500">Intenta escanear nuevamente o búscalo manualmente en el catálogo.</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
