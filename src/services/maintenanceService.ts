import { db } from "@/lib/firebase";
import { 
    collection, 
    query, 
    where, 
    getDocs, 
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
     * Protocol V36.0: Corregir identidades corruptas en conversaciones.
     * Detecta chats donde el sellerId fue sobrescrito por el buyerId y los repara 
     * consultando el Trade madre.
     */
    async healConversationIdentities() {
        const q = query(collectionGroup(db, "conversations"));
        const snap = await getDocs(q);
        if (snap.empty) return 0;

        let healedCount = 0;
        const batch = writeBatch(db);

        for (const docSnap of snap.docs) {
            const data = docSnap.data() as any;
            
            // Si el sellerId es igual al buyerId, hay corrupción segura inducida por el bug previo
            if (data.sellerId && data.buyerId && data.sellerId === data.buyerId) {
                const pathParts = docSnap.ref.path.split('/');
                const tradeId = pathParts[1];
                
                try {
                    const tradeRef = doc(db, "trades", tradeId);
                    const tradeSnap = await getDocs(query(collection(db, "trades"), where("__name__", "==", tradeId)));
                    
                    if (!tradeSnap.empty) {
                        const tradeData = tradeSnap.docs[0].data();
                        // El vendedor real es siempre el receiverId original en una compra
                        const realSellerId = tradeData.participants?.receiverId || tradeData.user_id || ADMIN_UID;
                        
                        if (realSellerId && realSellerId !== data.sellerId) {
                            // Buscar username real
                            let realSellerUsername = "Vendedor";
                            const sellerDoc = await getDocs(query(collection(db, "users"), where("__name__", "==", realSellerId)));
                            if (!sellerDoc.empty) {
                                const sData = sellerDoc.docs[0].data();
                                realSellerUsername = sData.username ? (sData.username.startsWith('@') ? sData.username : `@${sData.username}`) : "Vendedor";
                            }

                            batch.update(docSnap.ref, {
                                sellerId: realSellerId,
                                sellerUsername: realSellerUsername,
                                healedAt: serverTimestamp()
                            });
                            healedCount++;
                        }
                    }
                } catch (e) {
                    console.error(`[Maintenance] Error healing conversation ${docSnap.ref.path}:`, e);
                }
            }
        }

        if (healedCount > 0) {
            await batch.commit();
        }

        console.log(`[Maintenance] Healed ${healedCount} conversation identities.`);
        return healedCount;
    }
};
