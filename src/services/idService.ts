import { db } from "@/lib/firebase";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

/**
 * ID Service: Protocol V103
 * Handles atomic counter increments and serialized ID generation.
 * Format: [PREFIX]-[YYMM]-[SEQ]
 */
export const idService = {
    /**
     * Generates a unique, sequential internal ID for various transaction types.
     * @param prefix 'VTA' (Venta/Item), 'CNJ' (Canje), 'SRV' (Servicio), 'EQP' (Equipo), 'SLO' (Soberano/Other)
     */
    async generateInternalID(prefix: 'VTA' | 'CNJ' | 'SRV' | 'EQP' | 'SLO'): Promise<string> {
        const counterRef = doc(db, "system", "counters");
        
        return await runTransaction(db, async (transaction) => {
            const counterSnap = await transaction.get(counterRef);
            
            // Default initial state if doc doesn't exist (though it should be pre-initialized)
            const data = counterSnap.exists() ? counterSnap.data() : { VTA: 0, CNJ: 0, SRV: 0, EQP: 0, SLO: 0 };
            
            const currentVal = (data[prefix] || 0) + 1;
            
            // Update the counter atomically
            transaction.set(counterRef, { 
                ...data,
                [prefix]: currentVal, 
                last_updated: serverTimestamp() 
            }, { merge: true });
            
            // Format ID: [PREFIX]-[YYMM]-[0001]
            const now = new Date();
            const yy = String(now.getFullYear()).slice(-2);
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const seq = String(currentVal).padStart(4, '0');
            
            const generatedId = `${prefix}-${yy}${mm}-${seq}`;
            console.log(`[V103-ID-GEN] Generated: ${generatedId}`);
            return generatedId;
        });
    },

    /**
     * One-time setup to ensure system/counters exists.
     */
    async initializeCounters() {
        const counterRef = doc(db, "system", "counters");
        const snap = await getDoc(counterRef);
        if (!snap.exists()) {
            await setDoc(counterRef, {
                VTA: 0,
                CNJ: 0,
                SRV: 0,
                EQP: 0,
                SLO: 0,
                initializedAt: serverTimestamp()
            });
            console.log("[V103-ID-INIT] counters initialized at 0.");
        }
    }
};

// Helper to support legacy imports if needed during transition
import { getDoc, setDoc } from "firebase/firestore";
