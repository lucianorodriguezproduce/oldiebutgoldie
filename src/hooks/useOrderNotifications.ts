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

        // Listen for trades where it's the user's turn
        const qSender = query(
            collection(db, "trades"),
            where("participants.senderId", "==", user.uid),
            where("currentTurn", "==", user.uid),
            where("status", "in", ["pending", "counter_offer"])
        );

        const qReceiver = query(
            collection(db, "trades"),
            where("participants.receiverId", "==", user.uid),
            where("currentTurn", "==", user.uid),
            where("status", "in", ["pending", "counter_offer"])
        );

        const unsubSender = onSnapshot(qSender, (snap) => {
            setHasActiveOffer(prev => prev || !snap.empty);
            setLoading(false);
        });

        const unsubReceiver = onSnapshot(qReceiver, (snap) => {
            setHasActiveOffer(prev => prev || !snap.empty);
            setLoading(false);
        });

        return () => {
            unsubSender();
            unsubReceiver();
        };
    }, [user]);

    return { hasActiveOffer, loading };
};
