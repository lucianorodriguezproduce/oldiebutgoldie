import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Star } from "lucide-react";

interface ReviewCardProps {
    review: {
        reviewer_uid: string;
        rating: number;
        comment?: string;
        created_at: any;
    };
}

export default function ReviewCard({ review }: ReviewCardProps) {
    const [reviewer, setReviewer] = useState<{ username: string; display_name: string } | null>(null);

    useEffect(() => {
        const fetchReviewer = async () => {
            try {
                const userDoc = await getDoc(doc(db, "users", review.reviewer_uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    setReviewer({
                        username: data.username || "Usuario",
                        display_name: data.display_name || "Usuario"
                    });
                }
            } catch (error) {
                console.error("[ReviewCard] Error fetching reviewer:", error);
            }
        };

        fetchReviewer();
    }, [review.reviewer_uid]);

    const formatRelativeDate = (timestamp: any) => {
        if (!timestamp) return "";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return "Justo ahora";
        if (diffInSeconds < 3600) return `Hace ${Math.floor(diffInSeconds / 60)}m`;
        if (diffInSeconds < 86400) return `Hace ${Math.floor(diffInSeconds / 3600)}h`;
        if (diffInSeconds < 2592000) return `Hace ${Math.floor(diffInSeconds / 84400)}d`;
        return date.toLocaleDateString();
    };

    return (
        <div className="p-5 bg-white/[0.03] backdrop-blur-md border border-white/5 rounded-2xl space-y-3 transition-all hover:bg-white/[0.05]">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                            key={i}
                            className={`w-3 h-3 ${i < review.rating ? "fill-primary text-primary" : "text-gray-600"}`}
                        />
                    ))}
                </div>
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">
                    {formatRelativeDate(review.created_at)}
                </span>
            </div>

            {review.comment && (
                <p className="text-sm font-medium text-gray-300 italic italic-leading-relaxed">
                    "{review.comment}"
                </p>
            )}

            <div className="flex items-center gap-2 pt-1">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-black text-primary uppercase">
                    {reviewer?.username.charAt(1) || "U"}
                </div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    Por <span className="text-gray-300">{reviewer?.username || "Cargando..."}</span>
                </p>
            </div>
        </div>
    );
}
