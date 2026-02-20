import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthContext";
import { TelemetryProvider } from "@/context/TelemetryContext";
import { LoteProvider } from "@/context/LoteContext";
import { FloatingLoteWidget } from "@/components/FloatingLoteWidget";
import Layout from "@/components/Layout/Layout";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import PublicOrders from "@/pages/PublicOrders";
import AlbumDetail from "@/pages/AlbumDetail";
import Editorial from "@/pages/Editorial";
import ArticleDetail from "@/pages/ArticleDetail";
import Eventos from "@/pages/Eventos";
import Profile from "@/pages/Profile";
import RevisarLote from "@/pages/RevisarLote";
import AdminLayout from "@/components/Admin/AdminLayout";
import AnalyticsDashboard from "@/pages/Admin/AnalyticsDashboard";
import EditorialManager from "@/pages/Admin/EditorialManager";
import CommunityManager from "@/pages/Admin/CommunityManager";
import AdminOrders from "@/pages/AdminOrders";
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
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/actividad" element={<PublicOrders />} />
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
            <Route index element={<AnalyticsDashboard />} />
            <Route path="analytics" element={<AnalyticsDashboard />} />
            <Route path="community" element={<CommunityManager />} />
            <Route path="editorial" element={<EditorialManager />} />
            <Route path="orders" element={<AdminOrders />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TelemetryProvider>
          <LoteProvider>
            <AppContent />
          </LoteProvider>
        </TelemetryProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
