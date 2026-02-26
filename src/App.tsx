import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { AuthProvider } from "@/context/AuthContext";
import { TelemetryProvider } from "@/context/TelemetryContext";
import { LoteProvider } from "@/context/LoteContext";
import { LoadingProvider } from "@/context/LoadingContext";
import { FloatingCartCounter } from "@/components/FloatingCartCounter";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
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
import AdminLayout from "@/components/Admin/AdminLayout";
import AdminAnalytics from "@/pages/Admin/AdminAnalytics";
import EditorialManager from "@/pages/Admin/EditorialManager";
import CommunityManager from "@/pages/Admin/CommunityManager";
import DatabasePurge from "@/pages/Admin/DatabasePurge";
import BulkUpload from "@/pages/Admin/BulkUpload";
import BrandingPage from "@/pages/Admin/BrandingPage";
import AdminInventory from "@/pages/Admin/AdminInventory";
import AdminTrades from "@/pages/Admin/AdminTrades";
import { ProtectedRoute } from "@/components/Guard/ProtectedRoute";


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
  // Real-time Favicon sync
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "settings", "site_config"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
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
      <AnalyticsProvider>
        <LoadingOverlay />
        <FloatingCartCounter />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/actividad" element={<PublicOrders />} />
            <Route path="/orden/:id" element={<PublicOrderView />} />
            <Route path="/revisar-lote" element={<RevisarLote />} />
            <Route path="/item/:type/:id" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/album/:id" element={<AlbumDetail />} />
            <Route path="/editorial" element={<Editorial />} />
            <Route path="/editorial/:id" element={<ArticleDetail />} />
            <Route path="/eventos" element={<Eventos />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Route>

          {/* Nested Admin Routes */}
          <Route element={<ProtectedRoute adminOnly={true} />}>
            <Route path="/admin" element={<AdminLayout><Outlet /></AdminLayout>}>
              <Route index element={<AdminAnalytics />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="inventory" element={<AdminInventory />} />
              <Route path="trades" element={<AdminTrades />} />
              <Route path="editorial" element={<EditorialManager />} />

              <Route path="bulk-upload" element={<BulkUpload />} />
              <Route path="branding" element={<BrandingPage />} />
              <Route path="purge" element={<DatabasePurge />} />
            </Route>
          </Route>
        </Routes>
      </AnalyticsProvider>
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
