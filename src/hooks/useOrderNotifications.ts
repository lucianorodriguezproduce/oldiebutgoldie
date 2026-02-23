import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export const useOrderNotifications = () => {
    const { user } = useAuth();
    const [hasActiveOffer, setHasActiveOffer] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setHasActiveOffer(false);
            setLoading(false);
            return;
        }

        // Listen for orders with status 'offer_sent' for the current user
        const q = query(
            collection(db, "orders"),
            where("user_id", "==", user.uid),
            where("status", "==", "offer_sent")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setHasActiveOffer(!snapshot.empty);
            setLoading(false);
        }, (error) => {
            console.error("useOrderNotifications error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    return { hasActiveOffer, loading };
};
