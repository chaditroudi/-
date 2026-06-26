import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useBackendRealtimeSync } from "@/hooks/useBackendRealtimeSync";
import { useRealtimeNotifications } from "@/hooks/useNotifications";
import { PwaInstallBanner } from "@/components/layout/PwaInstallBanner";
import { store } from "@/store";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AlertsCenter from "./pages/AlertsCenter";
import SupplierPortal from "./pages/SupplierPortal";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "always",
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 60_000,       // data stays fresh for 1 min — eliminates refetches on tab switch
      gcTime: 10 * 60_000,     // keep cache for 10 min
    },
    mutations: {
      networkMode: "always",
    },
  },
});

const RealtimeSync = () => {
  useBackendRealtimeSync();
  return null;
};

const NotificationsRealtimeBridge = () => {
  useRealtimeNotifications();
  return null;
};

const App = () => (
  <Provider store={store}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SettingsProvider>
          <HashRouter>
            <RealtimeSync />
            <NotificationsRealtimeBridge />
            <TooltipProvider>
              <Toaster />
              <PwaInstallBanner />
              <Routes>
                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/alerts" element={<ProtectedRoute><AlertsCenter /></ProtectedRoute>} />
                <Route path="/portail" element={<ProtectedRoute><SupplierPortal /></ProtectedRoute>} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </TooltipProvider>
          </HashRouter>
        </SettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  </Provider>
);

export default App;
