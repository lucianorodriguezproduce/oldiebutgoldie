import { db } from "@/lib/firebase";
import {
    doc,
    setDoc,
    deleteDoc,
    collection,
    onSnapshot,
    query
} from "firebase/firestore";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export function useUserCollection(type: "collection" | "wantlist" = "collection") {
    const { user } = useAuth();
    const [items, setItems] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setItems([]);
            setLoading(false);
            return;
        }

        const q = query(collection(db, "users", user.uid, type));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const itemIds = snapshot.docs.map(doc => doc.id);
            setItems(itemIds);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, type]);

    const toggleItem = async (releaseId: string, data: any) => {
        if (!user) return;

        const itemRef = doc(db, "users", user.uid, type, releaseId);
        if (items.includes(releaseId)) {
            await deleteDoc(itemRef);
        } else {
            await setDoc(itemRef, {
                ...data,
                addedAt: new Date().toISOString()
            });
        }
    };

    const hasItem = (releaseId: string) => items.includes(releaseId);

    return { items, loading, toggleItem, hasItem };
}
