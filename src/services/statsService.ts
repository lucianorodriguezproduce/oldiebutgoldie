import { db } from "@/lib/firebase";
import { doc, updateDoc, increment, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

/**
 * Esquema del documento system_stats/global:
 * {
 *   total_views: number,
 *   total_orders: number,
 *   total_revenue: number,
 *   total_users: number,
 *   last_updated: timestamp
 * }
 */

const STATS_DOC_PATH = "system_stats/global";

export const statsService = {
    /**
     * Incrementa un contador global de forma atómica.
     * @param field El campo a incrementar (ej: 'total_views')
     * @param value El valor a sumar (default: 1)
     */
    async incrementGlobalStat(field: string, value: number = 1) {
        const statsRef = doc(db, STATS_DOC_PATH);
        try {
            await updateDoc(statsRef, {
                [field]: increment(value),
                last_updated: serverTimestamp()
            });
        } catch (error: any) {
            // Si el documento no existe, lo inicializamos
            if (error.code === "not-found") {
                await setDoc(statsRef, {
                    total_views: 0,
                    total_orders: 0,
                    total_revenue: 0,
                    total_users: 0,
                    [field]: value,
                    last_updated: serverTimestamp()
                });
            } else {
                console.error("Error updating global stats:", error);
            }
        }
    },

    /**
     * Obtiene los totales globales.
     */
    async getGlobalStats() {
        const statsRef = doc(db, STATS_DOC_PATH);
        const snap = await getDoc(statsRef);
        if (snap.exists()) {
            return snap.data();
        }
        return null;
    }
};
