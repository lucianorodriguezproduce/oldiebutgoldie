import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { AuthProvider } from "@/context/AuthContext";
import { TelemetryProvider } from "@/context/TelemetryContext";
import { LoteProvider } from "@/context/LoteContext";
import { LoadingProvider } from "@/context/LoadingContext";
import { FloatingCartCounter } from "@/components/FloatingCartCounter";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import Layout from "@/components/Layout/Layout";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import PublicOrders from "@/pages/PublicOrders";
import PublicOrderView from "@/pages/PublicOrderView";
import AlbumDetail from "@/pages/AlbumDetail";
import Editorial from "@/pages/Editorial";
import ArticleDetail from "@/pages/ArticleDetail";
import Eventos from "@/pages/Eventos";
import Profile from "@/pages/Profile";
import RevisarLote from "@/pages/RevisarLote";
import TradeConstructor from "@/pages/TradeConstructor";
import Store from "@/pages/Store";
import PublicProfile from "@/pages/PublicProfile";
import Archivo from "@/pages/Archivo";
import ArchivoItem from "@/pages/ArchivoItem";
import AdminLayout from "@/components/Admin/AdminLayout";
import AdminAnalytics from "@/pages/Admin/AdminAnalytics";
import EditorialManager from "@/pages/Admin/EditorialManager";
import CommunityManager from "@/pages/Admin/CommunityManager";
import DatabasePurge from "@/pages/Admin/DatabasePurge";
import BulkUpload from "@/pages/Admin/BulkUpload";
import BrandingPage from "@/pages/Admin/BrandingPage";
import AdminInventory from "@/pages/Admin/AdminInventory";
import AdminCollection from "@/pages/Admin/AdminCollection";
import AdminTrades from "@/pages/Admin/AdminTrades";
import PermissionConsole from "@/pages/Admin/PermissionConsole";
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

function AppContent() {
  const [siteConfig, setSiteConfig] = useState<any>(null);

  // Real-time Config sync
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "settings", "site_config"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSiteConfig(data);

        // Favicon logic
        if (data.favicon?.url) {
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.getElementsByTagName('head')[0].appendChild(link);
          }
          link.href = data.favicon.url;
        }
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <LoadingOverlay />
      <FloatingCartCounter />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/tienda" element={<Store />} />
          <Route path="/u/:username" element={<PublicProfile />} />

          {/* P2P Routes with Guard */}
          <Route
            path="/comercio"
            element={siteConfig?.p2p_global_enabled === false ? <Navigate to="/tienda" replace /> : <PublicOrders />}
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
              element={siteConfig?.p2p_global_enabled === false ? <Navigate to="/tienda" replace /> : <TradeConstructor />}
            />
          </Route>
        </Route>

        {/* Nested Admin Routes */}
        <Route element={<ProtectedRoute adminOnly={true} />}>
          <Route path="/admin" element={<AdminLayout><Outlet /></AdminLayout>}>
            <Route index element={<AdminAnalytics />} />
            <Route path="analytics" element={<AdminAnalytics />} />
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
    </BrowserRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LoadingProvider>
        <AuthProvider>
          <TelemetryProvider>
            <LoteProvider>
              <AppContent />
            </LoteProvider>
          </TelemetryProvider>
        </AuthProvider>
      </LoadingProvider>
    </QueryClientProvider>
  );
}

export default App;
