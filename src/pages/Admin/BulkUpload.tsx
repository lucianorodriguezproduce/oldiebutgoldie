import { useState, useEffect } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, ChevronDown, Search, PlusCircle, LayoutGrid, List, Lock, Download, Trash2 } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { discogsService, type DiscogsSearchResult } from "@/lib/discogs";
import { addDoc, collection, serverTimestamp, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
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
    inBatch?: boolean;
    page?: number;
    hasMore?: boolean;
}

const STAGING_KEY = "stitch_bulk_upload_staging";

export default function BulkUpload() {
    const { showLoading, hideLoading } = useLoading();
    const [isDragging, setIsDragging] = useState(false);
    const [rows, setRows] = useState<ParsedRow[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchPrice, setBatchPrice] = useState<number>(0);
    const [isSanitizing, setIsSanitizing] = useState(false);

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

        const appendedRows = [...rows, ...initialRows];
        setRows(appendedRows);
        await processRowsInBatches(initialRows, appendedRows);
    };

    const processRowsInBatches = async (itemsToProcess: ParsedRow[], currentTotalRows: ParsedRow[]) => {
        const CHUNK_SIZE = 5;
        let newRows = [...currentTotalRows];

        for (let i = 0; i < itemsToProcess.length; i += CHUNK_SIZE) {
            const chunk = itemsToProcess.slice(i, i + CHUNK_SIZE);

            await Promise.all(chunk.map(async (row) => {
                const rowIndex = newRows.findIndex(r => r.id === row.id);
                try {
                    const query = `${row.originalArtist} ${row.originalTitle}`.trim();
                    const response = await discogsService.searchReleases(query, 1, undefined, "release", "vinyl");
                    const results = response.results;

                    newRows[rowIndex].page = 1;
                    newRows[rowIndex].hasMore = response.pagination?.pages > 1;

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
            setProgress(Math.round(((i + chunk.length) / itemsToProcess.length) * 100));
            if (i + CHUNK_SIZE < itemsToProcess.length) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }

        setIsProcessing(false);
    };

    const handleLoadMoreVersions = async (rowId: string) => {
        const rowIndex = rows.findIndex(r => r.id === rowId);
        if (rowIndex === -1) return;
        const row = rows[rowIndex];

        try {
            const query = `${row.originalArtist} ${row.originalTitle}`.trim();
            const nextPage = (row.page || 1) + 1;
            const response = await discogsService.searchReleases(query, nextPage, undefined, "release", "vinyl");

            const newRows = [...rows];
            newRows[rowIndex].results = [...newRows[rowIndex].results, ...response.results];
            newRows[rowIndex].page = nextPage;
            newRows[rowIndex].hasMore = response.pagination?.pages > nextPage;
            setRows(newRows);
        } catch (error) {
            console.error("Error loading more versions", error);
        }
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

    const parseDiscogsTitle = (rawTitle: string) => {
        let clean = rawTitle.replace(/^unknown artist\s*[-—–]\s*/i, '').trim();
        let artist = "Desconocido";
        let title = clean;

        if (clean.includes(' - ')) {
            const parts = clean.split(' - ');
            artist = parts[0].trim();
            title = parts.slice(1).join(' - ').trim();
        } else if (clean.includes(' — ')) {
            const parts = clean.split(' — ');
            artist = parts[0].trim();
            title = parts.slice(1).join(' — ').trim();
        }

        return { artist, title };
    };

    const handleSanitizeDatabase = async () => {
        if (!window.confirm("¿Seguro que deseas sanitizar los títulos de la base de datos eliminando 'UNKNOWN ARTIST'?")) return;

        setIsSanitizing(true);
        showLoading("Sanitizando base de datos global...");
        try {
            // Se quitó el where("status", "==", "store_offer") para ser más agresivo (TAREA 3)
            const q = query(collection(db, "orders"));
            const snapshot = await getDocs(q);
            let updatedCount = 0;

            for (const document of snapshot.docs) {
                const data = document.data();
                let needsUpdate = false;
                let newTitle = data.title || "";
                const newItems = [...(data.items || [])];
                const newDetails = { ...(data.details || {}) };
                const hasIntent = data.intent || data.details?.intent;

                // Check order title
                if (typeof newTitle === 'string' && /unknown artist\s*[-—–]\s*/i.test(newTitle)) {
                    newTitle = newTitle.replace(/^unknown artist\s*[-—–]\s*/i, '').trim();
                    needsUpdate = true;
                }

                // Force Data Integrity (TAREA 3)
                if (!hasIntent) {
                    newDetails.intent = "VENDER";
                    needsUpdate = true;
                }

                // Check items array
                newItems.forEach((item, index) => {
                    if (typeof item.title === 'string' && /unknown artist\s*[-—–]\s*/i.test(item.title)) {
                        newItems[index].title = item.title.replace(/^unknown artist\s*[-—–]\s*/i, '').trim();
                        needsUpdate = true;
                    }
                    if (item.artist?.toLowerCase() === 'unknown artist') {
                        newItems[index].artist = 'Desconocido';
                        needsUpdate = true;
                    }
                });

                if (needsUpdate) {
                    const updatePayload: any = {
                        title: newTitle,
                        items: newItems,
                    };
                    if (!hasIntent) {
                        updatePayload.details = newDetails;
                        updatePayload.intent = "VENDER";
                    }

                    await updateDoc(doc(db, "orders", document.id), updatePayload);
                    updatedCount++;
                }
            }
            alert(`¡Sanitización completada! Se actualizaron ${updatedCount} órdenes.`);
        } catch (error) {
            console.error("Sanitize error", error);
            alert("Hubo un error al sanitizar la base de datos.");
        } finally {
            setIsSanitizing(false);
            hideLoading();
        }
    };

    const handlePublishStrategy = async (strategy: "INDIVIDUAL" | "BUNDLE") => {
        const batchItems = rows.filter(r => r.inBatch && r.status === "MATCH_FOUND" && r.selectedMatch && !r.published);
        if (batchItems.length === 0) return;

        setShowBatchModal(false);
        showLoading(`Publicando ${batchItems.length} discos...`);
        let newRows = [...rows];
        let publishCount = 0;

        try {
            if (strategy === "INDIVIDUAL") {
                for (const row of batchItems) {
                    const match = row.selectedMatch!;
                    const { artist, title } = parseDiscogsTitle(match.title);

                    const orderData = {
                        title: title,
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
                            title: title,
                            artist: artist,
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
                    newRows[rIndex].inBatch = false;
                    publishCount++;
                }
            } else {
                const finalBatchPrice = batchPrice || batchItems.reduce((acc, curr) => acc + curr.originalPrice, 0);
                const firstMatch = batchItems[0].selectedMatch!;
                const orderData = {
                    title: `Lote de ${batchItems.length} Discos`,
                    cover_image: firstMatch.cover_image,
                    totalPrice: finalBatchPrice,
                    status: "store_offer",
                    is_admin_offer: true,
                    is_batch: true,
                    user_id: "oldiebutgoldie",
                    user_email: "admin@discography.ai",
                    user_name: "Stitch Admin",
                    view_count: 0,
                    currency: "ARS",
                    timestamp: serverTimestamp(),
                    createdAt: serverTimestamp(),
                    items: batchItems.map(row => {
                        const match = row.selectedMatch!;
                        const { artist, title } = parseDiscogsTitle(match.title);
                        return {
                            id: match.id.toString(),
                            title: title,
                            artist: artist,
                            format: match.format?.[0] || "Vinyl",
                            condition: `${row.originalMedia} / ${row.originalCover}`,
                            image: match.cover_image,
                            price: row.originalPrice,
                            timestamp: new Date()
                        };
                    })
                };

                await addDoc(collection(db, "orders"), orderData);
                batchItems.forEach(row => {
                    const rIndex = newRows.findIndex(r => r.id === row.id);
                    newRows[rIndex].published = true;
                    newRows[rIndex].inBatch = false;
                    publishCount++;
                });
            }

            setRows(newRows);
            pushBulkUploadCompleted(publishCount);
            alert(`¡Se publicaron exitosamente al catálogo!`);
        } catch (error) {
            console.error("Publish error", error);
            alert("Hubo un error al publicar algunos discos.");
        } finally {
            hideLoading();
            setBatchPrice(0);
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
                            onClick={() => {
                                const newRows = [...rows];
                                newRows.forEach(r => {
                                    if (r.status === "MATCH_FOUND" && !r.published) {
                                        r.inBatch = true;
                                    }
                                });
                                setRows(newRows);
                            }}
                            className="px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-black uppercase tracking-widest text-xs shadow-xl transition-all flex items-center justify-center gap-2"
                        >
                            <List className="w-4 h-4" /> Encolar Todos al Lote
                        </button>
                    ) : (
                        <button
                            onClick={generateSampleExcel}
                            className="px-6 py-4 rounded-2xl border border-white/10 hover:bg-white/5 text-white font-bold uppercase tracking-widest text-[10px] transition-all flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" /> Plantilla XLSX
                        </button>
                    )}
                    <button
                        onClick={handleSanitizeDatabase}
                        disabled={isSanitizing}
                        className="px-6 py-4 rounded-2xl border border-orange-500/20 text-orange-400 hover:bg-orange-500/10 font-bold uppercase tracking-widest text-[10px] transition-all flex items-center gap-2"
                        title="Eliminar prefijos 'UNKNOWN ARTIST' de las publicaciones"
                    >
                        Sanitizar BD
                    </button>
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
                                        <div className="flex flex-col gap-3 h-full justify-between">
                                            <div className="flex items-center gap-4">
                                                <img src={row.selectedMatch.thumb} alt="Cover" className="w-16 h-16 rounded-xl object-cover shadow-lg" />
                                                <div className="flex-1">
                                                    <p className="text-xs font-bold text-white line-clamp-2">{row.selectedMatch.title}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="px-2 py-0.5 bg-white/10 rounded text-[9px] font-mono text-gray-300">ID: {row.selectedMatch.id}</span>
                                                        {row.selectedMatch.year && <span className="px-2 py-0.5 bg-white/10 rounded text-[9px] font-mono text-gray-300">{row.selectedMatch.year}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const newRows = [...rows];
                                                    newRows[index].inBatch = !newRows[index].inBatch;
                                                    setRows(newRows);
                                                }}
                                                className={`w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${row.inBatch
                                                    ? "bg-primary/20 text-primary border border-primary/30"
                                                    : "bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10"
                                                    }`}
                                            >
                                                {row.inBatch ? "✔ Encolado" : "+ Añadir a Lote"}
                                            </button>
                                        </div>
                                    ) : row.status === 'AMBIGUOUS' ? (
                                        <div className="space-y-3 flex flex-col h-[220px]">
                                            <p className="text-[10px] font-black uppercase text-yellow-500 tracking-widest flex items-center gap-1 shrink-0">
                                                <AlertCircle className="w-3 h-3" /> Selector de Versión
                                            </p>
                                            <div className="space-y-2 overflow-y-auto pr-1 flex-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                                {row.results.map(res => (
                                                    <button
                                                        key={`ambig-${res.id}`}
                                                        onClick={() => {
                                                            const newRows = [...rows];
                                                            newRows[index].selectedMatch = res;
                                                            newRows[index].status = 'MATCH_FOUND';
                                                            setRows(newRows);
                                                        }}
                                                        className="w-full text-left p-2 rounded-xl bg-black/40 backdrop-blur-md hover:bg-white/10 border border-white/5 flex items-center gap-3 transition-colors group/btn"
                                                    >
                                                        <img src={res.thumb} className="w-8 h-8 rounded-lg object-cover" />
                                                        <div className="flex-1 truncate">
                                                            <p className="text-[10px] font-bold text-white truncate group-hover/btn:text-primary transition-colors">{res.title}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                                {row.hasMore && (
                                                    <button
                                                        onClick={() => handleLoadMoreVersions(row.id)}
                                                        className="w-full py-2 text-[10px] font-bold text-yellow-500/70 hover:text-yellow-500 uppercase tracking-widest bg-yellow-500/5 hover:bg-yellow-500/10 rounded-xl transition-colors mt-2 border border-yellow-500/10"
                                                    >
                                                        Cargar más +
                                                    </button>
                                                )}
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

            {/* The Batch Tray */}
            {rows.some(r => r.inBatch) && (
                <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-t border-white/10 p-4 md:p-6 z-50 animate-in slide-in-from-bottom">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30 text-primary">
                                <List className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-white font-black uppercase tracking-tight">The Batch Tray</h4>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{rows.filter(r => r.inBatch).length} Ítems seleccionados</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <button
                                onClick={() => {
                                    const newRows = [...rows];
                                    newRows.forEach(r => r.inBatch = false);
                                    setRows(newRows);
                                }}
                                className="px-4 py-3 rounded-xl border border-white/10 text-white text-xs font-bold uppercase hover:bg-white/5 transition-colors"
                            >
                                Limpiar Lote
                            </button>
                            <button
                                onClick={() => setShowBatchModal(true)}
                                className="flex-1 md:flex-none px-8 py-3 rounded-xl bg-primary text-black font-black uppercase text-xs tracking-widest hover:brightness-110 hover:scale-[1.02] transition-all shadow-xl shadow-primary/20"
                            >
                                Configurar Salida
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Publish Strategy Modal */}
            {showBatchModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
                    <div className="w-full max-w-lg bg-gray-900 border border-white/10 rounded-3xl p-8 space-y-8 relative shadow-2xl">
                        <button onClick={() => setShowBatchModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-white">
                            <span className="text-2xl font-black">&times;</span>
                        </button>

                        <div>
                            <h3 className="text-2xl font-black text-white uppercase flex items-center gap-3 tracking-tight">
                                Estrategia de Salida
                            </h3>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-2">{rows.filter(r => r.inBatch).length} discos en el lote</p>
                        </div>

                        <div className="space-y-4">
                            <button
                                onClick={() => handlePublishStrategy("INDIVIDUAL")}
                                className="w-full text-left p-6 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all group"
                            >
                                <h4 className="flex items-center gap-2 text-white font-black uppercase tracking-tight group-hover:text-primary transition-colors">
                                    Modo Individual
                                </h4>
                                <p className="text-xs text-gray-500 font-bold mt-2">Crear una orden de venta independiente para cada disco seleccionado en la base de datos.</p>
                            </button>

                            <div className="w-full text-left p-6 rounded-2xl border border-primary/30 bg-primary/5 transition-all space-y-4">
                                <div>
                                    <h4 className="text-primary font-black uppercase tracking-tight">Modo Lote Especial</h4>
                                    <p className="text-xs text-primary/70 font-bold mt-1 max-w-[90%]">Generar una única orden agrupando todos los discos. ¡Ideal para lotes DJ!</p>
                                </div>
                                <div className="space-y-2 pt-2 border-t border-primary/20">
                                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Ajuste de Precio Total</label>
                                    <div className="flex items-center gap-2 bg-black/50 border border-white/10 rounded-xl px-4 py-2 focus-within:border-primary transition-colors">
                                        <span className="text-white font-mono">$</span>
                                        <input
                                            type="number"
                                            value={batchPrice || rows.filter(r => r.inBatch).reduce((acc, curr) => acc + curr.originalPrice, 0)}
                                            onChange={(e) => setBatchPrice(parseFloat(e.target.value))}
                                            className="flex-1 bg-transparent text-white font-mono outline-none w-full"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={() => handlePublishStrategy("BUNDLE")}
                                    className="w-full mt-4 py-4 rounded-xl bg-primary text-black font-black uppercase text-xs tracking-widest transition-all hover:bg-white shadow-xl shadow-primary/20"
                                >
                                    Publicar Lote ({rows.filter(r => r.inBatch).length})
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
