import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    Filter,
    Edit2,
    Save,
    X,
    AlertTriangle,
    Package,
    DollarSign,
    CheckCircle2,
    Archive,
    Disc,
    Plus,
    PlusCircle,
    LayoutGrid,
    Search as SearchIcon,
    Trash2,
    Sparkles,
    Copy,
    Share2,
    Megaphone,
    Settings,
    ChevronDown,
    ChevronRight,
    Loader2,
    BookOpen
} from "lucide-react";
import { SocialCardGenerator } from "@/components/Social/SocialCardGenerator";
import { gearService, getGearPaged } from "@/services/gearService";
import { categoryService, type InternalCategory } from "@/services/categoryService";
import { discogsService } from "@/lib/discogs";
import type { InventoryItem } from "@/types/inventory";
import { useLoading } from "@/context/LoadingContext";
import { LazyImage } from "@/components/ui/LazyImage";
import { useDebounce } from "@/hooks/useDebounce";
import type { DiscogsSearchResult } from "@/lib/discogs";
import { CompactSearchCard } from "@/components/ui/CompactSearchCard";
import ItemConfigModal from "@/components/discogs/ItemConfigModal";
import { BlockEditor } from "@/components/Admin/Editorial/BlockEditor";

const PAGE_SIZE = 25;

export default function AdminGear() {
    const { showLoading, hideLoading } = useLoading();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editData, setEditData] = useState<{ price?: number, stock?: number, condition?: string, internal_category?: string }>({});
    const [filter, setFilter] = useState<"all" | "low_stock" | "sold_out">("all");
    const [auditStats, setAuditStats] = useState<any>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [marketingItem, setMarketingItem] = useState<InventoryItem | null>(null);

    // Ingestion Modal State
    const [showIngestionModal, setShowIngestionModal] = useState(false);
    const [ingestionMode, setIngestionMode] = useState<"discogs" | "manual">("discogs");
    const [discogsId, setDiscogsId] = useState("");
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkData, setBulkData] = useState({ category: "", mode: "percentage" as "fixed" | "percentage", value: 0 });
    const [showConfigModal, setShowConfigModal] = useState(false);

    // Protocol V101.0: Storytelling Modal State
    const [showStorytellingModal, setShowStorytellingModal] = useState(false);
    const [storytellingItem, setStorytellingItem] = useState<InventoryItem | null>(null);

    // Protocol V79.0: Integrated Search States
    const [ingestionQuery, setIngestionQuery] = useState("");
    const [ingestionResults, setIngestionResults] = useState<DiscogsSearchResult[]>([]);
    const [isSearchingIngestion, setIsSearchingIngestion] = useState(false);
    const [selectedSearchItem, setSelectedSearchItem] = useState<DiscogsSearchResult | null>(null);
    const debouncedIngestionQuery = useDebounce(ingestionQuery, 500);

    // Category Management State
    const [categories, setCategories] = useState<InternalCategory[]>([]);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");

    const [manualData, setManualData] = useState({
        title: "",
        artist: "",
        price: 0,
        stock: 1,
        condition: "M/NM",
        format: "Vinyl",
        internal_category: ""
    });
    const [manualFile, setManualFile] = useState<File | null>(null);


    // Protocol V79.0: Ingestion Search Effect
    useEffect(() => {
        const performSearch = async () => {
            if (debouncedIngestionQuery.trim().length < 3) {
                setIngestionResults([]);
                return;
            }

            setIsSearchingIngestion(true);
            try {
                const response = await discogsService.searchReleases(debouncedIngestionQuery, 1, undefined, "release,master");
                setIngestionResults(response.results);
            } catch (error) {
                console.error("Ingestion search error:", error);
            } finally {
                setIsSearchingIngestion(false);
            }
        };

        if (showIngestionModal && ingestionMode === "discogs" && !selectedSearchItem) {
            performSearch();
        }
    }, [debouncedIngestionQuery, showIngestionModal, ingestionMode, selectedSearchItem]);

    // Protocol V79.0: Reset search state when modal is toggled or mode changes
    useEffect(() => {
        if (!showIngestionModal) {
            setIngestionQuery("");
            setIngestionResults([]);
            setSelectedSearchItem(null);
            setDiscogsId("");
        }
    }, [showIngestionModal, ingestionMode]);

    useEffect(() => {
        initialLoad();
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const fetched = await categoryService.getCategories();
            setCategories(fetched);
        } catch (error) {
            console.error("Error fetching categories:", error);
        }
    };

    const initialLoad = async () => {
        setLoading(true);
        showLoading("Sincronizando Hardware......");
        try {
            const [pagedRes, stats] = await Promise.all([
                getGearPaged(PAGE_SIZE),
                gearService.auditInventory()
            ]);
            setItems(pagedRes.items);
            setLastDoc(pagedRes.lastDoc);
            setHasMore(pagedRes.items.length === PAGE_SIZE);
            setAuditStats(stats);
        } catch (error) {
            console.error("Error in initial load:", error);
            alert("Error al sincronizar el inventario.");
        } finally {
            setLoading(false);
            hideLoading();
        }
    };

    const fetchNextPage = async () => {
        if (!hasMore || loadingMore) return;
        setLoadingMore(true);
        try {
            const pagedRes = await getGearPaged(PAGE_SIZE, lastDoc);
            setItems(prev => [...prev, ...pagedRes.items]);
            setLastDoc(pagedRes.lastDoc);
            setHasMore(pagedRes.items.length === PAGE_SIZE);
        } catch (error) {
            console.error("Error fetching next page:", error);
        } finally {
            setLoadingMore(false);
        }
    };

    const fetchInventory = initialLoad; // Legacy alias used in some handlers

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        try {
            await categoryService.addCategory(newCategoryName);
            setNewCategoryName("");
            fetchCategories();
        } catch (error) {
            console.error("Error adding category:", error);
            alert("Error al añadir categoría.");
        }
    };

    const handleDeleteCategory = async (id: string, name: string) => {
        if (!window.confirm(`¿Eliminar la categoría "${name}"? Los items existentes mantendrán el texto pero ya no aparecerá en el menú.`)) return;
        try {
            await categoryService.deleteCategory(id);
            fetchCategories();
        } catch (error) {
            console.error("Error deleting category:", error);
            alert("Error al eliminar categoría.");
        }
    };

    const handleEdit = (item: InventoryItem) => {
        setEditingId(item.id);
        setEditData({
            price: item.logistics.price,
            stock: item.logistics.stock,
            condition: item.logistics.condition,
            internal_category: item.logistics.internal_category || ""
        });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditData({});
    };

    const handleSave = async (id: string) => {
        showLoading("Actualizando logística...");
        try {
            await gearService.patchLogistics(id, editData);
            setEditingId(null);
            fetchInventory();
        } catch (error) {
            console.error("Error saving item:", error);
            alert("Error al actualizar el ítem.");
        } finally {
            hideLoading();
        }
    };

    const handleIngestDiscogs = async () => {
        if (!discogsId) return;
        showLoading("Importando desde Discogs al La Batea...");
        try {
            // Protocol V93.0: Pipeline Universal
            // El Ingestor se encarga de la hidratación profunda (Master -> Release) y enriquecimiento
            const source = selectedSearchItem || { id: discogsId, type: 'release' };
            
            await gearService.universalIngest(source, 'admin', {
                price: manualData.price || 0,
                stock: manualData.stock || 1,
                condition: manualData.condition,
                internal_category: manualData.internal_category
            });
            setShowIngestionModal(false);
            setDiscogsId("");
            fetchInventory();
        } catch (error) {
            console.error("Error importing from Discogs:", error);
            alert("No se pudo importar. Verifica el ID.");
        } finally {
            hideLoading();
        }
    };
    const handleIngestManual = async () => {
        showLoading("Generando Identidad y Cargando Activos...");
        try {
            // Protocol V106: Asset Optimization Pipeline Integration
            const internalId = await gearService.createItem({ // We use createItem to get ID or just idService
                metadata: { title: manualData.title, artist: manualData.artist, year: 0, country: "", genres: [], styles: [], format_description: manualData.format },
                media: { thumbnail: "", full_res_image_url: "" },
                reference: { originalDiscogsId: 0, originalDiscogsUrl: "" },
                logistics: { price: manualData.price, stock: manualData.stock, condition: manualData.condition, status: "active", internal_category: manualData.internal_category }
            });

            if (manualFile) {
                showLoading("Subiendo imagen original al Búnker...");
                await gearService.uploadImage(manualFile, internalId);
            }

            setShowIngestionModal(false);
            setManualData({ title: "", artist: "", price: 0, stock: 1, condition: "M/NM", format: "Vinyl", internal_category: "" });
            setManualFile(null);
            fetchInventory();
        } catch (error) {
            console.error("Error creating manual item:", error);
            alert("Error al crear el registro.");
        } finally {
            hideLoading();
        }
    };

    const handleBulkUpdate = async () => {
        if (!bulkData.category || bulkData.value === 0) {
            alert("Por favor completa la categoría y el valor del ajuste.");
            return;
        }

        showLoading(`Ajustando precios para la categoría ${bulkData.category}...`);
        try {
            await gearService.bulkUpdatePrices(bulkData.category, bulkData.mode, bulkData.value);
            setShowBulkModal(false);
            setBulkData({ category: "", mode: "percentage", value: 0 });
            await fetchInventory();
        } catch (error) {
            console.error("Error in bulk update:", error);
            alert("Hubo un error al procesar el ajuste masivo.");
        } finally {
            hideLoading();
        }
    };

    const handleArchiveIndividual = async (id: string, title: string) => {
        if (!window.confirm(`¿Estás seguro de archivar "${title}"? Se marcará como agotado y desaparecerá del catálogo público.`)) return;

        showLoading("Archivando ítem...");
        try {
            await gearService.patchLogistics(id, { stock: 0, status: "sold_out" });
            fetchInventory();
        } catch (error) {
            console.error("Error archiving item:", error);
            alert("Error al archivar el ítem.");
        } finally {
            hideLoading();
        }
    };

    const handleDeleteIndividual = async (id: string, title: string) => {
        if (!window.confirm(`¿Estás seguro de eliminar "${title}"? Esta acción no se puede deshacer y no dejará rastro.`)) return;

        showLoading("Eliminando registro...");
        try {
            await gearService.deleteItem(id);
            fetchInventory();
        } catch (error) {
            console.error("Error deleting item:", error);
            alert("Error al eliminar el ítem.");
        } finally {
            hideLoading();
        }
    };

    const handleDeleteBulk = async () => {
        const count = selectedIds.size;
        if (!window.confirm(`¿Estás seguro de eliminar ${count} ítems seleccionados? Esta acción es irreversible.`)) return;

        showLoading(`Eliminando ${count} ítems...`);
        try {
            await gearService.deleteItems(Array.from(selectedIds));
            setSelectedIds(new Set());
            fetchInventory();
        } catch (error) {
            console.error("Error deleting items:", error);
            alert("Error al eliminar los ítems.");
        } finally {
            hideLoading();
        }
    };

    const handleHeal = async (item: InventoryItem) => {
        const bpmInput = window.prompt(`Ingresa el BPM para ${item.metadata.title}`, item.metadata.bpm?.toString() || "0");
        if (bpmInput === null) return;

        const keyInput = window.prompt(`Ingresa la Key para ${item.metadata.title}`, item.metadata.key || "");
        if (keyInput === null) return;

        const bpm = parseInt(bpmInput) || 0;
        const key = keyInput.trim();

        showLoading(`Guardando data técnica: ${item.metadata.title}...`);
        try {
            await gearService.updateTechnicalData(item.id, bpm, key);

            // Also run background healing for IDs/Tracklist if needed
            if (!item.metadata.spotify_id || !item.metadata.youtube_id || !item.tracklist?.length) {
                await gearService.healRecord(item);
            }

            alert("Data técnica actualizada.");
            window.location.reload();
        } catch (error) {
            console.error("[UI-Heal] FAILED:", error);
            alert(`Error al guardar: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            hideLoading();
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredItems.map(it => it.id)));
        }
    };

    const toggleSelectItem = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const filteredItems = useMemo(() => {
        let list = items;

        if (filter === "low_stock") {
            list = list.filter(it => it.logistics.stock > 0 && it.logistics.stock <= 2);
        } else if (filter === "sold_out") {
            list = list.filter(it => it.logistics.stock === 0);
        }

        if (searchTerm) {
            const lowSearch = searchTerm.toLowerCase();
            list = list.filter(it =>
                it.metadata.title.toLowerCase().includes(lowSearch) ||
                it.metadata.artist.toLowerCase().includes(lowSearch) ||
                it.reference.originalDiscogsId.toString().includes(lowSearch)
            );
        }

        return list;
    }, [items, filter, searchTerm]);

    const kpiCards = [
        { label: "Total Items", value: auditStats ? auditStats.total : items.length, icon: Package, color: "text-blue-400", bg: "bg-blue-400/10" },
        { label: "Valor Total", value: auditStats ? `$${auditStats.totalValue.toLocaleString()}` : "$0", icon: DollarSign, color: "text-green-400", bg: "bg-green-400/10" },
        { label: "Stock Bajo", value: auditStats?.lowStockCount || 0, icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-400/10" },
        { label: "Agotados", value: auditStats?.soldOutCount || 0, icon: Archive, color: "text-red-400", bg: "bg-red-400/10" },
    ];

    return (
        <div className="space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-4">
                        <h2 className="text-4xl md:text-6xl font-display font-black text-white uppercase tracking-tighter">Búnker de Equipos</h2>
                        <button
                            onClick={() => setShowIngestionModal(true)}
                            className="p-3 bg-primary text-black rounded-2xl hover:bg-white transition-all shadow-xl shadow-primary/20 group translate-y-1"
                        >
                            <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform" />
                        </button>
                    </div>
                    <p className="text-gray-500 font-medium text-lg">Gestión avanzada del hardware y equipos premium.</p>
                </div>
                <div className="flex items-center gap-4 flex-1 max-w-2xl">
                    <button
                        onClick={() => setShowCategoryModal(true)}
                        className="flex items-center gap-2 px-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-white hover:border-white/20 hover:bg-white/10 transition-all shrink-0"
                        title="Gestionar Categorías"
                    >
                        <Settings className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => setShowBulkModal(true)}
                        className="flex items-center gap-2 px-6 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all group shrink-0"
                    >
                        <DollarSign className="h-4 w-4" />
                        Ajuste de Precios
                    </button>
                    <div className="flex bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex-1">
                        <Search className="h-4 w-4 text-gray-500 mt-1" />
                        <input
                            type="text"
                            placeholder="Buscar por Título, Artista o ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm text-white px-3 w-full"
                        />
                    </div>

                    <AnimatePresence>
                        {selectedIds.size > 0 && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 px-6 py-3 rounded-2xl whitespace-nowrap"
                            >
                                <span className="text-xs font-black text-red-500 uppercase tracking-widest">
                                    {selectedIds.size} Seleccionados
                                </span>
                                <button
                                    onClick={handleDeleteBulk}
                                    className="bg-red-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 flex items-center gap-2"
                                >
                                    <Trash2 className="h-3.5 w-3.5" /> Eliminar Todo
                                </button>
                                <button
                                    onClick={() => setSelectedIds(new Set())}
                                    className="text-gray-500 hover:text-white transition-colors p-2"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpiCards.map(stat => (
                    <div key={stat.label} className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 hover:border-white/10 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-2xl ${stat.bg}`}>
                                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                            </div>
                        </div>
                        <div className="text-3xl font-black text-white tracking-tighter">{stat.value}</div>
                        <div className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mt-1">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-gray-600 mr-2">
                    <Filter className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Filtrar:</span>
                </div>
                {[
                    { value: "all", label: "Todos" },
                    { value: "low_stock", label: "Stock Bajo" },
                    { value: "sold_out", label: "Agotados" },
                ].map(f => (
                    <button
                        key={f.value}
                        onClick={() => setFilter(f.value as any)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${filter === f.value
                            ? "bg-primary text-black border-primary"
                            : "bg-white/5 text-gray-500 border-white/5 hover:border-white/10"
                            }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Inventory Table */}
            <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.01]">
                                <th className="px-8 py-6 w-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary focus:ring-primary/40 transition-all cursor-pointer"
                                    />
                                </th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-500">Item</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-500">Logística</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-500">Estado</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredItems.map(item => (
                                <tr key={item.id} className={`group hover:bg-white/[0.02] transition-colors ${selectedIds.has(item.id) ? 'bg-primary/[0.03]' : ''}`}>
                                    <td className="px-8 py-6">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(item.id)}
                                            onChange={() => toggleSelectItem(item.id)}
                                            className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary focus:ring-primary/40 transition-all cursor-pointer"
                                        />
                                    </td>
                                    <td className="px-8 py-6">
                                                                 <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0 relative">
                                                {(item.media?.original_raw_url && !item.media?.detail_url) ? (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-pulse">
                                                        <Loader2 className="h-4 w-4 text-primary animate-spin" />
                                                        <span className="text-[6px] font-black uppercase text-primary mt-1">OPTIMIZANDO</span>
                                                    </div>
                                                ) : (
                                                    <LazyImage
                                                        src={item.media?.detail_url || item.media?.full_res_image_url || item.media?.thumbnail}
                                                        alt={item.metadata.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-white truncate max-w-[200px]">{item.metadata.title}</div>
                                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider truncate">{item.metadata.artist}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        {editingId === item.id ? (
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-gray-600 w-8">Price</span>
                                                    <input
                                                        type="number"
                                                        value={editData.price}
                                                        onChange={e => setEditData({ ...editData, price: parseFloat(e.target.value) })}
                                                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white w-24 focus:border-primary/40 focus:outline-none"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-gray-600 w-8">Stock</span>
                                                    <input
                                                        type="number"
                                                        value={editData.stock}
                                                        onChange={e => setEditData({ ...editData, stock: parseInt(e.target.value) })}
                                                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white w-24 focus:border-primary/40 focus:outline-none"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-gray-600 w-8">Cat.</span>
                                                    <select
                                                        value={editData.internal_category}
                                                        onChange={e => setEditData({ ...editData, internal_category: e.target.value })}
                                                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white w-24 focus:border-primary/40 focus:outline-none appearance-none cursor-pointer"
                                                    >
                                                        <option value="" className="bg-[#0a0a0a]">Ninguna</option>
                                                        {categories.map(cat => (
                                                            <option key={cat.id} value={cat.name} className="bg-[#0a0a0a]">{cat.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <div className="text-sm font-black text-white">
                                                    ${item.logistics.price.toLocaleString()}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="text-[10px] text-gray-500 font-bold">
                                                        STOCK: {item.logistics.stock}
                                                    </div>
                                                    {item.logistics.internal_category && (
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/40">
                                                            [{item.logistics.internal_category}]
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-8 py-6">
                                        {item.logistics.stock === 0 ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest">
                                                <Archive className="h-3 w-3" /> Sold Out
                                            </span>
                                        ) : item.logistics.stock <= 2 ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-widest">
                                                <AlertTriangle className="h-3 w-3" /> Low Stock
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-[10px] font-black uppercase tracking-widest">
                                                <CheckCircle2 className="h-3 w-3" /> In Stock
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        {editingId === item.id ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleSave(item.id)}
                                                    className="p-2 bg-primary text-black rounded-lg hover:bg-white transition-all shadow-lg shadow-primary/20"
                                                >
                                                    <Save className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="p-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 transition-all"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(item)}
                                                    className="p-3 bg-white/5 text-gray-400 rounded-2xl hover:text-primary hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleArchiveIndividual(item.id, item.metadata.title)}
                                                    className="p-3 bg-white/5 text-gray-400 rounded-2xl hover:text-amber-500 hover:bg-amber-500/10 transition-all opacity-0 group-hover:opacity-100"
                                                    title="Archivar (Marcar como agotado)"
                                                >
                                                    <Archive className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteIndividual(item.id, item.metadata.title)}
                                                    className="p-3 bg-white/5 text-gray-400 rounded-2xl hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                                                    title="Eliminar permanentemente"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                                {(!item.metadata.bpm || Number(item.metadata.bpm) === 0 || item.metadata.status_warning) && (
                                                    <button
                                                        onClick={() => handleHeal(item)}
                                                        className="p-3 bg-amber-500/20 text-amber-500 rounded-2xl hover:text-white hover:bg-amber-500 transition-all opacity-0 group-hover:opacity-100 animate-pulse border border-amber-500/50"
                                                        title="Curar Registro (BPM/Key/Tracklist)"
                                                    >
                                                        <Sparkles className="h-4 w-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => { setStorytellingItem(item); setShowStorytellingModal(true); }}
                                                    className={`p-3 rounded-2xl transition-all opacity-0 group-hover:opacity-100 ${item.blocks && item.blocks.length > 0 ? "bg-primary/20 text-primary border border-primary/40 hover:bg-primary/40" : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"}`}
                                                    title="Modo Storytelling (Editorial Ficha)"
                                                >
                                                    <BookOpen className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => setMarketingItem(item)}
                                                    className="p-3 bg-white/5 text-primary rounded-2xl hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100"
                                                    title="Propaganda V6.0"
                                                >
                                                    <Megaphone className="h-4 w-4" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {hasMore && (
                    <div className="p-8 border-t border-white/5 flex justify-center">
                        <button
                            onClick={fetchNextPage}
                            disabled={loadingMore}
                            className="flex items-center gap-2 px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all disabled:opacity-50"
                        >
                            {loadingMore ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                    Cargando...
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="h-4 w-4" />
                                    Cargar más registros
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
            {/* Ingestion Modal */}
            <AnimatePresence>
                {showIngestionModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={() => setShowIngestionModal(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-[3rem] p-8 shadow-2xl space-y-8"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Nuevo Equipo Mapeado</h3>
                            </div>

                            <div className="flex bg-white/5 p-1 rounded-2xl mb-8 border border-white/5">
                                <button
                                    onClick={() => setIngestionMode("discogs")}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${ingestionMode === "discogs" ? "bg-primary text-black" : "text-gray-500 hover:text-gray-300"}`}
                                >
                                    <Disc className="h-3.5 w-3.5" /> Discogs Ingestor
                                </button>
                                <button
                                    onClick={() => setIngestionMode("manual")}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${ingestionMode === "manual" ? "bg-primary text-black" : "text-gray-500 hover:text-gray-300"}`}
                                >
                                    <Edit2 className="h-3.5 w-3.5" /> Carga Manual
                                </button>
                            </div>

                            {ingestionMode === "discogs" ? (
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Buscador Inteligente</label>
                                        <div className="flex bg-white/5 border border-white/10 rounded-2xl px-4 py-4">
                                            <Search className="h-5 w-5 text-gray-500 mt-1" />
                                            <input
                                                type="text"
                                                placeholder="Artista, Álbum, Sello o Cat#"
                                                value={ingestionQuery}
                                                onChange={(e) => setIngestionQuery(e.target.value)}
                                                className="bg-transparent border-none outline-none text-sm text-white px-3 w-full"
                                            />
                                            {isSearchingIngestion && <Loader2 className="h-5 w-5 text-primary animate-spin mt-1" />}
                                        </div>
                                    </div>

                                    {ingestionResults.length > 0 && !selectedSearchItem && (
                                        <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                            {ingestionResults.map((result) => (
                                                <button
                                                    key={`${result.type}-${result.id}`}
                                                    onClick={() => {
                                                        setSelectedSearchItem(result);
                                                        setDiscogsId(result.id.toString());
                                                        setShowConfigModal(true);
                                                    }}
                                                    className="w-full text-left"
                                                >
                                                    <CompactSearchCard result={result} />
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className="pt-4 border-t border-white/5 flex flex-col gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="h-px bg-white/5 flex-1" />
                                            <span className="text-[8px] font-black text-gray-600 uppercase tracking-[0.3em]">O ingreso directo</span>
                                            <div className="h-px bg-white/5 flex-1" />
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Discogs Release ID..."
                                                value={discogsId}
                                                onChange={(e) => setDiscogsId(e.target.value)}
                                                className="flex-1 bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white focus:border-primary/40 focus:outline-none transition-all"
                                            />
                                            <button
                                                onClick={handleIngestDiscogs}
                                                disabled={!discogsId}
                                                className="px-8 bg-primary text-black rounded-2xl font-black uppercase text-[10px] tracking-widest hover:brightness-110 transition-all disabled:opacity-50"
                                            >
                                                Mapear
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Dropzone */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Imagen del Equipo</label>
                                        <div
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                if (e.dataTransfer.files?.[0]) setManualFile(e.dataTransfer.files[0]);
                                            }}
                                            className="w-full h-32 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-primary/40 transition-all cursor-pointer relative overflow-hidden group"
                                            onClick={() => document.getElementById('manual-file-upload')?.click()}
                                        >
                                            <input
                                                id="manual-file-upload"
                                                type="file"
                                                className="hidden"
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) setManualFile(e.target.files[0]);
                                                }}
                                                accept="image/*"
                                            />
                                            {manualFile ? (
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2">
                                                    <CheckCircle2 className="h-5 w-5 text-primary" />
                                                    <span className="text-[10px] font-black text-white uppercase truncate max-w-[150px]">{manualFile.name}</span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setManualFile(null); }}
                                                        className="p-1 bg-red-500 rounded-full"
                                                    >
                                                        <X className="h-3 w-3 text-white" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <PlusCircle className="h-6 w-6 text-gray-500 group-hover:text-primary transition-colors" />
                                                    <span className="text-[10px] font-black text-gray-500 uppercase">Click o Arrastrar Imagen</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Título / Modelo</label>
                                            <input
                                                type="text"
                                                placeholder="E.g. Technics SL-1200"
                                                value={manualData.title}
                                                onChange={e => setManualData({ ...manualData, title: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary/40 focus:outline-none transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Marca / Fabricante</label>
                                            <input
                                                type="text"
                                                placeholder="E.g. Technics"
                                                value={manualData.artist}
                                                onChange={e => setManualData({ ...manualData, artist: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary/40 focus:outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Precio (ARS)</label>
                                            <input
                                                type="number"
                                                value={manualData.price}
                                                onChange={e => setManualData({ ...manualData, price: parseFloat(e.target.value) })}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary/40 focus:outline-none transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Stock</label>
                                            <input
                                                type="number"
                                                value={manualData.stock}
                                                onChange={e => setManualData({ ...manualData, stock: parseInt(e.target.value) })}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary/40 focus:outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Categoría Interna</label>
                                        <select
                                            value={manualData.internal_category}
                                            onChange={e => setManualData({ ...manualData, internal_category: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary/40 focus:outline-none transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="" className="bg-[#0a0a0a]">Ninguna / Sin Categoría</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.name} className="bg-[#0a0a0a]">{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        onClick={handleIngestManual}
                                        className="w-full py-6 bg-primary text-black rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:brightness-110 transition-all"
                                    >
                                        Crear Registro Manual
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Propaganda Modal V6.0 */}
            <AnimatePresence>
                {marketingItem && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/95 backdrop-blur-xl"
                            onClick={() => setMarketingItem(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 30 }}
                            className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[3rem] overflow-hidden"
                        >
                            <div className="p-10 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Sparkles className="w-6 h-6 text-primary" />
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tight">Propaganda: {marketingItem.metadata.title}</h3>
                                </div>
                                <button onClick={() => setMarketingItem(null)} className="text-gray-500 hover:text-white transition-colors">
                                    <X className="w-8 h-8" />
                                </button>
                            </div>

                            <div className="p-10 space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">Generador de Social Card (9:16)</label>
                                        <SocialCardGenerator
                                            item={{
                                                id: marketingItem.id,
                                                title: marketingItem.metadata.title,
                                                artist: marketingItem.metadata.artist,
                                                image: marketingItem.media.full_res_image_url || marketingItem.media.thumbnail,
                                                source: 'inventory',
                                                condition: marketingItem.logistics.condition,
                                                price: marketingItem.logistics.price
                                            }}
                                            type="release"
                                        />
                                        <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest text-center">Optimizado para Instagram Stories y TikTok</p>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">Viral Snippets (Clipboard)</label>
                                        <div className="space-y-3">
                                            {[
                                                { id: 'instagram', label: 'Copy Instagram', icon: '📸' },
                                                { id: 'x', label: 'Copy X / Thread', icon: '🐦' },
                                                { id: 'tiktok', label: 'Copy TikTok Script', icon: '🎵' },
                                                { id: 'external', label: 'Copy Official Data', icon: '💬' }
                                            ].map((plat) => (
                                                <button
                                                    key={plat.id}
                                                    onClick={() => {
                                                        const baseUrl = 'https://www.oldiebutgoldie.com.ar';
                                                        const url = `{baseUrl}/archivo/{marketingItem.id}?ref=social_{plat.id}`;
                                                        let text = "";

                                                        if (plat.id === 'instagram') {
                                                            text = "🔥 DISPONIBLE EN EL BÚNKAR: " + marketingItem.metadata.artist + " - " + marketingItem.metadata.title + "\n\nCondición: " + marketingItem.logistics.condition + "\nPrecio: $" + marketingItem.logistics.price.toLocaleString() + "\n\n🔗 Link en Bio / Stories para comprar\n\n#OldieButGoldie #VinylCollection #Vinilos #bateaOBG";
                                                        } else if (plat.id === 'x') {
                                                            text = "🚨 [INVENTORY ALERT] " + marketingItem.metadata.artist + " - " + marketingItem.metadata.title + "\n\nCondición: " + marketingItem.logistics.condition + "\nStock: " + marketingItem.logistics.stock + "\n\nConseguilo acá antes que vuele 👇\n\n" + url;
                                                        } else if (plat.id === 'tiktok') {
                                                            text = "[Viral Script]\n(Intro) Escuchá el sonido de esta joya: " + marketingItem.metadata.title + ".\n(Body) Tenemos una copia en estado " + marketingItem.logistics.condition + " disponible ahora.\n(CTA) No te duermas. Link en el perfil.";
                                                        } else if (plat.id === 'external') {
                                                            text = "*FICHA TÉCNICA - OLDIE BUT GOLDIE*\n\n💿 *" + marketingItem.metadata.title + "*\n👤 *" + marketingItem.metadata.artist + "*\n✨ Condición: " + marketingItem.logistics.condition + "\n💰 Precio: $" + marketingItem.logistics.price.toLocaleString() + "\n📦 Stock: " + marketingItem.logistics.stock + "\n\n🔗 Ver más:\n" + url;
                                                        }

                                                        navigator.clipboard.writeText(text);
                                                        alert(plat.label + " copiado");
                                                    }}
                                                    className="w-full flex items-center justify-between bg-white/5 border border-white/5 hover:border-primary/40 p-4 rounded-2xl transition-all group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-lg">{plat.icon}</span>
                                                        <span className="text-[10px] font-black text-white uppercase tracking-widest">{plat.label}</span>
                                                    </div>
                                                    <Copy className="w-3 h-3 text-gray-500 group-hover:text-primary transition-colors" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Category Management Modal */}
            <AnimatePresence>
                {showCategoryModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#0a0a0a] border border-white/10 rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl"
                        >
                            <div className="p-10 space-y-8">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h3 className="text-3xl font-black italic text-white uppercase tracking-tighter">Categorías</h3>
                                        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em]">Gestión de Etiquetas Internas</p>
                                    </div>
                                    <button
                                        onClick={() => setShowCategoryModal(false)}
                                        className="p-4 bg-white/5 border border-white/10 rounded-2xl text-gray-500 hover:text-white transition-all"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newCategoryName}
                                            onChange={e => setNewCategoryName(e.target.value)}
                                            onKeyDown={e => e.key === "Enter" && handleAddCategory()}
                                            className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white focus:border-primary/50 transition-all uppercase"
                                            placeholder="NUEVA_CATEGORIA"
                                        />
                                        <button
                                            onClick={handleAddCategory}
                                            className="px-6 bg-primary text-black rounded-2xl font-black uppercase text-[10px]"
                                        >
                                            Añadir
                                        </button>
                                    </div>

                                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                        {categories.length === 0 ? (
                                            <div className="text-center py-8 text-gray-600 font-bold italic text-xs">
                                                No hay categorías definidas.
                                            </div>
                                        ) : (
                                            categories.map(cat => (
                                                <div key={cat.id} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-white/10 transition-all group">
                                                    <span className="text-xs font-black text-gray-300 tracking-widest">{cat.name}</span>
                                                    <button
                                                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                                        className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bulk Adjustment Modal */}
            <AnimatePresence>
                {showBulkModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#0a0a0a] border border-white/10 rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl"
                        >
                            <div className="p-10 space-y-8">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h3 className="text-3xl font-black italic text-white uppercase tracking-tighter">Ajuste Masivo</h3>
                                        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em]">Motor de Precios en Lote</p>
                                    </div>
                                    <button
                                        onClick={() => setShowBulkModal(false)}
                                        className="p-4 bg-white/5 border border-white/10 rounded-2xl text-gray-500 hover:text-white transition-all"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Categoría de Equipo Interna</label>
                                        <select
                                            value={bulkData.category}
                                            onChange={e => setBulkData({ ...bulkData, category: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white focus:border-primary/50 transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="" className="bg-[#0a0a0a]">Seleccionar Categoría...</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.name} className="bg-[#0a0a0a]">{cat.name}</option>
                                            )) || []}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Tipo de Ajuste</label>
                                        <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
                                            <button
                                                onClick={() => setBulkData({ ...bulkData, mode: 'percentage' })}
                                                className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${bulkData.mode === 'percentage' ? "bg-primary text-black" : "text-gray-500"}`}
                                            >
                                                Porcentaje (%)
                                            </button>
                                            <button
                                                onClick={() => setBulkData({ ...bulkData, mode: 'fixed' })}
                                                className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${bulkData.mode === 'fixed' ? "bg-primary text-black" : "text-gray-500"}`}
                                            >
                                                Monto Fijo ($)
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                                            {bulkData.mode === 'percentage' ? 'Porcentaje de Variación' : 'Monto a Sumar/Restar'}
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={bulkData.value}
                                                onChange={e => setBulkData({ ...bulkData, value: parseFloat(e.target.value) })}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xl font-black text-white focus:border-primary/50 transition-all pr-12"
                                                placeholder="0"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">
                                                {bulkData.mode === 'percentage' ? '%' : '$'}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-gray-600 font-bold italic ml-1">
                                            * Los precios se redondearán automáticamente a la centena más cercana.
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleBulkUpdate}
                                        disabled={!bulkData.category || bulkData.value === 0}
                                        className="w-full py-5 bg-primary text-black rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 mt-4"
                                    >
                                        Ejecutar Ajuste Masivo
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Protocol V101.0: Storytelling Modal */}
            <AnimatePresence>
                {showStorytellingModal && storytellingItem && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/90 backdrop-blur-xl"
                            onClick={() => setShowStorytellingModal(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 30 }}
                            className="relative w-full max-w-4xl bg-[#0a0a0a] border border-white/10 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            <div className="p-8 border-b border-white/5 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0">
                                        <LazyImage
                                            src={storytellingItem.media.full_res_image_url || storytellingItem.media.thumbnail}
                                            alt={storytellingItem.metadata.title}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-white uppercase tracking-tighter">Storytelling: {storytellingItem.metadata.title}</h3>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{storytellingItem.metadata.artist}</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowStorytellingModal(false)} className="text-gray-500 hover:text-white transition-colors">
                                    <X className="w-8 h-8" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                <BlockEditor 
                                    blocks={storytellingItem.blocks || []} 
                                    onChange={(blocks) => setStorytellingItem({ ...storytellingItem, blocks })} 
                                />
                            </div>

                            <div className="p-8 border-t border-white/5 bg-white/[0.01] flex justify-end gap-3 shrink-0">
                                <button
                                    onClick={() => setShowStorytellingModal(false)}
                                    className="px-6 py-3 bg-white/5 text-gray-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={async () => {
                                        showLoading("Guardando Storytelling...");
                                        try {
                                            await gearService.patchBlocks(storytellingItem.id, storytellingItem.blocks || []);
                                            setShowStorytellingModal(false);
                                            setItems(prev => prev.map(it => it.id === storytellingItem.id ? storytellingItem : it));
                                        } catch (e) {
                                            console.error("Error saving blocks:", e);
                                            alert("Error al guardar.");
                                        } finally {
                                            hideLoading();
                                        }
                                    }}
                                    className="px-8 py-3 bg-primary text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 shadow-xl shadow-primary/20 transition-all"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Ingestion Config Wizard (V96.0) */}
            {selectedSearchItem && (
                <ItemConfigModal
                    isOpen={showConfigModal}
                    onClose={() => {
                        setShowConfigModal(false);
                        setSelectedSearchItem(null);
                    }}
                    item={selectedSearchItem}
                    showPrice={true}
                    onConfirm={async (config) => {
                        showLoading("Finalizando carga técnica...");
                        try {
                            await gearService.universalIngest(selectedSearchItem, 'admin', {
                                price: config.price || 0,
                                stock: 1,
                                condition: config.condition,
                                format: config.format,
                                internal_category: manualData.internal_category
                            });
                            setShowConfigModal(false);
                            setShowIngestionModal(false);
                            setSelectedSearchItem(null);
                            fetchInventory();
                        } catch (error) {
                            console.error("Config Ingest Error:", error);
                            alert("Error al finalizar la carga.");
                        } finally {
                            hideLoading();
                        }
                    }}
                />
            )}
        </div>
    );
}
