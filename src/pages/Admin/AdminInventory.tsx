import { useState, useEffect, useMemo } from "react";
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
    Search as SearchIcon
} from "lucide-react";
import { inventoryService } from "@/services/inventoryService";
import { discogsService } from "@/lib/discogs";
import type { InventoryItem } from "@/types/inventory";
import { useLoading } from "@/context/LoadingContext";
import { LazyImage } from "@/components/ui/LazyImage";

export default function AdminInventory() {
    const { showLoading, hideLoading } = useLoading();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editData, setEditData] = useState<{ price?: number, stock?: number, condition?: string }>({});
    const [filter, setFilter] = useState<"all" | "low_stock" | "sold_out">("all");
    const [auditStats, setAuditStats] = useState<any>(null);

    // Ingestion Modal State
    const [showIngestionModal, setShowIngestionModal] = useState(false);
    const [ingestionMode, setIngestionMode] = useState<"discogs" | "manual">("discogs");
    const [discogsId, setDiscogsId] = useState("");
    const [manualData, setManualData] = useState({
        title: "",
        artist: "",
        price: 0,
        stock: 1,
        condition: "M/NM",
        format: "Vinyl"
    });

    useEffect(() => {
        fetchInventory();
    }, []);

    const fetchInventory = async () => {
        setLoading(true);
        showLoading("Sincronizando Inventario Soberano...");
        try {
            const [fetchedItems, stats] = await Promise.all([
                inventoryService.getItems(),
                inventoryService.auditInventory()
            ]);
            setItems(fetchedItems);
            setAuditStats(stats);
        } catch (error) {
            console.error("Error fetching inventory:", error);
        } finally {
            setLoading(false);
            hideLoading();
        }
    };

    const handleEdit = (item: InventoryItem) => {
        setEditingId(item.id);
        setEditData({
            price: item.logistics.price,
            stock: item.logistics.stock,
            condition: item.logistics.condition
        });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditData({});
    };

    const handleSave = async (id: string) => {
        showLoading("Actualizando logística...");
        try {
            await inventoryService.patchLogistics(id, editData);
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
        showLoading("Importando desde Discogs al Búnker...");
        try {
            const release = await discogsService.getReleaseDetails(discogsId);
            await inventoryService.importFromDiscogs(release, {
                price: manualData.price || 0,
                stock: manualData.stock || 1,
                condition: manualData.condition,
                status: "active"
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
        showLoading("Creando registro manual...");
        try {
            const newItem: Omit<InventoryItem, 'id'> = {
                metadata: {
                    title: manualData.title,
                    artist: manualData.artist,
                    year: new Date().getFullYear(),
                    country: "Unknown",
                    genres: [],
                    styles: [],
                    format_description: manualData.format
                },
                media: {
                    thumbnail: "",
                    full_res_image_url: ""
                },
                reference: {
                    originalDiscogsId: 0,
                    originalDiscogsUrl: ""
                },
                logistics: {
                    price: manualData.price,
                    stock: manualData.stock,
                    condition: manualData.condition,
                    status: "active"
                }
            };
            await inventoryService.createItem(newItem);
            setShowIngestionModal(false);
            setManualData({ title: "", artist: "", price: 0, stock: 1, condition: "M/NM", format: "Vinyl" });
            fetchInventory();
        } catch (error) {
            console.error("Error creating manual item:", error);
            alert("Error al crear el registro.");
        } finally {
            hideLoading();
        }
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
        { label: "Total Items", value: items.length, icon: Package, color: "text-blue-400", bg: "bg-blue-400/10" },
        { label: "Valor Total", value: auditStats ? `$${auditStats.totalValue.toLocaleString()}` : "$0", icon: DollarSign, color: "text-green-400", bg: "bg-green-400/10" },
        { label: "Stock Bajo", value: auditStats?.lowStock.length || 0, icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-400/10" },
        { label: "Agotados", value: auditStats?.soldOut.length || 0, icon: Archive, color: "text-red-400", bg: "bg-red-400/10" },
    ];

    return (
        <div className="space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-4">
                        <h2 className="text-4xl md:text-6xl font-display font-black text-white uppercase tracking-tighter">Inventario Pro</h2>
                        <button
                            onClick={() => setShowIngestionModal(true)}
                            className="p-3 bg-primary text-black rounded-2xl hover:bg-white transition-all shadow-xl shadow-primary/20 group translate-y-1"
                        >
                            <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform" />
                        </button>
                    </div>
                    <p className="text-gray-500 font-medium text-lg">Gestión avanzada de la base de datos soberana.</p>
                </div>
                <div className="flex bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex-1 max-w-md">
                    <Search className="h-4 w-4 text-gray-500 mt-1" />
                    <input
                        type="text"
                        placeholder="Buscar por Título, Artista o ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-transparent border-none outline-none text-sm text-white px-3 w-full"
                    />
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
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-500">Item</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-500">Logística</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-500">Estado</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredItems.map(item => (
                                <tr key={item.id} className="group hover:bg-white/[0.02] transition-colors">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0">
                                                <LazyImage
                                                    src={item.media.full_res_image_url || item.media.thumbnail}
                                                    alt={item.metadata.title}
                                                    className="w-full h-full object-cover"
                                                />
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
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <div className="text-sm font-black text-white">
                                                    ${item.logistics.price.toLocaleString()}
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-bold">
                                                    STOCK: {item.logistics.stock}
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
                                            <button
                                                onClick={() => handleEdit(item)}
                                                className="p-3 bg-white/5 text-gray-400 rounded-2xl hover:text-primary hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
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
                            <div className="flex items-center justify-between">
                                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Nueva Ingesta</h3>
                                <div className="flex bg-white/5 p-1 rounded-xl">
                                    <button
                                        onClick={() => setIngestionMode("discogs")}
                                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${ingestionMode === "discogs" ? "bg-primary text-black" : "text-gray-500 hover:text-white"}`}
                                    >
                                        Discogs
                                    </button>
                                    <button
                                        onClick={() => setIngestionMode("manual")}
                                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${ingestionMode === "manual" ? "bg-primary text-black" : "text-gray-500 hover:text-white"}`}
                                    >
                                        Manual
                                    </button>
                                </div>
                            </div>

                            {ingestionMode === "discogs" ? (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Release ID (Discogs)</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: 2453678"
                                            value={discogsId}
                                            onChange={e => setDiscogsId(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary/40 focus:outline-none transition-all"
                                        />
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
                                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Stock Inicial</label>
                                            <input
                                                type="number"
                                                value={manualData.stock}
                                                onChange={e => setManualData({ ...manualData, stock: parseInt(e.target.value) })}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary/40 focus:outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleIngestDiscogs}
                                        className="w-full py-6 bg-primary text-black rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:brightness-110 transition-all"
                                    >
                                        Importar al Búnker
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Título del Disco</label>
                                            <input
                                                type="text"
                                                value={manualData.title}
                                                onChange={e => setManualData({ ...manualData, title: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary/40 focus:outline-none transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Artista / Banda</label>
                                            <input
                                                type="text"
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
        </div>
    );
}
