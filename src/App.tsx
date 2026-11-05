import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuthContext } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useBackendRealtimeSync } from "@/hooks/useBackendRealtimeSync";
import { useRealtimeNotifications } from "@/hooks/useNotifications";
import { PwaInstallBanner } from "@/components/layout/PwaInstallBanner";
import { OfflineSyncStatus } from "@/components/layout/OfflineSyncStatus";
import { EnvironmentRibbon } from "@/components/layout/EnvironmentRibbon";
import { restartSseConnection } from "@/lib/sseClient";
import { clearSessionData } from "@/lib/sessionData";
import { factorySessionIdentity } from "@/lib/factorySession";
import { AppErrorBoundary } from "@/components/shared/AppErrorBoundary";
import { shouldRetryQuery } from "@/lib/apiErrors";
import { canAccessTab, isSupplierPortalRole } from "@/lib/roleAccess";
import { store } from "@/store";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AlertsCenter from "./pages/AlertsCenter";
import SupplierPortal from "./pages/SupplierPortal";
import PassportPage from "./pages/PassportPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "always",
      refetchOnWindowFocus: false,
      retry: shouldRetryQuery,
      staleTime: 60_000,       // data stays fresh for 1 min — eliminates refetches on tab switch
      gcTime: 10 * 60_000,     // keep cache for 10 min
    },
    mutations: {
      networkMode: "always",
    },
  },
});

/** A tablet is shared: nothing one account loaded or subscribed to may reach the next. */
const SessionBoundary = ({ children }: { children: ReactNode }) => {
  const { user } = useAuthContext();
  const client = useQueryClient();
  const identity = factorySessionIdentity(user);
  const [readyIdentity, setReadyIdentity] = useState(identity);

  useEffect(() => {
    if (readyIdentity === identity) return;
    let active = true;
    restartSseConnection();
    void clearSessionData(client).then(() => { if (active) setReadyIdentity(identity); });
    return () => { active = false; };
  }, [client, identity, readyIdentity]);

  return readyIdentity === identity ? <Fragment key={identity ?? 'anonymous'}>{children}</Fragment> : null;
};

const RealtimeSync = () => {
  useBackendRealtimeSync();
  return null;
};

const NotificationsRealtimeBridge = () => {
  useRealtimeNotifications();
  return null;
};

const App = () => (
  <AppErrorBoundary>
  <Provider store={store}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SessionBoundary>
        <SettingsProvider>
          <HashRouter>
            <RealtimeSync />
            <NotificationsRealtimeBridge />
            <TooltipProvider>
              <Toaster />
              <EnvironmentRibbon />
              <PwaInstallBanner />
              <OfflineSyncStatus />
              <Routes>
                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/passport/:lotId" element={<PassportPage />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/alerts" element={<ProtectedRoute allow={(roles) => canAccessTab(roles, "alerts")}><AlertsCenter /></ProtectedRoute>} />
                <Route path="/portail" element={<ProtectedRoute allow={isSupplierPortalRole}><SupplierPortal /></ProtectedRoute>} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </TooltipProvider>
          </HashRouter>
        </SettingsProvider>
        </SessionBoundary>
      </AuthProvider>
    </QueryClientProvider>
  </Provider>
  </AppErrorBoundary>
);

export default App;
