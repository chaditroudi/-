import { PRODUCTION_VIEWS, type ProductionView } from '@/components/production/views';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { TopHeader } from "@/components/layout/TopHeader";
import { WorkflowNavigation } from "@/components/layout/WorkflowNavigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { CommandMenu } from "@/components/layout/CommandMenu";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// HomePage is always the default tab — keep eager so it renders without a Suspense flash.
import { HomePage } from "@/components/home/HomePage";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useMaterials } from "@/hooks/useMaterials";
import { useReceptions } from "@/hooks/useReceptions";
import { useProductionOrders } from "@/hooks/useProduction";
import { useAuthContext } from "@/contexts/AuthContext";
import { ROLE_CONFIG } from "@/types/roles";
import { canPerformAction, getAccessibleTabs, getRoleWorkspaceProfile, landsOnSupplierPortal, type AppTab } from "@/lib/roleAccess";
import { canRead } from "@/lib/apiAccess";
import { getReceptionPermissions } from "@/lib/receptionWorkflow";
import { RestrictedScreen } from "@/components/auth/RestrictedScreen";
import { AppErrorBoundary } from "@/components/shared/AppErrorBoundary";
import { APP_TAB_META } from "@/lib/appTabs";
import { useFactoryShellMetrics } from "@/hooks/useFactoryShellMetrics";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, useSearchParams } from "react-router-dom";
import { useSettingsContext } from "@/contexts/SettingsContext";
import { AiGuideProvider } from "@/contexts/AiGuideContext";
import { useBranding } from "@/hooks/useBranding";
import type { SiteFeatures } from "@/types/settings";
import { PRODUCT } from "@/lib/productMeta";

// ── Lazy-loaded tab content ───────────────────────────────────────────────────
// Each import() call becomes its own JS chunk that loads ONLY when that tab is
// first visited. On subsequent visits the browser uses the cached chunk.

const ReceptionDashboardV2   = lazy(() => import('@/components/reception').then(m => ({ default: m.ReceptionDashboardV2 })));
const DocumentsWorkspace     = lazy(() => import('@/components/documents/DocumentsWorkspace').then(m => ({ default: m.DocumentsWorkspace })));
const FichesTechniquesHub    = lazy(() => import('@/components/fiches').then(m => ({ default: m.FichesTechniquesHub })));
const SuppliersList          = lazy(() => import('@/components/mes/SuppliersList').then(m => ({ default: m.SuppliersList })));
const MaterialsList          = lazy(() => import('@/components/mes/MaterialsList').then(m => ({ default: m.MaterialsList })));
const AlertsCenter           = lazy(() => import('@/pages/AlertsCenter'));
const StorageZonesOverview   = lazy(() => import('@/components/batches/StorageZonesOverview').then(m => ({ default: m.StorageZonesOverview })));
const ProductionWorkspace    = lazy(() => import('@/components/production/ProductionWorkspace').then(m => ({ default: m.ProductionWorkspace })));
const PackagingDashboard     = lazy(() => import('@/components/packaging/PackagingDashboard').then(m => ({ default: m.PackagingDashboard })));
const QualityDashboard       = lazy(() => import('@/components/quality/QualityDashboard').then(m => ({ default: m.QualityDashboard })));
const SettingsDashboard      = lazy(() => import('@/components/settings/SettingsDashboard').then(m => ({ default: m.SettingsDashboard })));
const AnalyticsDashboard     = lazy(() => import('@/components/analytics').then(m => ({ default: m.AnalyticsDashboard })));
const PurchasingDashboard    = lazy(() => import('@/components/purchasing').then(m => ({ default: m.PurchasingDashboard })));
const MaintenanceDashboard   = lazy(() => import('@/components/maintenance').then(m => ({ default: m.MaintenanceDashboard })));
const LogisticsDashboard     = lazy(() => import('@/components/logistics').then(m => ({ default: m.LogisticsDashboard })));
const HRDashboard            = lazy(() => import('@/components/employees').then(m => ({ default: m.HRDashboard })));
const ScanStation            = lazy(() => import('@/components/scan/ScanStation').then(m => ({ default: m.ScanStation })));
const FactoryCommandCenter   = lazy(() => import('@/components/home/FactoryCommandCenter').then(m => ({ default: m.FactoryCommandCenter })));
const SageOperationsHub      = lazy(() => import('@/components/home/SageOperationsHub').then(m => ({ default: m.SageOperationsHub })));
const ExportDashboard        = lazy(() => import('@/components/export/ExportDashboard').then(m => ({ default: m.ExportDashboard })));
const CustomersDashboard     = lazy(() => import('@/components/customers/CustomersDashboard'));

// ── Suspense fallback ─────────────────────────────────────────────────────────
const TabLoader = () => (
  <div role="status" className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
    Chargement…
  </div>
);

// ── Static lookup tables (module-level — never recreated) ─────────────────────

const TAB_SECTION_LABEL: Partial<Record<AppTab, string>> = {
  home: "Accueil Atelier",
  live: "Opérations", scan: "Scanner un lot", alerts: "Alertes en direct",
  receptions: "Atelier — Réception & Pesée",
  storage: "Atelier — Stock & Chambres Froides",
  production: "Atelier — Traitement & Triage",
  packaging: "Atelier — Conditionnement",
  logistics: "Atelier — Expédition & Sortie",
  export: "Bureau — Export & Douane",
  "stock-dashboard": "Atelier — Stock & Chambres Froides", "stock-lots": "Atelier — Stock & Chambres Froides",
  "stock-products": "Atelier — Stock & Chambres Froides", "stock-movements": "Atelier — Stock & Chambres Froides",
  suppliers: "Bureau — Fournisseurs", materials: "Bureau — Articles", purchasing: "Bureau — Achats & Règlements",
  maintenance: "Bureau — Maintenance", quality: "Bureau — Qualité & CAPA", hr: "Bureau — Ressources Humaines",
  analytics: "Direction — Indicateurs", "sage-operations": "Direction — Cockpit Usine", customers: "Bureau — Clients",
  settings: "Administration & Paramètres",
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

const SUPPLIER_TABS = ['suppliers', 'purchasing', 'receptions'] as const;
const MATERIAL_TABS = ['materials', 'purchasing', 'receptions'] as const;

// ── Component ─────────────────────────────────────────────────────────────────

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { roles, profile, isAdmin, signOut } = useAuthContext();
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
    () => Array.from(new Set([...workspaceProfile.quickTabs, ...accessibleTabs]))
      .filter(tab => accessibleTabs.includes(tab) && !primaryTabs.includes(tab)),
    [workspaceProfile.quickTabs, accessibleTabs, primaryTabs],
  );

  // ── Permission flags ──────────────────────────────────────────────────────

  const {
    canReadSuppliers, canReadMaterials, canReadProduction,
    canReadReceptionsMetrics, canReadBatchMetrics, canReadAlertsMetrics,
    canManagePurchasingData, canManageStorageZones,
  } = useMemo(() => ({
    canReadSuppliers:         accessibleTabs.some(t => (SUPPLIER_TABS as readonly string[]).includes(t)),
    canReadMaterials:         accessibleTabs.some(t => (MATERIAL_TABS as readonly string[]).includes(t)),
    canReadProduction:        accessibleTabs.includes('production'),
    canReadReceptionsMetrics: accessibleTabs.includes('receptions'),
    // La file qualité vit sous Réception depuis la suppression de l'onglet Lots Qualité.
    canReadBatchMetrics:      accessibleTabs.includes('receptions') || accessibleTabs.includes('quality'),
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
  const productionQuery = useProductionOrders({ enabled: canReadProduction });
  const { data: productionOrders = [] } = productionQuery;

  const features = settings.features;
  const stagesReadable = !!features.phase2_enabled && canRead(roles, 'stageLots');

  const {
    draftReceptions, waitingQcReceptions, inQcReceptions, releasedReceptions,
    activeAlertsCount, pendingReceptions, qualityLots, quarantinedLots,
    inProgressOrders, storedLots, phase2Active, phase2Waiting, waitingLots,
    validatedPFLots, activePackagingOrders, pendingShipments, coverage,
  } = useFactoryShellMetrics({
    enableReceptions:      canReadReceptionsMetrics && canRead(roles, 'receptions'),
    enableReceptionAlerts: canRead(roles, 'receptionAlerts'),
    enableReceptionLots:   canRead(roles, 'receptionLots'),
    enableProduction:      canReadProduction,
    enableBatchAlerts:     canReadBatchMetrics || canReadAlertsMetrics,
    enablePhase2:          stagesReadable,
    enableStock:           !!features.stock_enabled && canRead(roles, 'stockLots'),
    enablePackaging:       !!features.packaging_enabled && canRead(roles, 'packagingOrders'),
    enableLogistics:       !!features.logistics_enabled && canRead(roles, 'shipments'),
  });

  // ── Memoized prop objects ─────────────────────────────────────────────────

  const homeMetrics = useMemo(() => ({
    draftReceptions, waitingQcReceptions, inQcReceptions, releasedReceptions,
    pendingReceptions, inProgressOrders, qualityLots, quarantinedLots,
    storedLots, activeAlertsCount, phase2Active, phase2Waiting,
    validatedPFLots, activePackagingOrders, pendingShipments, coverage,
  }), [
    draftReceptions, waitingQcReceptions, inQcReceptions, releasedReceptions,
    pendingReceptions, inProgressOrders, qualityLots, quarantinedLots,
    storedLots, activeAlertsCount, phase2Active, phase2Waiting,
    validatedPFLots, activePackagingOrders, pendingShipments, coverage,
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
    // Employees land on Parcours lot when available — modules stay reachable, not the landing.
    if (accessibleTabs.includes('home')) return 'home';
    const configured = settings.interface.default_home_tab as AppTab;
    if (accessibleTabs.includes(configured)) return configured;
    if (accessibleTabs.includes(workspaceProfile.defaultTab)) return workspaceProfile.defaultTab;
    return accessibleTabs[0] ?? 'home';
  }, [accessibleTabs, settings.interface.default_home_tab, workspaceProfile.defaultTab]);

  const resolveTab = useCallback((candidate: string | null): AppTab => {
    // Stock was consolidated into one 'storage' work-center; legacy stock-* deep
    // links (notifications, workflow steps, settings) still resolve to it.
    const LEGACY_STOCK_TABS = ['stock-dashboard', 'stock-lots', 'stock-products', 'stock-movements'];
    if (candidate && LEGACY_STOCK_TABS.includes(candidate) && accessibleTabs.includes('storage')) {
      return 'storage';
    }
    if (candidate && accessibleTabs.includes(candidate as AppTab)) return candidate as AppTab;
    return preferredDefaultTab;
  }, [accessibleTabs, preferredDefaultTab]);

  const requestedTab = searchParams.get('tab');
  // A typed or shared address for a screen this role lacks says so, instead of moving them.
  const deniedTab = requestedTab && requestedTab in APP_TAB_META && resolveTab(requestedTab) !== requestedTab
    ? requestedTab as AppTab
    : null;
  const [activeTab, setActiveTab] = useState<AppTab>(() => resolveTab(requestedTab));

  // Sync URL param ↔ active tab. Functional updates avoid stale closures.
  useEffect(() => {
    const nextTab = resolveTab(requestedTab);
    setActiveTab(prev => prev !== nextTab ? nextTab : prev);
    if (!deniedTab && requestedTab !== nextTab) {
      setSearchParams(prev => {
        const p = new URLSearchParams(prev);
        p.set('tab', nextTab);
        return p;
      }, { replace: true });
    }
  }, [deniedTab, requestedTab, resolveTab, setSearchParams]);

  const currentMeta = useMemo(
    () => APP_TAB_META[activeTab] ?? APP_TAB_META.home,
    [activeTab],
  );

  // ── Navigation callbacks ──────────────────────────────────────────────────

  const [phase2PreselectedLot, setPhase2PreselectedLot] = useState<string | undefined>();
  const [productionView, setProductionView] = useState<ProductionView>('today');
  const [purchasingFocus, setPurchasingFocus] = useState<string | undefined>();
  const [prefillReceptionPOId, setPrefillReceptionPOId] = useState<string | undefined>();
  const [receptionView, setReceptionView] = useState<string | undefined>(() =>
    searchParams.get('tab') === 'receptions' ? searchParams.get('view') || undefined : undefined,
  );
  const [logisticsView, setLogisticsView] = useState<string | undefined>(() =>
    searchParams.get('tab') === 'logistics' ? searchParams.get('view') || undefined : undefined,
  );
  const [documentAction, setDocumentAction] = useState<string | undefined>(() =>
    searchParams.get('action') === 'new' ? 'new' : undefined,
  );
  const [homeView, setHomeView] = useState<string | undefined>(() =>
    searchParams.get('tab') === 'home' && searchParams.get('view') === 'fiches' ? 'fiches' : undefined,
  );
  const [ficheDeepLink, setFicheDeepLink] = useState<string | undefined>(() =>
    searchParams.get('fiche') || undefined,
  );

  const handleNavigate = useCallback((tab: string, options?: import('@/lib/appNavigate').AppNavigateOptions | string) => {
    const opts = typeof options === 'string' ? { prefillPOId: options } : (options || {});
    setPrefillReceptionPOId(tab === 'receptions' ? opts.prefillPOId : undefined);
    if (tab === 'production') {
      const requested = (opts.module ?? opts.view) as ProductionView | undefined;
      setProductionView(requested && PRODUCTION_VIEWS.includes(requested) ? requested : 'today');
      if (opts.lot) setPhase2PreselectedLot(opts.lot);
    }
    if (tab === 'purchasing' && opts.focus) setPurchasingFocus(opts.focus);
    if (tab === 'receptions') setReceptionView(opts.view);
    else setReceptionView(undefined);
    if (tab === 'logistics') setLogisticsView(opts.view);
    else setLogisticsView(undefined);
    if (tab === 'home') setHomeView(opts.view === 'fiches' ? 'fiches' : undefined);
    else setHomeView(undefined);
    setFicheDeepLink(opts.focus?.startsWith('FT-') ? opts.focus : undefined);
    setDocumentAction(opts.action === 'new' ? 'new' : undefined);
    const nextTab = resolveTab(tab);
    setActiveTab(nextTab);
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('tab', nextTab);
      if (opts.view) p.set('view', opts.view); else p.delete('view');
      if (opts.module) p.set('module', opts.module); else p.delete('module');
      if (opts.lot) p.set('lot', opts.lot); else p.delete('lot');
      if (opts.focus) p.set('focus', opts.focus); else p.delete('focus');
      if (opts.action) p.set('action', opts.action); else p.delete('action');
      if (opts.focus?.startsWith('FT-')) p.set('fiche', opts.focus); else p.delete('fiche');
      return p;
    }, { replace: false });
  }, [resolveTab, setSearchParams, features.phase2_enabled]);

  const handleGoHome        = useCallback(() => handleNavigate('home'),       [handleNavigate]);
  const handleGoToProduction= useCallback(() => handleNavigate('production'), [handleNavigate]);

  const handleSendToPhase2 = useCallback((lotNumber: string) => {
    handleNavigate('production', { lot: lotNumber, view: 'phase2', module: 'pipeline' });
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
        if (homeView === 'fiches') {
          return (
            <FichesTechniquesHub
              onNavigate={handleNavigate}
              accessibleTabs={accessibleTabs}
              initialFicheId={ficheDeepLink}
            />
          );
        }
        return (
          <HomePage roles={roles}
            canInspect={getReceptionPermissions(roles).canRunQc}
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
      case 'alerts':
        return <AlertsCenter embedded />;
      case 'production':
        return (
          <ProductionWorkspace
            orders={productionOrders}
            ordersData={productionQuery.data}
            ordersSource={{ isLoading: productionQuery.isLoading, error: productionQuery.error, updatedAt: productionQuery.fulfilledTimeStamp, refetch: productionQuery.refetch }}
            receptions={receptions}
            currentUser={profile?.full_name ?? workspaceProfile.workspaceLabel}
            stagesEnabled={stagesReadable}
            view={productionView}
            onViewChange={setProductionView}
            preSelectedLot={phase2PreselectedLot}
            roles={roles}
          />
        );
      case 'packaging':
        return (
          <PackagingDashboard currentUser={profile?.full_name ?? workspaceProfile.workspaceLabel} />
        );
      case 'quality':
        return (
          <QualityDashboard currentUser={profile?.full_name ?? workspaceProfile.workspaceLabel} />
        );
      case 'export':
        return <ExportDashboard />;
      case 'customers':
        return <CustomersDashboard />;
      case 'settings':
        return <SettingsDashboard onNavigate={handleNavigate} />;
      case 'receptions':
        if (receptionView === 'bra') {
          return (
            <DocumentsWorkspace
              kind="bra"
              canBra={accessibleTabs.includes('receptions')}
              canBde={accessibleTabs.includes('logistics')}
              autoOpenCreate={documentAction === 'new'}
              onNavigate={handleNavigate}
            />
          );
        }
        return (
          <div className="space-y-4">
            {waitingLots.length > 0 && features.phase2_enabled && (
              <div className="flex items-center gap-3 rounded-xl border border-amber-200/70 bg-amber-50/80 px-4 py-2.5 text-sm backdrop-blur-sm">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full hidden rounded-full bg-amber-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
                <span className="font-semibold text-amber-700">
                  {waitingLots.length} lot{waitingLots.length > 1 ? 's' : ''} à transformer
                </span>
                <span className="flex-1" />
                <button
                  onClick={handleGoToProduction}
                  className="shrink-0 rounded-lg border border-amber-300/60 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-200 hover:text-amber-900"
                >
                  Production →
                </button>
              </div>
            )}
            <ReceptionDashboardV2
              prefillPurchaseOrderId={prefillReceptionPOId}
              initialView={receptionView}
              onViewChange={setReceptionView}
            />
          </div>
        );
      case 'suppliers':
        return <SuppliersList suppliers={suppliers} canManage={canManagePurchasingData} />;
      case 'materials':
        return <MaterialsList materials={materials} canManage={canManagePurchasingData} />;
      case 'purchasing':
        return <PurchasingDashboard onNavigate={handleNavigate} initialFocus={purchasingFocus} />;
      case 'maintenance':
        return <MaintenanceDashboard />;
      case 'logistics':
        if (logisticsView === 'bde') {
          return (
            <DocumentsWorkspace
              kind="bde"
              canBra={accessibleTabs.includes('receptions')}
              canBde={accessibleTabs.includes('logistics')}
              autoOpenCreate={documentAction === 'new'}
              onNavigate={handleNavigate}
            />
          );
        }
        return <LogisticsDashboard initialView={logisticsView} />;
      case 'hr':
        return <HRDashboard />;
      default:
        return (
          <HomePage roles={roles}
            canInspect={getReceptionPermissions(roles).canRunQc}
            onNavigate={handleNavigate}
            accessibleTabs={accessibleTabs}
            metrics={homeMetrics}
          />
        );
    }
  };

  if (landsOnSupplierPortal(roles)) return <Navigate to="/portail" replace />;
  if (roles.length > 0 && roles.every(role => role === 'client_externe' || role === 'partenaire_client_export')) {
    return <div className="mx-auto max-w-lg space-y-4 p-6">
      <h1 className="font-display text-2xl">Espace client</h1>
      <p>Le portail client n’est pas encore disponible. Votre compte ne donne pas accès aux espaces internes de l’usine.</p>
      <button className="rounded-lg border px-4 py-3 focus-visible:outline focus-visible:outline-2" onClick={() => void signOut()}>Se déconnecter</button>
    </div>;
  }

  return (
    <AiGuideProvider
      screen={activeTab}
      entityId={searchParams.get("lot")}
      reasonCode={searchParams.get("error")}
      element={searchParams.get("field")}
    >
    <SidebarProvider defaultOpen={window.innerWidth >= 1024}>
      <CommandMenu accessibleTabs={accessibleTabs} onNavigate={handleNavigate} />
      <AppSidebar
        activeTab={deniedTab ? '' : activeTab}
        onTabChange={handleNavigate}
        activeView={receptionView}
        activeAlertsCount={activeAlertsCount}
        accessibleTabs={accessibleTabs}
      />

      <SidebarInset className="flex min-h-screen min-w-0 flex-col bg-shell">

        <TopHeader
          onRefresh={handleRefresh}
          pageTitle={
            deniedTab
              ? APP_TAB_META[deniedTab]?.pageTitle ?? 'Accès réservé'
              : activeTab === 'receptions' && receptionView === 'qc'
              ? 'Contrôle qualité'
              : activeTab === 'home' && homeView === 'fiches'
              ? 'Fiches techniques'
              : activeTab === 'home'
                ? 'Accueil'
                : currentMeta.pageTitle
          }
        />

        {/* Mobile chrome only off-home — Accueil stays calm for operators */}
        {activeTab !== 'home' && (
          <div className="md:hidden">
            <WorkflowNavigation
              activeTab={activeTab}
              onTabChange={handleNavigate}
              primaryTabs={primaryTabs}
              quickTabs={quickTabs}
              metrics={mobileMetrics}
            />
          </div>
        )}

        <div className="min-w-0 flex-1 overflow-x-clip">
          <div className="mx-auto w-full max-w-[1800px] px-3 py-3 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-4 sm:py-5 md:pb-8 lg:px-6 lg:py-6">
            <div key={activeTab} className="animate-page-enter w-full">
              <AppErrorBoundary scoped resetKey={activeTab}>
                {deniedTab ? (
                  <RestrictedScreen title={APP_TAB_META[deniedTab]?.pageTitle} onLeave={() => handleNavigate(preferredDefaultTab)} />
                ) : (
                  <Suspense fallback={<TabLoader />}>
                    {renderContent()}
                  </Suspense>
                )}
              </AppErrorBoundary>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-border/40 px-4 py-2 text-xs text-muted-foreground/50 sm:px-5 lg:px-6">
          <span>
            © {new Date().getFullYear()} {companyName}
          </span>
          <span className="font-medium text-muted-foreground/40">
            {PRODUCT.commercialName} v{PRODUCT.version}
          </span>
        </footer>

      </SidebarInset>
    </SidebarProvider>
    </AiGuideProvider>
  );
};

export default Index;
