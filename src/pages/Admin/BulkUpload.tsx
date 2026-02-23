import { useState, useEffect } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, ChevronDown, Search, PlusCircle, LayoutGrid, List, Lock, Download, Trash2 } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { discogsService, type DiscogsSearchResult } from "@/lib/discogs";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useLoading } from "@/context/LoadingContext";
import { pushBulkUploadCompleted } from "@/utils/analytics";

type ProcessingStatus = "WAITING" | "MATCH_FOUND" | "AMBIGUOUS" | "NOT_FOUND";

interface ParsedRow {
    id: string; // internal id
    originalArtist: string;
    originalTitle: string;
    originalPrice: number;
    originalCurrency: string;
    originalMedia: string;
    originalCover: string;
    status: ProcessingStatus;
    results: DiscogsSearchResult[];
    selectedMatch: DiscogsSearchResult | null;
    manualId?: string;
    published?: boolean;
}

const STAGING_KEY = "stitch_bulk_upload_staging";

export default function BulkUpload() {
    const { showLoading, hideLoading } = useLoading();
    const [isDragging, setIsDragging] = useState(false);
    const [rows, setRows] = useState<ParsedRow[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);

    // Initial Load from localStorage
    useEffect(() => {
        const savedStaging = localStorage.getItem(STAGING_KEY);
        if (savedStaging) {
            try {
                setRows(JSON.parse(savedStaging));
            } catch (e) {
                console.error("Error loading staging memory", e);
            }
        }
    }, []);

    // Save to localStorage whenever rows change and is not totally empty
    useEffect(() => {
        if (rows.length > 0) {
            localStorage.setItem(STAGING_KEY, JSON.stringify(rows));
        }
    }, [rows]);

    const generateSampleExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet([
            { Artista: "Pink Floyd", Álbum: "The Dark Side of the Moon", Precio: 85000, Moneda: "ARS", "Estado Media": "M/NM", "Estado Cover": "VG+" },
            { Artista: "Sui Generis", Álbum: "Instituciones", Precio: 45000, Moneda: "ARS", "Estado Media": "VG+", "Estado Cover": "VG" },
        ]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "PlantillaOBG");
        XLSX.writeFile(workbook, "Stitch_Bulk_Template.xlsx");
    };

    const handleClearWorkspace = () => {
        if (window.confirm("¿Estás seguro de limpiar la mesa de trabajo? Esto descartará el escaneo actual.")) {
            setRows([]);
            localStorage.removeItem(STAGING_KEY);
        }
    };

    const processFile = (file: File) => {
        setIsProcessing(true);
        if (file.name.endsWith(".csv")) {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => handleParsedData(results.data as any[])
            });
        } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: "array" });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                handleParsedData(jsonData);
            };
            reader.readAsArrayBuffer(file);
        } else {
            setIsProcessing(false);
            alert("Formato no soportado. Usa .CSV o .XLSX");
        }
    };

    const handleParsedData = async (data: any[]) => {
        const initialRows: ParsedRow[] = data.map((row, index) => {
            const getVal = (keys: string[]) => {
                const key = Object.keys(row).find(k => keys.some(ok => k.toLowerCase().includes(ok)));
                return key ? row[key] : "";
            };

            const artist = getVal(["artist", "artista", "band", "banda"]);
            const title = getVal(["title", "título", "titulo", "name", "nombre", "album", "álbum"]);
            const price = parseFloat(getVal(["price", "precio", "monto", "amount", "costo"])) || 0;
            const currency = getVal(["currency", "moneda", "divisa"]) || "ARS";
            const media = getVal(["media", "vinilo", "disco", "estado media", "record"]) || "Mint (M)";
            const cover = getVal(["cover", "tapa", "funda", "estado cover", "sleeve"]) || "Mint (M)";

            return {
                id: `row-${Date.now()}-${index}`,
                originalArtist: artist,
                originalTitle: title,
                originalPrice: price,
                originalCurrency: currency,
                originalMedia: media,
                originalCover: cover,
                status: "WAITING" as ProcessingStatus,
                results: [],
                selectedMatch: null
            };
        }).filter(r => r.originalTitle || r.originalArtist);

        setRows(initialRows);
        await processRowsInBatches(initialRows);
    };

    const processRowsInBatches = async (items: ParsedRow[]) => {
        const CHUNK_SIZE = 5;
        const newRows = [...items];

        for (let i = 0; i < newRows.length; i += CHUNK_SIZE) {
            const chunk = newRows.slice(i, i + CHUNK_SIZE);

            await Promise.all(chunk.map(async (row) => {
                const rowIndex = newRows.findIndex(r => r.id === row.id);
                try {
                    const query = `${row.originalArtist} ${row.originalTitle}`.trim();
                    const { results } = await discogsService.searchReleases(query, 1, undefined, "release", "vinyl");

                    if (results && results.length > 0) {
                        if (results.length === 1 || results[0].title.toLowerCase().includes(row.originalTitle.toLowerCase())) {
                            newRows[rowIndex].status = "MATCH_FOUND";
                            newRows[rowIndex].selectedMatch = results[0];
                        } else {
                            newRows[rowIndex].status = "AMBIGUOUS";
                            newRows[rowIndex].results = results.slice(0, 3);
                        }
                    } else {
                        newRows[rowIndex].status = "NOT_FOUND";
                    }
                } catch (error) {
                    console.error("Error searching discogs", error);
                    newRows[rowIndex].status = "NOT_FOUND";
                }
            }));

            setRows([...newRows]);
            setProgress(Math.round(((i + chunk.length) / newRows.length) * 100));
            if (i + CHUNK_SIZE < newRows.length) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }

        setIsProcessing(false);
    };

    const handleManualSearch = async (rowId: string, manualId: string) => {
        const rowIndex = rows.findIndex(r => r.id === rowId);
        if (rowIndex === -1 || !manualId) return;

        showLoading("Buscando Release...");
        try {
            const release = await discogsService.getReleaseDetails(manualId);
            const mappedResult: DiscogsSearchResult = {
                id: release.id,
                title: release.title,
                cover_image: release.images?.[0]?.resource_url || release.thumb,
                thumb: release.thumb,
                year: release.year?.toString() || "",
                resource_url: release.resource_url,
                type: "release",
                uri: release.uri
            };
            const newRows = [...rows];
            newRows[rowIndex].status = "MATCH_FOUND";
            newRows[rowIndex].selectedMatch = mappedResult;
            setRows(newRows);
        } catch (error) {
            alert("No se encontró el ID en Discogs");
        } finally {
            hideLoading();
        }
    };

    const handlePublish = async () => {
        const approved = rows.filter(r => r.status === "MATCH_FOUND" && r.selectedMatch && !r.published);
        if (approved.length === 0) return;

        showLoading(`Publicando ${approved.length} discos...`);
        let newRows = [...rows];
        let publishCount = 0;

        try {
            for (const row of approved) {
                const match = row.selectedMatch!;
                const orderData = {
                    title: match.title,
                    cover_image: match.cover_image,
                    totalPrice: row.originalPrice,
                    status: "store_offer",
                    is_admin_offer: true,
                    user_id: "oldiebutgoldie",
                    user_email: "admin@discography.ai",
                    user_name: "Stitch Admin",
                    view_count: 0,
                    currency: row.originalCurrency || "ARS",
                    details: match,
                    timestamp: serverTimestamp(),
                    createdAt: serverTimestamp(),
                    items: [{
                        id: match.id.toString(),
                        title: match.title,
                        artist: match.title.split('-')[0]?.trim() || "Desconocido",
                        format: match.format?.[0] || "Vinyl",
                        condition: `${row.originalMedia} / ${row.originalCover}`,
                        image: match.cover_image,
                        price: row.originalPrice,
                        timestamp: new Date()
                    }]
                };

                await addDoc(collection(db, "orders"), orderData);
                const rIndex = newRows.findIndex(r => r.id === row.id);
                newRows[rIndex].published = true;
                publishCount++;
            }
            setRows(newRows);
            pushBulkUploadCompleted(publishCount); // GA4 Analytics Trigger
            alert(`¡Se publicaron ${publishCount} discos exitosamente al catálogo!`);
        } catch (error) {
            console.error("Publish error", error);
            alert("Hubo un error al publicar algunos discos.");
        } finally {
            hideLoading();
        }
    };

    return (
        <div className="space-y-8 pb-32">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl md:text-5xl font-display font-black tracking-tight text-white uppercase drop-shadow-xl">
                        Ingesta Masiva
                    </h1>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest max-w-xl">
                        Acelerador de Inventario. Identificación y pre-validación automática con Discogs.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {rows.some(r => r.status === "MATCH_FOUND" && !r.published) ? (
                        <button
                            onClick={handlePublish}
                            className="px-8 py-4 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black font-black uppercase tracking-widest text-xs shadow-xl shadow-green-500/20 hover:shadow-green-500/40 transition-all flex items-center justify-center gap-2 transform hover:-translate-y-1"
                        >
                            <Upload className="w-4 h-4" /> Publicar Seleccionados
                        </button>
                    ) : (
                        <button
                            onClick={generateSampleExcel}
                            className="px-6 py-4 rounded-2xl border border-white/10 hover:bg-white/5 text-white font-bold uppercase tracking-widest text-[10px] transition-all flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" /> Plantilla XLSX
                        </button>
                    )}
                </div>
            </header>

            {/* Drag & Drop Zone */}
            {rows.length === 0 && !isProcessing && (
                <div
                    className={`w-full max-w-4xl h-72 border-2 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center transition-all cursor-pointer ${isDragging ? "border-primary bg-primary/5 scale-[1.02]" : "border-white/10 hover:border-white/30 hover:bg-white/5"
                        }`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        const file = e.dataTransfer.files[0];
                        if (file) processFile(file);
                    }}
                    onClick={() => document.getElementById('bulk-upload-input')?.click()}
                >
                    <input
                        id="bulk-upload-input"
                        type="file"
                        className="hidden"
                        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                        onChange={(e) => { if (e.target.files?.[0]) processFile(e.target.files[0]); }}
                    />
                    <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-primary/20">
                        <FileSpreadsheet className="w-10 h-10 text-primary" />
                    </div>
                    <p className="text-xl font-display font-black text-white mb-2 tracking-tight">Arrastra tu matriz aquí</p>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Soporta CSV y XLSX (Excel)</p>
                </div>
            )}

            {rows.length === 0 && !isProcessing && (
                <div className="max-w-4xl p-6 rounded-3xl bg-orange-500/5 border border-orange-500/20 flex flex-col sm:flex-row items-start gap-4 shadow-inner">
                    <AlertCircle className="w-6 h-6 text-orange-400 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                        <h4 className="text-sm font-black text-orange-400 uppercase tracking-widest">Requisito de Columnas</h4>
                        <p className="text-xs text-orange-400/80 font-bold leading-relaxed">
                            Para que el motor Stitch reconozca el catálogo automáticamente, tu archivo debe contener headers con palabras clave.
                            Ejemplos válidos: <span className="bg-orange-500/20 px-2 rounded text-orange-300">Artista, Title, Precio, Estado Cover</span>. Carga la plantilla para máxima precisión.
                        </p>
                    </div>
                </div>
            )}

            {isProcessing && (
                <div className="max-w-4xl p-8 rounded-[2.5rem] bg-white/5 border border-white/10 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-display font-black text-white tracking-tight flex items-center gap-3">
                            <span className="w-3 h-3 rounded-full bg-primary animate-ping" /> Procesando Lote
                        </h3>
                        <span className="text-primary font-mono font-bold">{progress}%</span>
                    </div>
                    <div className="h-2 bg-black rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2">
                        <Lock className="w-3 h-3" /> Aplicando rate limiting (Chunks de 5)
                    </p>
                </div>
            )}

            {/* Grid / Cards View (Table substitution) */}
            {rows.length > 0 && !isProcessing && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
                        <h3 className="text-xl font-display font-black text-white uppercase">{rows.length} Ítems Total</h3>
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> {rows.filter(r => r.status === 'MATCH_FOUND').length} Listos</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 ml-2" /> {rows.filter(r => r.status === 'AMBIGUOUS').length} Duda</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 ml-2" /> {rows.filter(r => r.status === 'NOT_FOUND').length} Fallo</span>
                            </div>
                            <button
                                onClick={handleClearWorkspace}
                                className="px-4 py-2 border border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 transition-colors"
                            >
                                <Trash2 className="w-3 h-3" /> Limpiar Mesa
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {rows.map((row, index) => (
                            <div key={row.id} className={`p-6 rounded-3xl border ${row.published ? 'bg-green-500/5 border-green-500/30 opacity-50' :
                                row.status === 'MATCH_FOUND' ? 'bg-white/5 border-white/10 hover:border-white/20' :
                                    row.status === 'AMBIGUOUS' ? 'bg-yellow-500/5 border-yellow-500/20' :
                                        'bg-red-500/5 border-red-500/20'
                                } transition-colors flex flex-col group relative overflow-hidden`}>
                                {/* Header / Original Data */}
                                <div className="mb-4 z-10 relative">
                                    <h4 className="font-black text-white text-lg leading-tight truncate">{row.originalTitle || "Sin Título"}</h4>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest truncate">{row.originalArtist || "Sin Artista"}</p>
                                    <div className="flex items-center justify-between mt-2">
                                        <p className="text-sm font-mono text-primary">${row.originalPrice} <span className="text-[10px] text-gray-500">{row.originalCurrency}</span></p>
                                        <p className="text-[9px] font-bold text-gray-500 uppercase bg-black/40 px-2 py-1 rounded">Media: {row.originalMedia} / Cover: {row.originalCover}</p>
                                    </div>
                                </div>

                                {/* Stitch Match Result */}
                                <div className="flex-1 mt-auto pt-4 border-t border-white/5 z-10 relative">
                                    {row.published ? (
                                        <div className="flex items-center justify-center gap-2 text-green-500 font-bold uppercase text-[10px] tracking-widest h-16 bg-green-500/10 rounded-2xl">
                                            <CheckCircle2 className="w-4 h-4" /> Publicado
                                        </div>
                                    ) : row.status === 'MATCH_FOUND' && row.selectedMatch ? (
                                        <div className="flex items-center gap-4">
                                            <img src={row.selectedMatch.thumb} alt="Cover" className="w-16 h-16 rounded-xl object-cover shadow-lg" />
                                            <div>
                                                <p className="text-xs font-bold text-white line-clamp-2">{row.selectedMatch.title}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="px-2 py-0.5 bg-white/10 rounded text-[9px] font-mono text-gray-300">ID: {row.selectedMatch.id}</span>
                                                    {row.selectedMatch.year && <span className="px-2 py-0.5 bg-white/10 rounded text-[9px] font-mono text-gray-300">{row.selectedMatch.year}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ) : row.status === 'AMBIGUOUS' ? (
                                        <div className="space-y-3">
                                            <p className="text-[10px] font-black uppercase text-yellow-500 tracking-widest flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" /> Selector de Versión
                                            </p>
                                            <div className="space-y-2">
                                                {row.results.map(res => (
                                                    <button
                                                        key={`ambig-${res.id}`}
                                                        onClick={() => {
                                                            const newRows = [...rows];
                                                            newRows[index].selectedMatch = res;
                                                            newRows[index].status = 'MATCH_FOUND';
                                                            setRows(newRows);
                                                        }}
                                                        className="w-full text-left p-2 rounded-xl bg-black/40 hover:bg-black/60 border border-white/5 flex items-center gap-3 transition-colors group/btn"
                                                    >
                                                        <img src={res.thumb} className="w-8 h-8 rounded-lg object-cover" />
                                                        <div className="flex-1 truncate">
                                                            <p className="text-[10px] font-bold text-white truncate group-hover/btn:text-primary transition-colors">{res.title}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <p className="text-[10px] font-black uppercase text-red-500 tracking-widest mb-1">Cruce de Datos Huérfano</p>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="URL o ID Discogs"
                                                    className="flex-1 bg-black/40 border border-red-500/20 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-red-500 placeholder:text-gray-600"
                                                    onChange={(e) => {
                                                        const newRows = [...rows];
                                                        newRows[index].manualId = e.target.value.split('/').pop() || e.target.value;
                                                        setRows(newRows);
                                                    }}
                                                />
                                                <button
                                                    onClick={() => handleManualSearch(row.id, row.manualId || "")}
                                                    className="p-2 bg-red-500/10 hover:bg-red-500/30 text-red-500 hover:text-white rounded-xl transition-colors"
                                                >
                                                    <Search className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
