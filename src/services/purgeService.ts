import { db } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc, writeBatch } from "firebase/firestore";

/**
 * Purge Service: Protocol V103
 * WARNING: Destructive operations.
 */
export const purgeService = {
    /**
     * Purges all documents in the specified collections.
     * Use with EXTREME caution.
     */
    async executeWipeV103() {
        console.warn("[V103-PURGE] INITIATING COMPLETE ENVIRONMENT PURGE...");
        
        const COLLECTIONS_TO_PURGE = ["inventory", "trades", "editorial", "services"];
        
        for (const collName of COLLECTIONS_TO_PURGE) {
            console.log(`[V103-PURGE] Purging collection: ${collName}`);
            const querySnapshot = await getDocs(collection(db, collName));
            
            if (querySnapshot.empty) {
                console.log(`[V103-PURGE] Collection ${collName} is already empty.`);
                continue;
            }

            const batch = writeBatch(db);
            querySnapshot.docs.forEach((docSnap) => {
                batch.delete(docSnap.ref);
            });
            
            await batch.commit();
            console.log(`[V103-PURGE] Sucessfully purged ${querySnapshot.size} documents from ${collName}.`);
        }
        
        console.warn("[V103-PURGE] PURGE COMPLETE. ENVIRONMENT AT ZERO STATE.");
    }
};
