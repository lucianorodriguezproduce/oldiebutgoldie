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

                // Use HTTPS endpoint (ipapi.co supports HTTPS on free tier)
                // Fallback to ipwho.is if ipapi.co fails (both $0 cost)
                let geoData;
                try {
                    const response = await fetch("https://ipapi.co/json/");
                    geoData = await response.json();
                } catch (e) {
                    console.warn("ipapi.co failed, attempting fallback...");
                    const response = await fetch("https://ipwho.is/");
                    geoData = await response.json();
                }

                if (geoData && (geoData.status !== "fail" && !geoData.error)) {
                    await addDoc(collection(db, "interactions"), {
                        uid: user?.uid || null,
                        timestamp: serverTimestamp(),
                        action: "view",
                        resourceId: window.location.pathname,
                        location: {
                            city: geoData.city,
                            region: geoData.region || geoData.region_name,
                            country: geoData.country_name || geoData.country,
                            ip: geoData.ip || geoData.query
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
