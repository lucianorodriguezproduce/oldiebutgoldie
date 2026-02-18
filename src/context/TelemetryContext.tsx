import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

interface GeoData {
  city?: string;
  region?: string;
  country?: string;
  ip?: string;
}

interface TelemetryContextType {
  trackEvent: (action: string, metadata?: Record<string, any>) => Promise<void>;
  location: GeoData | null;
}

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [location, setLocation] = useState<GeoData | null>(null);
  const [initialized, setInitialized] = useState(false);

  // 1. Fetch Location ONCE per session
  useEffect(() => {
    const initTelemetry = async () => {
      // Check session storage first
      const cached = sessionStorage.getItem("telemetry_geo");
      if (cached) {
        setLocation(JSON.parse(cached));
        setInitialized(true);
        return;
      }

      try {
        // Try ipapi.co (HTTPS support)
        let geo: GeoData = {};
        try {
          const res = await fetch("https://ipapi.co/json/");
          const data = await res.json();
          if (!data.error) {
            geo = {
              city: data.city,
              region: data.region,
              country: data.country_name,
              ip: data.ip
            };
          }
        } catch (e) {
          console.warn("Primary geo provider failed, trying fallback...");
          // Fallback to ipwho.is
          const res = await fetch("https://ipwho.is/");
          const data = await res.json();
          if (data.success) {
            geo = {
              city: data.city,
              region: data.region,
              country: data.country,
              ip: data.ip
            };
          }
        }

        if (geo.ip) {
          setLocation(geo);
          sessionStorage.setItem("telemetry_geo", JSON.stringify(geo));
        }
      } catch (err) {
        console.error("Telemetry initialization failed:", err);
      } finally {
        setInitialized(true);
      }
    };

    initTelemetry();
  }, []);

  // 2. Log "Session Start" once we have location + user (or just location)
  useEffect(() => {
    if (initialized && location && !sessionStorage.getItem("telemetry_session_logged")) {
      trackEvent("session_start", { path: window.location.pathname });
      sessionStorage.setItem("telemetry_session_logged", "true");
    }
  }, [initialized, location, user]);

  const trackEvent = async (action: string, metadata: Record<string, any> = {}) => {
    try {
      if (!location && !initialized) return; // Wait for init if possible

      await addDoc(collection(db, "interactions"), {
        uid: user?.uid || "anonymous",
        timestamp: serverTimestamp(),
        action,
        metadata,
        location: location || {},
        userAgent: navigator.userAgent,
        path: window.location.pathname
      });
    } catch (error) {
      console.error("Failed to track event:", error);
    }
  };

  return (
    <TelemetryContext.Provider value={{ trackEvent, location }}>
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry() {
  const context = useContext(TelemetryContext);
  if (context === undefined) {
    throw new Error("useTelemetry must be used within a TelemetryProvider");
  }
  return context;
}
