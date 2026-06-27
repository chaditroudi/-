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
  <div className="flex flex-col items-center justify-center gap-4 py-32">
    <div className="relative h-10 w-10">
      <div className="absolute inset-0 animate-spin rounded-full border-2 border-primary/10 border-t-primary" />
      <div className="absolute inset-[5px] animate-spin rounded-full border-2 border-transparent border-b-primary/40" style={{ animationDirection: 'reverse', animationDuration: '0.7s' }} />
    </div>
    <p className="text-[11.5px] font-semibold tracking-wider text-muted-foreground/40 animate-pulse uppercase">
      Chargement
    </p>
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
              <div className="flex items-center gap-3 rounded-xl border border-amber-200/70 bg-amber-50/80 px-4 py-2.5 text-sm backdrop-blur-sm">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
                <span className="font-semibold text-amber-700">
                  {waitingLots.length} lot{waitingLots.length > 1 ? 's' : ''} en attente de Phase 2
                </span>
                <span className="flex-1 truncate text-xs text-amber-600/80">
                  {waitingLots.map(l => l.reception_number).slice(0, 5).join(' · ')}
                  {waitingLots.length > 5 ? ` +${waitingLots.length - 5}` : ''}
                </span>
                <button
                  onClick={handleGoToProduction}
                  className="shrink-0 rounded-lg border border-amber-300/60 bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-200 hover:text-amber-900"
                >
                  Production →
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

        <footer className="flex flex-col items-center justify-between gap-2 border-t border-border/40 bg-card/70 px-4 py-2.5 text-center backdrop-blur-sm sm:flex-row sm:px-5 sm:text-left lg:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-[18px] w-[18px] items-center justify-center opacity-35">
              <BrandLogo className="h-full w-full" imgClassName="h-full w-full object-contain" alt={companyName} />
            </div>
            <span className="text-[10.5px] font-medium text-muted-foreground/40">
              © {new Date().getFullYear()} {companyName}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground/32">
            <span className="hidden sm:inline font-medium">MES Royal Palm</span>
            <span className="hidden h-2.5 w-px bg-border/50 sm:block" />
            <span className="rounded-full border border-primary/18 bg-primary/5 px-2 py-0.5 text-[9.5px] font-bold tracking-wide text-primary/55">
              v2.0
            </span>
          </div>
        </footer>

      </SidebarInset>
    </SidebarProvider>
  );
};

export default Index;
