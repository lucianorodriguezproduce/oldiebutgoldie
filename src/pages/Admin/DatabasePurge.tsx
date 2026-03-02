import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, writeBatch, doc, where } from "firebase/firestore";
import { motion } from "framer-motion";
import { Trash2, AlertTriangle, ShieldCheck, Database, RefreshCw } from "lucide-react";
import { useLote } from "@/context/LoteContext";

const TARGET_COLLECTIONS = ["orders", "trades_purgados", "assets_saneados", "stock_recalibrado"];

export default function DatabasePurge() {
    const [isPurging, setIsPurging] = useState(false);
    const [results, setResults] = useState<{ [key: string]: number }>({});
    const [confirmed, setConfirmed] = useState(false);
    const { clearLote } = useLote();

    const handlePurge = async () => {
        if (!confirmed) return;
        setIsPurging(true);
        const newResults: { [key: string]: number } = {};

        try {
            // 1. ELIMINACIÓN TOTAL DE 'ORDERS'
            const ordersSnap = await getDocs(collection(db, "orders"));
            const ordersBatch = writeBatch(db);
            ordersSnap.docs.forEach(d => ordersBatch.delete(d.ref));
            await ordersBatch.commit();
            newResults["orders"] = ordersSnap.size;

            // 2. PURGA DE TRADES INCONSISTENTES (Pre-V1.5)
            // Borramos trades sin timestamp o de fechas anteriores al debug de hoy
            const tradesSnap = await getDocs(collection(db, "trades"));
            const tradesBatch = writeBatch(db);
            let tradesCount = 0;
            const today = new Date("2026-03-02").getTime();

            tradesSnap.docs.forEach(d => {
                const data = d.data();
                const ts = data.timestamp?.seconds ? data.timestamp.seconds * 1000 : 0;
                if (ts < today || !data.manifest || data.status === 'cancelled') {
                    tradesBatch.delete(d.ref);
                    tradesCount++;
                }
            });
            await tradesBatch.commit();
            newResults["trades_purgados"] = tradesCount;

            // 3. SANEAMIENTO DE USER_ASSETS & RECALIBRACIÓN DE STOCK
            // Si un asset no tiene un trade 'accepted'/'completed' o el item original volvió a 'active', lo borramos.
            const assetsSnap = await getDocs(collection(db, "user_assets"));
            const assetsBatch = writeBatch(db);
            let assetsCount = 0;

            for (const assetDoc of assetsSnap.docs) {
                const assetData = assetDoc.data();
                const invId = assetData.originalInventoryId;

                if (invId) {
                    const invSnap = await getDocs(query(collection(db, "inventory"), where("__name__", "==", invId)));
                    if (!invSnap.empty) {
                        const invData = invSnap.docs[0].data();
                        // Si el ítem está 'active' en el búnker, no puede ser un asset del usuario (duplicidad física)
                        if (invData.logistics?.status === 'active') {
                            assetsBatch.delete(assetDoc.ref);
                            assetsCount++;
                        }
                    }
                }
            }
            await assetsBatch.commit();
            newResults["assets_saneados"] = assetsCount;

            // 4. RECALIBRACIÓN DE STOCK (Inventory)
            // Todos los items que quedaron como sold_out por error vuelven a estar activos
            const invSnap = await getDocs(collection(db, "inventory"));
            const itemsBatch = writeBatch(db);
            let invCount = 0;

            invSnap.docs.forEach(d => {
                const data = d.data();
                if (data.logistics?.status === 'sold_out' || data.logistics?.stock === 0) {
                    itemsBatch.update(d.ref, {
                        "logistics.stock": 1,
                        "logistics.status": "active"
                    });
                    invCount++;
                }
            });
            await itemsBatch.commit();
            newResults["stock_recalibrado"] = invCount;

            // Client side reset
            clearLote();
            localStorage.clear();
            sessionStorage.clear();

            setResults(newResults);
            alert("Operación Tabla Rasa Completada con Éxito. El Búnker ha sido restaurado.");
        } catch (error) {
            console.error("Purge Error:", error);
            alert("Falla Crítica en el Protocolo de Purga: " + error);
        } finally {
            setIsPurging(false);
            setConfirmed(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-12 space-y-12">
            <header className="space-y-4">
                <div className="flex items-center gap-3 text-red-500">
                    <RefreshCw className="h-8 w-8" />
                    <h1 className="text-4xl font-display font-black uppercase tracking-tighter">Operación Tabla Rasa</h1>
                </div>
                <p className="text-gray-500 font-medium">Saneamiento profundo: eliminación de `orders`, purga de trades antiguos y recalibración de stock físico.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {TARGET_COLLECTIONS.map(coll => (
                    <div key={coll} className="bg-white/[0.03] border border-white/5 p-6 rounded-3xl flex items-center gap-4">
                        <Database className="h-5 w-5 text-gray-600" />
                        <div>
                            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Colección</p>
                            <p className="text-lg font-bold text-white capitalize">{coll}</p>
                            {results[coll] !== undefined && (
                                <p className="text-green-500 text-xs font-bold mt-1">Eliminados: {results[coll]}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-red-500/5 border border-red-500/20 p-8 rounded-[2rem] space-y-6">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-red-500/10 rounded-xl">
                        <ShieldCheck className="h-6 w-6 text-red-500" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-lg font-black text-white uppercase tracking-widest">Advertencia de Seguridad</h3>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Al activar este protocolo, no habrá forma de recuperar los datos. Se recomienda realizar un respaldo manual desde la consola de Firebase si es necesario.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4 pt-4">
                    <input
                        type="checkbox"
                        id="confirm"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                        className="w-5 h-5 rounded border-white/10 bg-black text-red-500 focus:ring-red-500"
                    />
                    <label htmlFor="confirm" className="text-xs font-black text-gray-500 uppercase tracking-widest cursor-pointer select-none">
                        Confirmo que deseo ELIMINAR TODOS LOS DATOS permanentemente.
                    </label>
                </div>

                <button
                    onClick={handlePurge}
                    disabled={!confirmed || isPurging}
                    className="w-full bg-red-600 hover:bg-red-500 text-white py-6 rounded-2xl font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4 transition-all disabled:opacity-20 disabled:grayscale"
                >
                    {isPurging ? (
                        <>
                            <RefreshCw className="h-5 w-5 animate-spin" />
                            Purificando Entorno...
                        </>
                    ) : (
                        <>
                            <Trash2 className="h-5 w-5" />
                            Ejecutar Purga de Producción
                        </>
                    )}
                </button>
            </div>

            <footer>
                <p className="text-center text-[10px] font-black text-gray-700 uppercase tracking-widest">
                    Protocolo Oldie but Goldie v3.1 | Limpieza de entorno
                </p>
            </footer>
        </div>
    );
}
