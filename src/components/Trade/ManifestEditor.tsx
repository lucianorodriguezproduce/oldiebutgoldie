import { useState, useEffect } from "react";
import {
    Plus,
    Minus,
    DollarSign,
    Disc,
    ShoppingBag,
    ArrowRightLeft,
    Trash2,
    Search
} from "lucide-react";
import type { TradeManifest, InventoryItem } from "@/types/inventory";
import { inventoryService } from "@/services/inventoryService";
import { LazyImage } from "@/components/ui/LazyImage";

interface ManifestEditorProps {
    manifest: TradeManifest;
    onChange: (newManifest: TradeManifest) => void;
    isLocked: boolean;
    myItems: string[]; // IDs of items owned by this participant (offered)
    theirItems: string[]; // IDs of items owned by the other participant (requested)
}

export default function ManifestEditor({
    manifest,
    onChange,
    isLocked,
    myItems,
    theirItems
}: ManifestEditorProps) {
    const [itemDetails, setItemDetails] = useState<Record<string, InventoryItem>>({});
    const [isSearching, setIsSearching] = useState<"offered" | "requested" | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<InventoryItem[]>([]);

    useEffect(() => {
        resolveItems();
    }, [manifest]);

    const resolveItems = async () => {
        const allIds = [...manifest.offeredItems, ...manifest.requestedItems];
        const details: Record<string, InventoryItem> = { ...itemDetails };

        await Promise.all(allIds.map(async id => {
            if (!details[id]) {
                const item = await inventoryService.getItemById(id);
                if (item) details[id] = item;
            }
        }));
        setItemDetails(details);
    };

    const handleUpdateCash = (val: number) => {
        if (isLocked) return;
        onChange({ ...manifest, cashAdjustment: val });
    };

    const removeItem = (id: string, type: "offered" | "requested") => {
        if (isLocked) return;
        const key = type === "offered" ? "offeredItems" : "requestedItems";
        onChange({
            ...manifest,
            [key]: manifest[key].filter(itemId => itemId !== id)
        });
    };

    const addItem = (item: InventoryItem, type: "offered" | "requested") => {
        if (isLocked) return;
        const key = type === "offered" ? "offeredItems" : "requestedItems";
        if (manifest[key].includes(item.id)) return;

        onChange({
            ...manifest,
            [key]: [...manifest[key], item.id]
        });
        setIsSearching(null);
        setSearchQuery("");
    };

    useEffect(() => {
        if (searchQuery.length > 2) {
            searchInventory();
        } else {
            setSearchResults([]);
        }
    }, [searchQuery]);

    const searchInventory = async () => {
        // Simple local search for now, could be enhanced
        const all = await inventoryService.getItems();
        const results = all.filter(it =>
            it.metadata.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            it.metadata.artist.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setSearchResults(results.slice(0, 5));
    };

    const renderItemList = (ids: string[], type: "offered" | "requested", title: string, color: string) => (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className={`text-[10px] font-black uppercase tracking-widest ${color}`}>{title}</h4>
                {!isLocked && (
                    <button
                        onClick={() => setIsSearching(type)}
                        className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                    >
                        <Plus className="h-3 w-3 text-gray-400" />
                    </button>
                )}
            </div>

            <div className="space-y-2">
                {ids.map(id => {
                    const item = itemDetails[id];
                    return (
                        <div key={id} className="bg-white/5 border border-white/5 rounded-2xl p-3 flex items-center gap-3 group">
                            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-white/10">
                                {item?.media.thumbnail && <img src={item.media.thumbnail} alt="" className="w-full h-full object-cover" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-white truncate">{item?.metadata.title || "Cargando..."}</p>
                                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter truncate">{item?.metadata.artist}</p>
                            </div>
                            {!isLocked && (
                                <button
                                    onClick={() => removeItem(id, type)}
                                    className="p-2 text-gray-600 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    );
                })}
                {ids.length === 0 && <p className="text-[10px] text-gray-600 italic py-2">Sin discos seleccionados</p>}
            </div>
        </div>
    );

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {renderItemList(manifest.offeredItems, "offered", "Ítems Ofrecidos", "text-blue-400")}
                {renderItemList(manifest.requestedItems, "requested", "Ítems Solicitados", "text-orange-400")}
            </div>


            {/* Cash Adjustment */}
            <div className="bg-white/5 border border-white/5 p-6 rounded-[2rem] space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-green-500/10 rounded-2xl">
                            <DollarSign className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Ajuste Económico</p>
                            <p className="text-xs text-gray-400">Positivo = Recibes dinero | Negativo = Pagas dinero</p>
                        </div>
                    </div>
                </div>

                {isLocked ? (
                    <div className="text-2xl font-black text-white">
                        {manifest.cashAdjustment > 0 ? "+" : ""} ${manifest.cashAdjustment.toLocaleString()}
                    </div>
                ) : (
                    <div className="flex items-center gap-4">
                        <input
                            type="number"
                            value={manifest.cashAdjustment}
                            onChange={(e) => handleUpdateCash(parseFloat(e.target.value) || 0)}
                            className="bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-xl font-black text-white w-full focus:border-primary/40 focus:outline-none transition-all"
                            placeholder="Monto de ajuste..."
                        />
                    </div>
                )}
            </div>

            {/* Search Overlay */}
            {isSearching && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSearching(null)} />
                    <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
                                <Search className="h-5 w-5 text-primary" /> Buscar Disco
                            </h3>
                            <button onClick={() => setIsSearching(null)} className="p-2 hover:bg-white/5 rounded-xl transition-all">
                                <Minus className="h-5 w-5 text-gray-500" />
                            </button>
                        </div>

                        <input
                            autoFocus
                            type="text"
                            placeholder="Cualquier título o artista..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:border-primary/40 focus:outline-none"
                        />

                        <div className="mt-6 space-y-2">
                            {searchResults.map(it => (
                                <button
                                    key={it.id}
                                    onClick={() => addItem(it, isSearching)}
                                    className="w-full p-4 flex items-center gap-4 hover:bg-white/5 rounded-[1.5rem] transition-all text-left group border border-transparent hover:border-white/10"
                                >
                                    <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 shrink-0">
                                        <img src={it.media.thumbnail} alt="" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white truncate">{it.metadata.title}</p>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{it.metadata.artist}</p>
                                    </div>
                                    <Plus className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-all" />
                                </button>
                            ))}
                            {searchQuery.length > 2 && searchResults.length === 0 && (
                                <p className="text-center py-8 text-gray-600 font-bold uppercase text-[10px] tracking-[0.2em]">No se encontraron resultados</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
