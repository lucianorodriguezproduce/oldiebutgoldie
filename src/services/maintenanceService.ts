import { db } from "@/lib/firebase";
import { 
    collection,
    getDocs, 
    getDoc, 
    doc, 
    updateDoc, 
    deleteDoc,
    query, 
    where,
    collectionGroup,
    writeBatch, 
    serverTimestamp, 
    Timestamp, 
    limit 
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
     * Protocol V41 (Directed Reconciliation): El Sanador Final con Objetivo Dinámico.
     * Migra registros del UID legacy (MKPl...) al UID de sesión real pasado como argumento.
     */
    async healConversationIdentities(targetUid: string) {
        const LEGACY_ADMIN_UID = 'MKPlxxi9JENQt0hS3V1QNeF8oOS2';
        console.log(`[Maintenance] Iniciando Reconciliación V41: Migrando todo a ${targetUid}`);
        
        try {
            const q = query(collectionGroup(db, "conversations"));
            const snap = await getDocs(q);
            
            if (snap.empty) return "0 (No hay conversaciones)";

            let migratedCount = 0;
            let metadataFixed = 0;
            let totalScanned = snap.docs.length;
            
            for (const docSnap of snap.docs) {
                const data = docSnap.data() as any;
                const pathParts = docSnap.ref.path.split('/');
                const tradeIdFromPath = pathParts[1]; 
                
                const changes: any = {};
                
                // 1. MIGRACIÓN DIRECTA AL TARGET
                // Si el sellerId o buyerId es el antiguo, o si es el admin pero no coincide con la sesión
                if (data.sellerId === LEGACY_ADMIN_UID || (data.sellerId === "oldiebutgoldie" && targetUid !== "oldiebutgoldie")) {
                    changes.sellerId = targetUid;
                    migratedCount++;
                }

                if (data.buyerId === LEGACY_ADMIN_UID) {
                    changes.buyerId = targetUid;
                    migratedCount++;
                }

                // 2. Sincronización de Estructura
                if (!data.tradeId || data.tradeId !== tradeIdFromPath) {
                    changes.tradeId = tradeIdFromPath;
                }

                // 3. Sincronización de Identidad Visual (Usernames)
                const currentSellerId = changes.sellerId || data.sellerId;
                if (currentSellerId && (!data.sellerUsername || changes.sellerId)) {
                    const sellerDoc = await getDoc(doc(db, "users", currentSellerId));
                    if (sellerDoc.exists()) {
                        const sData = sellerDoc.data();
                        changes.sellerUsername = sData.username ? (sData.username.startsWith('@') ? sData.username : `@${sData.username}`) : sData.display_name || "Vendedor";
                    }
                }

                if (Object.keys(changes).length > 0) {
                    changes.healing_v = "41.0";
                    changes.healedAt = serverTimestamp();
                    await updateDoc(docSnap.ref, changes);
                    metadataFixed++;
                }
            }

            return `V41 OK: ${migratedCount} UIDs reconciliados con tu sesión, ${metadataFixed} registros sincronizados.`;
        } catch (error: any) {
            console.error("[Heal-V41] ERROR:", error);
            return `ERROR V41: ${error.message}`;
        }
    },

    /**
     * Protocolo de Depuración (Purga Total): Borrado de emergencia para empezar de cero.
     */
    async purgeAllChats() {
        console.log("[Maintenance] Iniciando Purga Total de Mensajes...");
        try {
            const q = query(collectionGroup(db, "conversations"));
            const snap = await getDocs(q);
            
            if (snap.empty) return "Ya está limpio.";

            let count = 0;
            for (const docSnap of snap.docs) {
                //Nota: Esto borra la conversación, pero los mensajes en subcolecciones
                //pueden quedar huérfanos si no se borran recursivamente.
                //Para un "empezar de cero", esto oculta todo efectivamente del Inbox.
                await deleteDoc(docSnap.ref);
                count++;
            }

            return `PURGA COMPLETADA: ${count} conversaciones eliminadas.`;
        } catch (error: any) {
            return `ERROR PURGA: ${error.message}`;
        }
    },

    async diagnoseAllConversations(currentUid: string) {
        console.log("[Audit] Iniciando Diagnóstico de Red V39...");
        try {
            const q = query(collectionGroup(db, "conversations"));
            const snap = await getDocs(q);
            
            if (snap.empty) return "AUDITORÍA V39\nNo se encontraron conversaciones.";

            const total = snap.docs.length;
            const previewItems = snap.docs.slice(0, 5).map(d => {
                const data = d.data();
                return `ID: ${d.id.slice(0,8)}... | S: ${data.sellerId?.slice(0,8)}... | B: ${data.buyerId?.slice(0,8)}...`;
            });

            const report = `AUDITORÍA V39\n` +
                         `TU UID ACTUAL: ${currentUid}\n` +
                         `ADMIN_UID CONST: ${ADMIN_UID}\n` +
                         `--------------------------\n` +
                         `Total Chats: ${total}\n` +
                         `Muestra de IDs:\n${previewItems.join('\n')}\n` +
                         `--------------------------\n` +
                         `¿Hay Mismatch? ${previewItems.some(i => i.includes(currentUid.slice(0,8))) ? 'NO' : 'SÍ (REVISAR)'}`;

            return report;
        } catch (error: any) {
            return "Error en auditoría: " + error.message;
        }
    }
};
