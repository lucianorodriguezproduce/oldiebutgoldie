import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CopyPlus, Clock, Disc, Music } from "lucide-react";
import { userAssetService } from "@/services/userAssetService";
import { ADMIN_UID } from "@/constants/admin";
import type { UserAsset } from "@/types/inventory";

export default function AdminCollection() {
    const [assets, setAssets] = useState<UserAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [promotingId, setPromotingId] = useState<string | null>(null);

    // Promote modal state
    const [showModal, setShowModal] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<UserAsset | null>(null);
    const [promoteForm, setPromoteForm] = useState({
        price: "",
        condition: "NM/NM",
        format: "Vinilo"
    });

    useEffect(() => {
        const q = query(
            collection(db, "user_assets"),
            where("ownerId", "==", ADMIN_UID),
            where("status", "==", "active"),
            orderBy("acquiredAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as UserAsset[];
            setAssets(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handlePromote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAsset) return;

        setPromotingId(selectedAsset.id);
        try {
            await userAssetService.promoteToInventory(selectedAsset.id, {
                price: Number(promoteForm.price) || 0,
                condition: promoteForm.condition,
                format: promoteForm.format
            });
            setShowModal(false);
            setPromoteForm({ price: "", condition: "NM/NM", format: "Vinilo" });
        } catch (error) {
            console.error("Error promoting asset:", error);
            alert("Hubo un error al promover el ítem.");
        } finally {
            setPromotingId(null);
            setSelectedAsset(null);
        }
    };

    const openPromoteModal = (asset: UserAsset) => {
        setSelectedAsset(asset);
        setShowModal(true);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <p className="text-primary font-black uppercase tracking-widest animate-pulse">Cargando Colección...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-2">
                <h1 className="text-4xl font-display font-black tracking-tighter uppercase">Colección Adquirida</h1>
                <p className="text-gray-400 font-bold tracking-widest uppercase text-[10px]">
                    Ítems recibidos por el Búnker a través de intercambios. Promovelos al inventario público cuando estén listos.
                </p>
            </header>

            {assets.length === 0 ? (
                <div className="bg-[#111] border border-white/5 rounded-2xl p-16 text-center space-y-4">
                    <Disc className="h-12 w-12 text-white/10 mx-auto" />
                    <h3 className="text-white font-display font-black text-2xl uppercase">Colección Vacía</h3>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">No hay ítems adquiridos por intercambios actualmente.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {assets.map((asset) => (
                        <div key={asset.id} className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden hover:border-white/20 transition-all group flex flex-col">
                            {/* Card Image */}
                            <div className="aspect-square relative bg-black flex items-center justify-center p-4">
                                {asset.media?.full_res_image_url || asset.media?.thumbnail ? (
                                    <img
                                        src={asset.media.full_res_image_url || asset.media.thumbnail}
                                        alt={asset.metadata?.title}
                                        className="w-full h-full object-cover rounded-xl shadow-2xl"
                                    />
                                ) : (
                                    <Music className="w-12 h-12 text-white/10" />
                                )}
                                <div className="absolute top-4 right-4 bg-primary text-black text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-lg">
                                    Adquirido
                                </div>
                            </div>

                            {/* Card Content */}
                            <div className="p-4 flex-1 flex flex-col">
                                <h3 className="text-white font-bold uppercase truncate">{asset.metadata?.title || 'Sin Título'}</h3>
                                <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider truncate mb-4">{asset.metadata?.artist || 'Varios Artistas'}</p>

                                <div className="mt-auto space-y-3">
                                    <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                        <Clock className="w-3 h-3" />
                                        {asset.acquiredAt?.seconds ? new Date(asset.acquiredAt.seconds * 1000).toLocaleDateString('es-AR') : 'Reciente'}
                                    </div>
                                    <button
                                        onClick={() => openPromoteModal(asset)}
                                        className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <CopyPlus className="w-4 h-4" />
                                        Promover a Inventario
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Promote Modal */}
            {showModal && selectedAsset && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#111] border border-white/10 rounded-3xl p-8 max-w-md w-full relative">
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
                        >
                            ✕
                        </button>

                        <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight mb-2">Promover a Inventario</h2>
                        <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-6">
                            Estás por mover <span className="text-white">{selectedAsset.metadata?.title}</span> al catálogo público.
                        </p>

                        <form onSubmit={handlePromote} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Precio (ARS)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-black">$</span>
                                    <input
                                        type="number"
                                        required
                                        value={promoteForm.price}
                                        onChange={e => setPromoteForm(prev => ({ ...prev, price: e.target.value }))}
                                        className="w-full bg-black border border-white/10 rounded-xl py-4 pl-8 pr-4 text-white font-bold uppercase focus:border-primary/50 outline-none"
                                        placeholder="Ej: 45000"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Condición</label>
                                    <input
                                        type="text"
                                        required
                                        value={promoteForm.condition}
                                        onChange={e => setPromoteForm(prev => ({ ...prev, condition: e.target.value }))}
                                        className="w-full bg-black border border-white/10 rounded-xl py-4 px-4 text-white font-bold uppercase focus:border-primary/50 outline-none"
                                        placeholder="Ej: VG+/NM"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Formato</label>
                                    <input
                                        type="text"
                                        required
                                        value={promoteForm.format}
                                        onChange={e => setPromoteForm(prev => ({ ...prev, format: e.target.value }))}
                                        className="w-full bg-black border border-white/10 rounded-xl py-4 px-4 text-white font-bold uppercase focus:border-primary/50 outline-none"
                                        placeholder="Ej: Vinilo"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="submit"
                                    disabled={promotingId === selectedAsset.id}
                                    className="flex-1 py-4 bg-gradient-to-r from-primary to-secondary text-black font-black uppercase tracking-widest text-[10px] rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                    {promotingId === selectedAsset.id ? 'Promoviendo...' : 'Confirmar & Publicar'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-6 py-4 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white font-black uppercase tracking-widest text-[10px] transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
