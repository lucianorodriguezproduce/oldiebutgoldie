import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthContext";
import { TelemetryProvider } from "@/context/TelemetryContext";
import Layout from "@/components/Layout/Layout";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import AlbumDetail from "@/pages/AlbumDetail";
import Editorial from "@/pages/Editorial";
import ArticleDetail from "@/pages/ArticleDetail";
import Profile from "@/pages/Profile";
import AdminLayout from "@/components/Admin/AdminLayout";
import SyncDashboard from "@/pages/Admin/SyncDashboard";
import AnalyticsDashboard from "@/pages/Admin/AnalyticsDashboard";
import TelemetryLogs from "@/components/Admin/TelemetryLogs";
import SecuritySettings from "@/pages/Admin/SecuritySettings";
import EditorialManager from "@/pages/Admin/EditorialManager";
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
          <Route path="/login" element={<Login />} />
          <Route path="/album/:id" element={<AlbumDetail />} />
          <Route path="/editorial" element={<Editorial />} />
          <Route path="/editorial/:id" element={<ArticleDetail />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>

        {/* Nested Admin Routes */}
        <Route element={<ProtectedRoute adminOnly={true} />}>
          <Route path="/admin" element={<AdminLayout><Outlet /></AdminLayout>}>
            <Route index element={<SyncDashboard />} />
            <Route path="sync" element={<SyncDashboard />} />
            <Route path="analytics" element={<AnalyticsDashboard />} />
            <Route path="logs" element={<TelemetryLogs />} />
            <Route path="security" element={<SecuritySettings />} />
            <Route path="editorial" element={<EditorialManager />} />
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
          <AppContent />
        </TelemetryProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
