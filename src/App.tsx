import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthContext";
import Layout from "@/components/Layout/Layout";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import AlbumDetail from "@/pages/AlbumDetail";
import Collection from "@/pages/Collection";
import AdminLayout from "@/components/Admin/AdminLayout";
import SyncDashboard from "@/pages/Admin/SyncDashboard";
import TelemetryLogs from "@/components/Admin/TelemetryLogs";
import SecuritySettings from "@/pages/Admin/SecuritySettings";
import { ProtectedRoute } from "@/components/Guard/ProtectedRoute";
import { useTelemetry } from "@/hooks/useTelemetry";

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
  useTelemetry();
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/album/:id" element={<AlbumDetail />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/collection" element={<Collection />} />
          </Route>
        </Route>

        {/* Nested Admin Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/admin" element={<AdminLayout><Outlet /></AdminLayout>}>
            <Route index element={<SyncDashboard />} />
            <Route path="sync" element={<SyncDashboard />} />
            <Route path="logs" element={<TelemetryLogs />} />
            <Route path="security" element={<SecuritySettings />} />
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
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
