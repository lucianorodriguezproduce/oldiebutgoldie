import { db } from "@/lib/firebase";
import { 
    collection, 
    query, 
    where, 
    getDoc,
    getDocs, 
    updateDoc,
    writeBatch, 
    Timestamp, 
    doc,
    serverTimestamp,
    orderBy,
    limit,
    collectionGroup
} from "firebase/firestore";
import { ADMIN_UID } from "@/constants/admin";

export const maintenanceService = {
    /**
     * Purges analytics intents older than 30 days.
     */
    async purgeAnalyticsIntents() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const q = query(
            collection(db, "analytics_intents"),
            where("timestamp", "<", Timestamp.fromDate(thirtyDaysAgo))
        );

        const snap = await getDocs(q);
        if (snap.empty) return 0;

        const batchSize = 500;
        let deletedCount = 0;
        
        // Firestore batches are limited to 500 operations
        for (let i = 0; i < snap.docs.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = snap.docs.slice(i, i + batchSize);
            chunk.forEach(d => batch.delete(d.ref));
            await batch.commit();
            deletedCount += chunk.length;
        }

        console.log(`[Maintenance] Purged ${deletedCount} analytics intents.`);
        return deletedCount;
    },

    /**
     * Purges notifications based on age and read status.
     */
    async purgeNotifications() {
        const readThreshold = new Date();
        readThreshold.setDate(readThreshold.getDate() - 15);

        const globalThreshold = new Date();
        globalThreshold.setDate(globalThreshold.getDate() - 45);

        const qRead = query(
            collection(db, "notifications"),
            where("read", "==", true),
            where("timestamp", "<", Timestamp.fromDate(readThreshold))
        );

        const qOld = query(
            collection(db, "notifications"),
            where("timestamp", "<", Timestamp.fromDate(globalThreshold))
        );

        const [snapRead, snapOld] = await Promise.all([getDocs(qRead), getDocs(qOld)]);
        
        const allDocs = [...snapRead.docs, ...snapOld.docs];
        if (allDocs.length === 0) return 0;

        // Use a Set to avoid deleting the same doc twice if it matches both queries
        const uniqueRefs = new Set(allDocs.map(d => d.ref.path));
        const batchSize = 500;
        let deletedCount = 0;

        const refList = Array.from(uniqueRefs);
        for (let i = 0; i < refList.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = refList.slice(i, i + batchSize);
            chunk.forEach(path => batch.delete(doc(db, path)));
            await batch.commit();
            deletedCount += chunk.length;
        }

        console.log(`[Maintenance] Purged ${deletedCount} notifications.`);
        return deletedCount;
    },

    /**
     * Purges stale trades (cancelled/rejected) older than 60 days.
     */
    async purgeStaleTrades() {
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        const q = query(
            collection(db, "trades"),
            where("status", "in", ["cancelled", "rejected"]),
            where("timestamp", "<", Timestamp.fromDate(sixtyDaysAgo))
        );

        const snap = await getDocs(q);
        if (snap.empty) return 0;

        const batchSize = 500;
        let deletedCount = 0;
        
        for (let i = 0; i < snap.docs.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = snap.docs.slice(i, i + batchSize);
            chunk.forEach(d => batch.delete(d.ref));
            await batch.commit();
            deletedCount += chunk.length;
        }

        console.log(`[Maintenance] Purged ${deletedCount} stale trades.`);
        return deletedCount;
    },

    /**
     * Archives items with no stock that aren't tied to active trades.
     */
    async archiveSoldOutItems() {
        // 1. Find items with stock 0 and status active
        const q = query(
            collection(db, "inventory"),
            where("logistics.stock", "==", 0),
            where("logistics.status", "==", "active")
        );
        const snap = await getDocs(q);
        if (snap.empty) return 0;

        // 2. Identify items that are NOT in any active trade
        // (This is a simplified safety check: we only archive if they haven't been touched in 7 days)
        const safetyThreshold = new Date();
        safetyThreshold.setDate(safetyThreshold.getDate() - 7);

        let archivedCount = 0;
        const batch = writeBatch(db);

        snap.docs.forEach(d => {
            const data = d.data();
            const lastUpdated = data.timestamp?.toDate ? data.timestamp.toDate() : new Date();
            
            if (lastUpdated < safetyThreshold) {
                batch.update(d.ref, { "logistics.status": "archived" });
                archivedCount++;
            }
        });

        if (archivedCount > 0) {
            await batch.commit();
        }

        console.log(`[Maintenance] Archived ${archivedCount} sold-out items.`);
        return archivedCount;
    },

    /**
     * Protocol V36.2 (Hyper-Diagnostic): Sanador Omnisciente.
     * Soporta UIDs dinámicos y genera feedback detallado para el administrador.
     */
    async healConversationIdentities() {
        console.log("[Maintenance] Iniciando Protocolo de Curación V36.2...");
        try {
            const q = query(collectionGroup(db, "conversations"));
            const snap = await getDocs(q);
            
            if (snap.empty) return "0 (No se encontraron conversaciones)";

            let healedCount = 0;
            let adminMisattributions = 0;
            let collisionsCount = 0;
            let totalScanned = snap.docs.length;
            
            for (const docSnap of snap.docs) {
                const data = docSnap.data() as any;
                const pathParts = docSnap.ref.path.split('/');
                const tradeId = pathParts[1]; 
                
                let needsHealing = false;
                let reason = "";

                // CASO 1: Colisión (Seller === Buyer)
                if (data.sellerId && data.buyerId && data.sellerId === data.buyerId) {
                    needsHealing = true;
                    reason = "collision";
                } 
                // CASO 2: Atribución Admin (MKPl... o oldiebutgoldie)
                else if (data.sellerId === ADMIN_UID || data.sellerId === "oldiebutgoldie") {
                    needsHealing = true;
                    reason = "admin_check";
                }

                if (needsHealing) {
                    try {
                        // Buscamos la verdad en Trades y User Assets
                        const assetRef = doc(db, "user_assets", tradeId);
                        const tradeRef = doc(db, "trades", tradeId);
                        
                        const [assetSnap, tradeSnap] = await Promise.all([
                            getDoc(assetRef),
                            getDoc(tradeRef)
                        ]);

                        let realSellerId = null;

                        if (assetSnap.exists()) {
                            realSellerId = assetSnap.data().ownerId;
                        } else if (tradeSnap.exists()) {
                            const tData = tradeSnap.data();
                            // Estrategia de recuperación de Trade (V36.2)
                            realSellerId = (tData.participants?.receiverId && tData.participants.receiverId !== ADMIN_UID && tData.participants.receiverId !== "oldiebutgoldie") 
                                ? tData.participants.receiverId 
                                : (tData.user_id && tData.user_id !== ADMIN_UID && tData.user_id !== "oldiebutgoldie" ? tData.user_id : null);
                        }

                        // Si hay un dueño legítimo y es distinto al actual
                        if (realSellerId && realSellerId !== data.sellerId && realSellerId !== "system") {
                            let realSellerUsername = "Vendedor";
                            const sellerDoc = await getDoc(doc(db, "users", realSellerId));
                            
                            if (sellerDoc.exists()) {
                                const sData = sellerDoc.data();
                                realSellerUsername = sData.username ? (sData.username.startsWith('@') ? sData.username : `@${sData.username}`) : sData.display_name || "Vendedor";
                            }

                            await updateDoc(docSnap.ref, {
                                sellerId: realSellerId,
                                sellerUsername: realSellerUsername,
                                healedAt: serverTimestamp(),
                                healing_v: "36.2",
                                healingReason: reason
                            });

                            healedCount++;
                            if (reason === "collision") collisionsCount++;
                            else adminMisattributions++;
                            
                            console.log(`[Heal-V36.2] HEALED: ${tradeId} -> ${realSellerUsername} (${reason})`);
                        }
                    } catch (e: any) {
                        console.error(`[Heal-V36.2] Error en item ${tradeId}:`, e.message);
                    }
                }
            }

            return `${healedCount} (Corregidos: ${adminMisattributions}, Colisiones: ${collisionsCount}) de ${totalScanned} analizados.`;
        } catch (error: any) {
            console.error("[Heal-V36.2] FATAL ERROR:", error);
            return `ERROR: ${error.message}`;
        }
    },

    /**
     * Protocol V36.3 (Audit): Diagnóstico profundo.
     * Lista todos los IDs en consola para inspección manual.
     */
    async diagnoseAllConversations() {
        console.log("[Audit] Iniciando Diagnóstico de Red V36.3...");
        const q = query(collectionGroup(db, "conversations"));
        const snap = await getDocs(q);
        
        let report = [];
        for (const docSnap of snap.docs) {
            const data = docSnap.data() as any;
            const path = docSnap.ref.path;
            const meta = `[${path}] S:${data.sellerId} B:${data.buyerId} T:${data.tradeId}`;
            console.log(meta);
            report.push(meta);
        }

        return `Scaneados ${report.length} chats. Revisa la consola para el volcado de IDs.`;
    }
};
