import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const reviewService = {
    /**
     * Gets public reviews for a specific user
     * @param uid The UID of the user whose reviews to fetch
     * @param limitCount Maximum number of reviews to return (default 10)
     */
    async getPublicReviews(uid: string, limitCount: number = 10) {
        try {
            const reviewsRef = collection(db, "reviews");
            const q = query(
                reviewsRef,
                where("reviewee_uid", "==", uid),
                orderBy("created_at", "desc"),
                limit(limitCount)
            );

            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("[reviewService] Error fetching public reviews:", error);
            throw error;
        }
    }
};
