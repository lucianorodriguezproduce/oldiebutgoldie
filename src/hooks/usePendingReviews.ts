import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export const usePendingReviews = () => {
    const { user } = useAuth();
    const [pendingTrades, setPendingTrades] = useState<any[]>([]);

    useEffect(() => {
        if (!user?.uid) {
            setPendingTrades([]);
            return;
        }

        const q = query(
            collection(db, "trades"),
            where("status", "==", "completed"),
            where("pending_reviews", "array-contains", user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const trades = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPendingTrades(trades);
        }, (error) => {
            console.error("[usePendingReviews] Subscription error:", error);
        });

        return () => unsubscribe();
    }, [user?.uid]);

    return pendingTrades;
};
