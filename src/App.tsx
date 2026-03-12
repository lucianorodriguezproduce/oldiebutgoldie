import { Routes, Route, Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import * as Sentry from "@sentry/react";
import ErrorFallback from "@/components/ui/ErrorFallback";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy, useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { TelemetryProvider } from "@/context/TelemetryContext";
import { LoteProvider } from "@/context/LoteContext";
import { LoadingProvider } from "@/context/LoadingContext";
import { FloatingCartCounter } from "@/components/FloatingCartCounter";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import Layout from "@/components/Layout/Layout";

// Lazy Loaded Pages (Code Splitting)
const Login = lazy(() => import("@/pages/Login"));
const Home = lazy(() => import("@/pages/Home"));
import { useSearchParams } from "react-router-dom";
import { useLote } from "@/context/LoteContext";
import { inventoryService } from "@/services/inventoryService";

const URLParameterHandler = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { addItemFromInventory } = useLote();

  useEffect(() => {
    const itemId = searchParams.get('add');
    if (itemId) {
      const handleAutomaticAdd = async () => {
        try {
          const item = await inventoryService.getItemById(itemId);
          if (item) {
            addItemFromInventory(item);
            // Clean up URL parameter without changing the route
            searchParams.delete('add');
            setSearchParams(searchParams, { replace: true });
          }
        } catch (error) {
          console.error("Global automatic add-to-cart failed:", error);
        }
      };
      handleAutomaticAdd();
    }
  }, [searchParams, setSearchParams, addItemFromInventory]);

  return null;
};

const PublicOrders = lazy(() => import("@/pages/PublicOrders"));
const PublicOrderView = lazy(() => import("@/pages/PublicOrderView"));
const AlbumDetail = lazy(() => import("@/pages/AlbumDetail"));
const Editorial = lazy(() => import("@/pages/Editorial"));
const ArticleDetail = lazy(() => import("@/pages/ArticleDetail"));
const Eventos = lazy(() => import("@/pages/Eventos"));
const Profile = lazy(() => import("@/pages/Profile"));
const RevisarLote = lazy(() => import("@/pages/RevisarLote"));
const PublicationCheckout = lazy(() => import('./pages/PublicationCheckout'));
const TradeConstructor = lazy(() => import("@/pages/TradeConstructor"));
const Store = lazy(() => import("@/pages/Store"));
const PublicProfile = lazy(() => import("@/pages/PublicProfile"));
const Archivo = lazy(() => import("@/pages/Archivo"));
const ArchivoItem = lazy(() => import("@/pages/ArchivoItem"));

// Admin Lazy
const AdminLayout = lazy(() => import("@/components/Admin/AdminLayout"));
const AdminStats = lazy(() => import("@/pages/Admin/AdminStats"));
const EditorialManager = lazy(() => import("@/pages/Admin/EditorialManager"));
const DatabasePurge = lazy(() => import("@/pages/Admin/DatabasePurge"));
const BulkUpload = lazy(() => import("@/pages/Admin/BulkUpload"));
const BrandingPage = lazy(() => import("@/pages/Admin/BrandingPage"));
const AdminInventory = lazy(() => import("@/pages/Admin/AdminInventory"));
const AdminCollection = lazy(() => import("@/pages/Admin/AdminCollection"));
const AdminTrades = lazy(() => import("@/pages/Admin/AdminTrades"));
const PermissionConsole = lazy(() => import("@/pages/Admin/PermissionConsole"));

import Guias from "@/pages/Guias";
import { ProtectedRoute } from "@/components/Guard/ProtectedRoute";
import { Navigate } from "react-router-dom";


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

import { useHealth } from "@/context/HealthContext";
import { useAnalytics } from "@/hooks/useAnalytics";

const EnergyModeIndicator = () => {
  const { health } = useHealth();
  if (!health.isEnergyMode) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-6 left-6 z-[100] px-4 py-2 bg-orange-500/20 border border-orange-500/40 backdrop-blur-md rounded-full flex items-center gap-2 shadow-2xl"
    >
      <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
      <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Modo Ahorro Energético</span>
    </motion.div>
  );
};

const AnalyticsWrapper = ({ children }: { children: React.ReactNode }) => {
  useAnalytics(); // El radar se activa aquí
  return <>{children}</>;
};

function AppContent() {
  const { isAdmin, user } = useAuth();
  const { health } = useHealth();
  const [siteConfig, setSiteConfig] = useState<any>(null);

  // Sync User context with Sentry
  useEffect(() => {
    if (user) {
      Sentry.setUser({
        id: user.uid,
        username: (user as any).displayName || 'Anonymous',
        // Redacting sensitive info like email if needed, but Firebase User usually safe
      });
    } else {
      Sentry.setUser(null);
    }
  }, [user]);

  // Real-time Config sync
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "settings", "site_config"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSiteConfig(data);

        // Favicon logic (V11.2)
        if (data.favicon?.url) {
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.getElementsByTagName('head')[0].appendChild(link);
          }
          if (link.href !== data.favicon.url) {
            link.href = data.favicon.url;
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <>
      <URLParameterHandler />
      <LoadingOverlay />
      <FloatingCartCounter />
      <Suspense fallback={<LoadingOverlay />}>
        <AnalyticsWrapper>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/tienda" element={<Store />} />
              <Route path="/u/:username" element={<PublicProfile />} />

              {/* P2P Routes with Guard (V24.8 Access Persistence Fix) */}
              <Route
                path="/comercio"
                element={
                  (siteConfig === null || siteConfig?.p2p_global_enabled || siteConfig?.allow_p2p_public_offers || isAdmin) 
                    ? <PublicOrders /> 
                    : <Navigate to="/tienda" replace />
                }
              />

              <Route path="/orden/:id" element={<PublicOrderView />} />
              <Route path="/revisar-lote" element={<RevisarLote />} />
              <Route path="/item/:type/:id" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/album/:id" element={<AlbumDetail />} />
              <Route path="/comunidad" element={<Editorial />} />
              <Route path="/comunidad/:id" element={<ArticleDetail />} />
              <Route path="/guias" element={<Guias />} />
              <Route path="/eventos" element={<Eventos />} />
            <Route path="/checkout/publication/:tradeId" element={<PublicationCheckout />} />
            <Route
                path="/trade/new"
                element={siteConfig?.allow_p2p_public_offers === false ? <Navigate to="/tienda" replace /> : <TradeConstructor />}
              />
              <Route path="/archivo" element={<Archivo />} />
              <Route path="/archivo/:id" element={<ArchivoItem />} />

              {/* Redirecciones Legales / SEO */}
              <Route path="/actividad" element={<Navigate to="/comercio" replace />} />
              <Route path="/editorial" element={<Navigate to="/comunidad" replace />} />
              <Route path="/profile" element={<Navigate to="/perfil" replace />} />

              <Route element={<ProtectedRoute />}>
                <Route path="/perfil" element={<Profile />} />
                <Route
                  path="/trade/new"
                  element={
                    (siteConfig === null || siteConfig?.p2p_global_enabled || siteConfig?.allow_p2p_public_offers || isAdmin)
                      ? <TradeConstructor />
                      : <Navigate to="/tienda" replace />
                  }
                />
              </Route>
            </Route>

            {/* Nested Admin Routes */}
            <Route element={<ProtectedRoute adminOnly={true} />}>
              <Route path="/admin" element={<AdminLayout><Outlet /></AdminLayout>}>
                <Route index element={<AdminStats />} />
                <Route path="analytics" element={<AdminStats />} />
                <Route path="inventory" element={<AdminInventory />} />
                <Route path="collection" element={<AdminCollection />} />
                <Route path="trades" element={<AdminTrades />} />
                <Route path="editorial" element={<EditorialManager />} />

                <Route path="bulk-upload" element={<BulkUpload />} />
                <Route path="branding" element={<BrandingPage />} />
                <Route path="permissions" element={<PermissionConsole />} />
                <Route path="purge" element={<DatabasePurge />} />
              </Route>
            </Route>
          </Routes>
        </AnalyticsWrapper>
      </Suspense>
      <EnergyModeIndicator />
    </>
  );
}

import { HealthProvider } from './context/HealthContext';
import { GTMProvider } from './context/GTMContext';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LoadingProvider>
        <AuthProvider>
          <GTMProvider>
            <TelemetryProvider>
              <LoteProvider>
                <Sentry.ErrorBoundary fallback={({ error, resetError, eventId }) => (
                  <ErrorFallback error={error as any} resetErrorBoundary={resetError} eventId={eventId} />
                )}>
                  <AppContent />
                </Sentry.ErrorBoundary>
                <Analytics />
                <SpeedInsights />
              </LoteProvider>
            </TelemetryProvider>
          </GTMProvider>
        </AuthProvider>
      </LoadingProvider>
    </QueryClientProvider>
  );
}

export default App;
