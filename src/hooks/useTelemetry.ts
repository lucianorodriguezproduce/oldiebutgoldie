import { useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

export function useTelemetry() {
    const { user } = useAuth();

    useEffect(() => {
        const trackInteraction = async () => {
            try {
                // Check if we already tracked this session to avoid spam (optional)
                const sessionTracked = sessionStorage.getItem("telemetry_tracked");
                if (sessionTracked) return;

                const response = await fetch("http://ip-api.com/json/");
                const geoData = await response.json();

                if (geoData.status === "success") {
                    await addDoc(collection(db, "interactions"), {
                        uid: user?.uid || null,
                        timestamp: serverTimestamp(),
                        action: "view",
                        resourceId: window.location.pathname,
                        location: {
                            city: geoData.city,
                            region: geoData.regionName,
                            country: geoData.country,
                            ip: geoData.query
                        }
                    });
                    sessionStorage.setItem("telemetry_tracked", "true");
                    console.log("Telemetry logged:", geoData.city);
                }
            } catch (error) {
                console.error("Telemetry failed:", error);
            }
        };

        trackInteraction();
    }, [user]);
}
