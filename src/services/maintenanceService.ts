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
     * Protocol V38 (Full Metadata Sync): Sanador de Verdad y Estructura.
     * Repara identidades, tradeId faltantes y usernames huérfanos para restaurar visibilidad.
     */
    async healConversationIdentities() {
        console.log("[Maintenance] Iniciando Protocolo de Sincronización V38...");
        try {
            const q = query(collectionGroup(db, "conversations"));
            const snap = await getDocs(q);
            
            if (snap.empty) return "0 (No se encontraron conversaciones)";

            let healedCount = 0;
            let metadataFixed = 0;
            let totalScanned = snap.docs.length;
            
            for (const docSnap of snap.docs) {
                const data = docSnap.data() as any;
                const pathParts = docSnap.ref.path.split('/');
                const tradeIdFromPath = pathParts[1]; 
                
                const changes: any = {};
                
                // 1. Verificación de Estructura (tradeId)
                if (!data.tradeId || data.tradeId !== tradeIdFromPath) {
                    changes.tradeId = tradeIdFromPath;
                }

                // 2. Verificación de Identidad (Propiedad)
                const invRef = doc(db, "inventory", tradeIdFromPath);
                const assetRef = doc(db, "user_assets", tradeIdFromPath);
                const [invSnap, assetSnap] = await Promise.all([getDoc(invRef), getDoc(assetRef)]);

                let realSellerId = data.sellerId;
                if (invSnap.exists()) {
                    realSellerId = ADMIN_UID;
                } else if (assetSnap.exists()) {
                    realSellerId = assetSnap.data().ownerId;
                }

                // Si el seller detectado es distinto al guardado
                if (realSellerId && realSellerId !== data.sellerId) {
                    changes.sellerId = realSellerId;
                    healedCount++;
                }

                // 3. Sincronización de Nombres de Usuario (Fallback Crítico)
                // Si faltan nombres, la UI no sabe qué mostrar
                if (realSellerId && (!data.sellerUsername || changes.sellerId)) {
                    const sellerDoc = await getDoc(doc(db, "users", realSellerId));
                    if (sellerDoc.exists()) {
                        const sData = sellerDoc.data();
                        changes.sellerUsername = sData.username ? (sData.username.startsWith('@') ? sData.username : `@${sData.username}`) : sData.display_name || "Vendedor";
                    }
                }

                if (data.buyerId && !data.buyerUsername) {
                    const buyerDoc = await getDoc(doc(db, "users", data.buyerId));
                    if (buyerDoc.exists()) {
                        const bData = buyerDoc.data();
                        changes.buyerUsername = bData.username ? (bData.username.startsWith('@') ? bData.username : `@${bData.username}`) : bData.display_name || "Comprador";
                    }
                }

                if (Object.keys(changes).length > 0) {
                    changes.healing_v = "38.0";
                    changes.healedAt = serverTimestamp();
                    await updateDoc(docSnap.ref, changes);
                    metadataFixed++;
                    console.log(`[Heal-V38] SYNC: ${tradeIdFromPath} -> Fixes: ${Object.keys(changes).join(', ')}`);
                }
            }

            return `V38 OK: ${healedCount} identidades, ${metadataFixed} metadatos sincronizados de ${totalScanned}.`;
        } catch (error: any) {
            console.error("[Heal-V38] FATAL ERROR:", error);
            return `ERROR V38: ${error.message}`;
        }
    },

    /**
     * Protocol V36.3 (Audit): Diagnóstico profundo visible en UI.
     */
    async diagnoseAllConversations() {
        console.log("[Audit] Iniciando Diagnóstico de Red V36.3...");
        const q = query(collectionGroup(db, "conversations"));
        const snap = await getDocs(q);
        
        let report = [];
        let previewItems = [];
        
        for (const docSnap of snap.docs) {
            const data = docSnap.data() as any;
            const path = docSnap.ref.path;
            const meta = `[${path.split('/').pop()}] S:${data.sellerId || 'MISSING'} B:${data.buyerId || 'MISSING'} T:${data.tradeId || 'MISSING'}`;
            console.log(meta);
            report.push(meta);
            if (previewItems.length < 5) previewItems.push(meta);
        }

        const previewText = previewItems.length > 0 
            ? "\n\nDATOS (Primeros 5):\n" + previewItems.join('\n') 
            : "\n\n(No hay datos de previsualización)";

        return `Scaneados ${report.length} chats.${previewText}\n\nRevisa la consola para el volcado completo de IDs.`;
    }
};
