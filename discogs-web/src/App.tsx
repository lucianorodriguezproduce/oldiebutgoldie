import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthContext";
import Layout from "@/components/Layout/Layout";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import AlbumDetail from "@/pages/AlbumDetail";
import Collection from "@/pages/Collection";
import Admin from "@/pages/Admin";
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
            <Route path="/admin" element={<Admin />} />
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
