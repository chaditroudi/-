import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { TopHeader } from "@/components/layout/TopHeader";
import { WorkflowNavigation } from "@/components/layout/WorkflowNavigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { BrandLogo } from "@/components/branding/BrandLogo";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
// HomePage is always the default tab — keep eager so it renders without a Suspense flash.
import { HomePage } from "@/components/home/HomePage";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useMaterials } from "@/hooks/useMaterials";
import { useReceptions } from "@/hooks/useReceptions";
import { useProductionOrders } from "@/hooks/useProduction";
import { useBatches } from "@/hooks/useBatches";
import { useAuthContext } from "@/contexts/AuthContext";
import { ROLE_CONFIG } from "@/types/roles";
import { canPerformAction, getAccessibleTabs, getRoleWorkspaceProfile, type AppTab } from "@/lib/roleAccess";
import { APP_TAB_META } from "@/lib/appTabs";
import { useFactoryShellMetrics } from "@/hooks/useFactoryShellMetrics";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useSettingsContext } from "@/contexts/SettingsContext";
import { useBranding } from "@/hooks/useBranding";
import type { SiteFeatures } from "@/types/settings";

// ── Lazy-loaded tab content ───────────────────────────────────────────────────
// Each import() call becomes its own JS chunk that loads ONLY when that tab is
// first visited. On subsequent visits the browser uses the cached chunk.

const ReceptionDashboardV2   = lazy(() => import('@/components/reception').then(m => ({ default: m.ReceptionDashboardV2 })));
const SuppliersList          = lazy(() => import('@/components/mes/SuppliersList').then(m => ({ default: m.SuppliersList })));
const MaterialsList          = lazy(() => import('@/components/mes/MaterialsList').then(m => ({ default: m.MaterialsList })));
const BatchesList            = lazy(() => import('@/components/batches/BatchesList').then(m => ({ default: m.BatchesList })));
const AlertsDashboard        = lazy(() => import('@/components/batches/AlertsDashboard').then(m => ({ default: m.AlertsDashboard })));
const StorageZonesOverview   = lazy(() => import('@/components/batches/StorageZonesOverview').then(m => ({ default: m.StorageZonesOverview })));
const Phase2Dashboard        = lazy(() => import('@/components/phase2/Phase2Dashboard').then(m => ({ default: m.Phase2Dashboard })));
const ProductionDashboard    = lazy(() => import('@/components/production/ProductionDashboard').then(m => ({ default: m.ProductionDashboard })));
const ProductionFluxDashboard= lazy(() => import('@/components/production/ProductionFluxDashboard').then(m => ({ default: m.ProductionFluxDashboard })));
const ProductionOrdersList   = lazy(() => import('@/components/production/ProductionOrdersList').then(m => ({ default: m.ProductionOrdersList })));
const PackagingDashboard     = lazy(() => import('@/components/packaging/PackagingDashboard').then(m => ({ default: m.PackagingDashboard })));
const QualityDashboard       = lazy(() => import('@/components/quality/QualityDashboard').then(m => ({ default: m.QualityDashboard })));
const SettingsDashboard      = lazy(() => import('@/components/settings/SettingsDashboard').then(m => ({ default: m.SettingsDashboard })));
const AnalyticsDashboard     = lazy(() => import('@/components/analytics').then(m => ({ default: m.AnalyticsDashboard })));
const PurchasingDashboard    = lazy(() => import('@/components/purchasing').then(m => ({ default: m.PurchasingDashboard })));
const LogisticsDashboard     = lazy(() => import('@/components/logistics').then(m => ({ default: m.LogisticsDashboard })));
const HRDashboard            = lazy(() => import('@/components/employees').then(m => ({ default: m.HRDashboard })));
const ScanStation            = lazy(() => import('@/components/scan/ScanStation').then(m => ({ default: m.ScanStation })));
const FactoryCommandCenter   = lazy(() => import('@/components/home/FactoryCommandCenter').then(m => ({ default: m.FactoryCommandCenter })));
const SageOperationsHub      = lazy(() => import('@/components/home/SageOperationsHub').then(m => ({ default: m.SageOperationsHub })));

// ── Suspense fallback ─────────────────────────────────────────────────────────
const TabLoader = () => (
  <div className="flex flex-col items-center justify-center gap-3 py-28">
    <div className="relative h-9 w-9">
      <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-primary/15 border-t-primary" />
      <div className="absolute inset-1.5 animate-ping rounded-full bg-primary/10" />
    </div>
    <p className="text-[12px] font-medium text-muted-foreground/50 animate-pulse">Chargement…</p>
  </div>
);

// ── Static lookup tables (module-level — never recreated) ─────────────────────

const TAB_SECTION_LABEL: Partial<Record<AppTab, string>> = {
  live: "Opérations", scan: "Opérations", receptions: "Opérations",
  production: "Opérations", alerts: "Opérations",
  batches: "Qualité & Stock", storage: "Qualité & Stock", packaging: "Qualité & Stock",
  quality: "Qualité & Stock",
  "stock-dashboard": "Qualité & Stock", "stock-lots": "Qualité & Stock",
  "stock-products": "Qualité & Stock", "stock-movements": "Qualité & Stock",
  suppliers: "Gestion", materials: "Gestion", purchasing: "Gestion",
  logistics: "Gestion", hr: "Gestion",
  analytics: "Pilotage", "sage-operations": "Pilotage",
  settings: "Administration",
};

const TAB_FEATURE_MAP: Partial<Record<AppTab, keyof SiteFeatures>> = {
  receptions: 'receptions_enabled',
  production: 'production_enabled',
  packaging: 'packaging_enabled',
  logistics: 'logistics_enabled',
  purchasing: 'purchasing_enabled',
  analytics: 'analytics_enabled',
  alerts: 'alerts_enabled',
  suppliers: 'supplier_master_enabled',
  materials: 'materials_master_enabled',
  storage: 'stock_enabled',
  'stock-dashboard': 'stock_enabled',
  'stock-lots': 'stock_enabled',
  'stock-products': 'stock_enabled',
  'stock-movements': 'stock_enabled',
  'sage-operations': 'sage_enabled',
};

const SUPPLIER_TABS = ['suppliers', 'purchasing', 'batches'] as const;
const MATERIAL_TABS = ['materials', 'purchasing', 'batches'] as const;

// ── Component ─────────────────────────────────────────────────────────────────

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { roles, profile, isAdmin } = useAuthContext();
  const { settings } = useSettingsContext();
  const { companyName } = useBranding();
  const queryClient = useQueryClient();

  // ── Workspace & accessible tabs ───────────────────────────────────────────

  const workspaceProfile = useMemo(() => getRoleWorkspaceProfile(roles), [roles]);

  const roleAccessibleTabs = useMemo(() => getAccessibleTabs(roles), [roles]);

  const accessibleTabs = useMemo(
    () => roleAccessibleTabs.filter(tab => {
      const featureKey = TAB_FEATURE_MAP[tab];
      return featureKey ? settings.features?.[featureKey] ?? true : true;
    }),
    [roleAccessibleTabs, settings.features],
  );

  const primaryTabs = useMemo(
    () => workspaceProfile.primaryTabs.filter(tab => accessibleTabs.includes(tab)),
    [workspaceProfile.primaryTabs, accessibleTabs],
  );

  const quickTabs = useMemo(
    () => workspaceProfile.quickTabs.filter(tab => accessibleTabs.includes(tab)),
    [workspaceProfile.quickTabs, accessibleTabs],
  );

  // ── Permission flags ──────────────────────────────────────────────────────

  const {
    canReadSuppliers, canReadMaterials, canReadProduction, canReadBatches,
    canReadReceptionsMetrics, canReadBatchMetrics, canReadAlertsMetrics,
    canManagePurchasingData, canManageStorageZones,
  } = useMemo(() => ({
    canReadSuppliers:         accessibleTabs.some(t => (SUPPLIER_TABS as readonly string[]).includes(t)),
    canReadMaterials:         accessibleTabs.some(t => (MATERIAL_TABS as readonly string[]).includes(t)),
    canReadProduction:        accessibleTabs.includes('production'),
    canReadBatches:           accessibleTabs.includes('batches'),
    canReadReceptionsMetrics: accessibleTabs.includes('receptions'),
    canReadBatchMetrics:      accessibleTabs.includes('batches'),
    canReadAlertsMetrics:     accessibleTabs.includes('alerts'),
    canManagePurchasingData:  isAdmin || canPerformAction(roles, 'purchasing_management'),
    canManageStorageZones:    isAdmin || canPerformAction(roles, 'warehouse_operations'),
  }), [accessibleTabs, isAdmin, roles]);

  const roleLabel = useMemo(
    () => roles[0] ? ROLE_CONFIG[roles[0]]?.label : undefined,
    [roles],
  );

  // ── Data fetching ─────────────────────────────────────────────────────────
  // Data is fetched eagerly (role-gated) so it is ready when the user opens a tab.
  // Only the component *code* is deferred via lazy().

  const { data: suppliers = [], refetch: refetchSuppliers } = useSuppliers({ enabled: canReadSuppliers });
  const { data: materials = [], refetch: refetchMaterials } = useMaterials({ enabled: canReadMaterials });
  const { data: receptions = [] } = useReceptions({ enabled: canReadProduction });
  const { data: productionOrders = [] } = useProductionOrders({ enabled: canReadProduction });
  const { data: batches = [] } = useBatches({ enabled: canReadBatches });

  const features = settings.features;

  const {
    draftReceptions, waitingQcReceptions, inQcReceptions, releasedReceptions,
    activeAlertsCount, pendingReceptions, qualityLots, quarantinedLots,
    inProgressOrders, storedLots, phase2Active, phase2Waiting, waitingLots,
    validatedPFLots, activePackagingOrders, pendingShipments,
  } = useFactoryShellMetrics({
    enableReceptions:      canReadReceptionsMetrics,
    enableReceptionAlerts: canReadReceptionsMetrics || canReadAlertsMetrics,
    enableProduction:      canReadProduction,
    enableBatches:         canReadBatchMetrics,
    enableBatchAlerts:     canReadBatchMetrics || canReadAlertsMetrics,
    enablePhase2:          !!features.phase2_enabled,
    enableStock:           !!features.stock_enabled,
    enablePackaging:       !!features.packaging_enabled,
    enableLogistics:       !!features.logistics_enabled,
  });

  // ── Memoized prop objects ─────────────────────────────────────────────────

  const homeMetrics = useMemo(() => ({
    draftReceptions, waitingQcReceptions, inQcReceptions, releasedReceptions,
    pendingReceptions, inProgressOrders, qualityLots, quarantinedLots,
    storedLots, activeAlertsCount, phase2Active, phase2Waiting,
    validatedPFLots, activePackagingOrders, pendingShipments,
  }), [
    draftReceptions, waitingQcReceptions, inQcReceptions, releasedReceptions,
    pendingReceptions, inProgressOrders, qualityLots, quarantinedLots,
    storedLots, activeAlertsCount, phase2Active, phase2Waiting,
    validatedPFLots, activePackagingOrders, pendingShipments,
  ]);

  const mobileMetrics = useMemo(() => ({
    activeAlertsCount,
    pendingReceptions,
    qualityQueueCount: qualityLots,
    inProgressOrders,
    storedLots,
  }), [activeAlertsCount, pendingReceptions, qualityLots, inProgressOrders, storedLots]);

  // ── Tab resolution ────────────────────────────────────────────────────────

  const preferredDefaultTab = useMemo<AppTab>(() => {
    const configured = settings.interface.default_home_tab as AppTab;
    if (accessibleTabs.includes(configured)) return configured;
    if (accessibleTabs.includes(workspaceProfile.defaultTab)) return workspaceProfile.defaultTab;
    return accessibleTabs[0] ?? 'home';
  }, [accessibleTabs, settings.interface.default_home_tab, workspaceProfile.defaultTab]);

  const resolveTab = useCallback((candidate: string | null): AppTab => {
    if (candidate && accessibleTabs.includes(candidate as AppTab)) return candidate as AppTab;
    return preferredDefaultTab;
  }, [accessibleTabs, preferredDefaultTab]);

  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<AppTab>(() => resolveTab(requestedTab));

  // Sync URL param ↔ active tab. Functional updates avoid stale closures.
  useEffect(() => {
    const nextTab = resolveTab(requestedTab);
    setActiveTab(prev => prev !== nextTab ? nextTab : prev);
    if (requestedTab !== nextTab) {
      setSearchParams(prev => {
        const p = new URLSearchParams(prev);
        p.set('tab', nextTab);
        return p;
      }, { replace: true });
    }
  }, [requestedTab, resolveTab, setSearchParams]);

  const currentMeta = useMemo(
    () => APP_TAB_META[activeTab] ?? APP_TAB_META.home,
    [activeTab],
  );

  // ── Navigation callbacks ──────────────────────────────────────────────────

  const [phase2PreselectedLot, setPhase2PreselectedLot] = useState<string | undefined>();
  const [prefillReceptionPOId, setPrefillReceptionPOId] = useState<string | undefined>();

  const handleNavigate = useCallback((tab: string, prefillPOId?: string) => {
    setPrefillReceptionPOId(tab === 'receptions' ? prefillPOId : undefined);
    const nextTab = resolveTab(tab);
    setActiveTab(nextTab);
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('tab', nextTab);
      return p;
    }, { replace: false });
  }, [resolveTab, setSearchParams]);

  const handleGoHome        = useCallback(() => handleNavigate('home'),       [handleNavigate]);
  const handleGoToProduction= useCallback(() => handleNavigate('production'), [handleNavigate]);

  const handleSendToPhase2 = useCallback((lotNumber: string) => {
    setPhase2PreselectedLot(lotNumber);
    handleNavigate('production');
  }, [handleNavigate]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      canReadSuppliers ? refetchSuppliers() : Promise.resolve(),
      canReadMaterials ? refetchMaterials() : Promise.resolve(),
      queryClient.invalidateQueries(),
    ]);
  }, [canReadSuppliers, canReadMaterials, refetchSuppliers, refetchMaterials, queryClient]);

  // ── Page content ──────────────────────────────────────────────────────────

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomePage
            onNavigate={handleNavigate}
            accessibleTabs={accessibleTabs}
            metrics={homeMetrics}
          />
        );
      case 'live':
        return <FactoryCommandCenter />;
      case 'scan':
        return <ScanStation />;
      case 'sage-operations':
        return <SageOperationsHub onNavigate={handleNavigate} accessibleTabs={accessibleTabs} />;
      case 'analytics':
        return <AnalyticsDashboard />;
      case 'stock-dashboard':
      case 'stock-lots':
        return <StorageZonesOverview canManage={canManageStorageZones} defaultTab="lots" />;
      case 'stock-products':
        return <StorageZonesOverview canManage={canManageStorageZones} defaultTab="zones" />;
      case 'stock-movements':
        return <StorageZonesOverview canManage={canManageStorageZones} defaultTab="movements" />;
      case 'storage':
        return <StorageZonesOverview canManage={canManageStorageZones} />;
      case 'batches':
        return <BatchesList batches={batches} suppliers={suppliers} materials={materials} />;
      case 'alerts':
        return <AlertsDashboard />;
      case 'production':
        return (
          <div className="space-y-6">
            {features.phase2_enabled && (
              <Phase2Dashboard
                currentUser={profile?.full_name ?? workspaceProfile.workspaceLabel}
                defaultModule={phase2PreselectedLot ? 'pipeline' : 'fumigation'}
                preSelectedLot={phase2PreselectedLot}
              />
            )}
            <ProductionDashboard orders={productionOrders} />
            <ProductionFluxDashboard />
            <ProductionOrdersList orders={productionOrders} receptions={receptions} />
          </div>
        );
      case 'packaging':
        return (
          <PackagingDashboard currentUser={profile?.full_name ?? workspaceProfile.workspaceLabel} />
        );
      case 'quality':
        return (
          <QualityDashboard currentUser={profile?.full_name ?? workspaceProfile.workspaceLabel} />
        );
      case 'settings':
        return <SettingsDashboard />;
      case 'receptions':
        return (
          <div className="space-y-4">
            {waitingLots.length > 0 && features.phase2_enabled && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                <span className="font-semibold text-amber-700">
                  {waitingLots.length} lot(s) VALIDE{waitingLots.length > 1 ? 's' : ''} en attente de Phase 2
                </span>
                <span className="text-amber-600 text-xs flex-1">
                  {waitingLots.map(l => l.reception_number).slice(0, 5).join(' · ')}
                  {waitingLots.length > 5 ? ` +${waitingLots.length - 5}` : ''}
                </span>
                <button
                  onClick={handleGoToProduction}
                  className="text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900 transition-colors shrink-0"
                >
                  Aller en Production →
                </button>
              </div>
            )}
            <ReceptionDashboardV2 prefillPurchaseOrderId={prefillReceptionPOId} />
          </div>
        );
      case 'suppliers':
        return <SuppliersList suppliers={suppliers} canManage={canManagePurchasingData} />;
      case 'materials':
        return <MaterialsList materials={materials} canManage={canManagePurchasingData} />;
      case 'purchasing':
        return <PurchasingDashboard onNavigate={handleNavigate} />;
      case 'logistics':
        return <LogisticsDashboard />;
      case 'hr':
        return <HRDashboard />;
      default:
        return (
          <HomePage
            onNavigate={handleNavigate}
            accessibleTabs={accessibleTabs}
            metrics={homeMetrics}
          />
        );
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar
        activeTab={activeTab}
        onTabChange={handleNavigate}
        activeAlertsCount={activeAlertsCount}
      />

      <SidebarInset className="flex min-h-screen min-w-0 flex-col bg-shell">

        <TopHeader
          onRefresh={handleRefresh}
          pageTitle={currentMeta.pageTitle}
          pageSubtitle={currentMeta.pageSubtitle}
          sectionLabel={TAB_SECTION_LABEL[activeTab]}
          onHomeClick={handleGoHome}
          roleLabel={roleLabel}
          workspaceLabel={workspaceProfile.workspaceLabel}
          interfaceLabel={workspaceProfile.interfaceLabel}
        />

        <div className="lg:hidden">
          <WorkflowNavigation
            activeTab={activeTab}
            onTabChange={handleNavigate}
            roles={roles}
            profileName={profile?.full_name}
            workspaceLabel={workspaceProfile.workspaceLabel}
            interfaceLabel={workspaceProfile.interfaceLabel}
            primaryTabs={primaryTabs}
            quickTabs={quickTabs}
            metrics={mobileMetrics}
          />
        </div>

        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto">
          <div className="mx-auto w-full max-w-[1800px] px-3 py-4 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-4 sm:py-5 sm:pb-[calc(5rem+env(safe-area-inset-bottom))] lg:px-6 lg:py-6 lg:pb-8">
            <div key={activeTab} className="animate-page-enter w-full">
              <Suspense fallback={<TabLoader />}>
                {renderContent()}
              </Suspense>
            </div>
          </div>
        </main>

        <footer className="flex flex-col items-center justify-between gap-2 border-t border-border/30 bg-background/60 px-4 py-3 text-center backdrop-blur-sm sm:flex-row sm:px-5 sm:text-left lg:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center opacity-40">
              <BrandLogo className="h-full w-full" imgClassName="h-full w-full object-contain" alt={companyName} />
            </div>
            <span className="text-[11px] text-muted-foreground/45">
              © {new Date().getFullYear()} {companyName}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground/35">
            <span className="hidden sm:inline">Manufacturing Execution System</span>
            <span className="h-3 w-px bg-border/60 hidden sm:block" />
            <span className="rounded-full border border-primary/20 bg-primary/6 px-2 py-0.5 text-[10px] font-bold text-primary/60">v2.0</span>
          </div>
        </footer>

      </SidebarInset>
    </SidebarProvider>
  );
};

export default Index;
