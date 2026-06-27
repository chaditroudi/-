import type { SystemNotification } from '@/types/notifications';

const buildTabRoute = (tab: string) => `/?tab=${tab}`;

const entityRouteMap: Record<string, string> = {
  reception: buildTabRoute('receptions'),
  receptions: buildTabRoute('receptions'),
  receptions_v2: buildTabRoute('receptions'),
  supplier: buildTabRoute('suppliers'),
  suppliers: buildTabRoute('suppliers'),
  material: buildTabRoute('materials'),
  materials: buildTabRoute('materials'),
  batch: buildTabRoute('batches'),
  batches: buildTabRoute('batches'),
  stock: buildTabRoute('stock-dashboard'),
  stock_lot: buildTabRoute('storage'),
  storage: buildTabRoute('storage'),
  storage_location: buildTabRoute('storage'),
  storage_zone: buildTabRoute('storage'),
  production: buildTabRoute('production'),
  packaging: buildTabRoute('packaging'),
  packaging_order: buildTabRoute('packaging'),
  purchasing: buildTabRoute('purchasing'),
  purchase_order: buildTabRoute('purchasing'),
  logistics: buildTabRoute('logistics'),
  transport: buildTabRoute('logistics'),
  task: buildTabRoute('home'),
  timesheet: buildTabRoute('home'),
};

const categoryRouteMap: Record<string, string> = {
  qualite: buildTabRoute('alerts'),
  quality: buildTabRoute('alerts'),
  reception: buildTabRoute('receptions'),
  receptions: buildTabRoute('receptions'),
  production: buildTabRoute('production'),
  packaging: buildTabRoute('packaging'),
  stockage: buildTabRoute('storage'),
  stock: buildTabRoute('stock-dashboard'),
  logistics: buildTabRoute('logistics'),
  purchasing: buildTabRoute('purchasing'),
  fournisseurs: buildTabRoute('suppliers'),
  suppliers: buildTabRoute('suppliers'),
  system: buildTabRoute('alerts'),
};

// Human-readable labels for each tab destination
const TAB_LABELS: Record<string, string> = {
  receptions: 'Réceptions',
  suppliers: 'Fournisseurs',
  materials: 'Matériaux',
  batches: 'Lots Qualité',
  'stock-dashboard': 'Tableau de bord Stock',
  storage: 'Entrepôt & Stock',
  production: 'Production',
  packaging: 'Conditionnement',
  purchasing: 'Achats',
  logistics: 'Logistique',
  home: 'Accueil',
  alerts: 'Alertes',
};

// Metadata keys to hide in detail display (internal / not user-facing)
export const SKIP_META_KEYS = new Set(['alert_key', 'alert_id']);

// User-friendly labels for known metadata keys
const META_KEY_LABELS: Record<string, string> = {
  batch_id: 'ID Lot',
  lot_id: 'ID Lot',
  batch_number: 'N° Lot',
  lot_number: 'N° Lot',
  supplier_id: 'ID Fournisseur',
  supplier_name: 'Fournisseur',
  dlc_alert_level: 'Niveau DLC',
  storage_zone_id: 'Zone de stockage',
  storage_location_id: 'Emplacement',
  alert_type: "Type d'alerte",
  rejection_reason: 'Motif de rejet',
  quarantine_reason: 'Motif de quarantaine',
  score: 'Score qualité',
  phase: 'Phase',
  cycle_id: 'ID Cycle',
  reception_id: 'ID Réception',
  packaging_order_id: 'ID Commande cond.',
  triage_session_id: 'ID Session triage',
  fumigation_cycle_id: 'ID Cycle fumigation',
  cleaning_cycle_id: 'ID Cycle nettoyage',
  hydration_cycle_id: 'ID Cycle hydratation',
};

export const getNotificationTarget = (notification: SystemNotification): string => {
  if (notification.action_url) {
    return notification.action_url;
  }

  const entityType = notification.entity_type?.toLowerCase().trim();
  const category = notification.category?.toLowerCase().trim();

  // For error/warning, prefer entity-specific route before generic alerts tab
  if (notification.severity === 'error' || notification.severity === 'warning') {
    if (entityType && entityRouteMap[entityType]) return entityRouteMap[entityType];
    if (category && categoryRouteMap[category]) return categoryRouteMap[category];
    return buildTabRoute('alerts');
  }

  if (entityType && entityRouteMap[entityType]) {
    return entityRouteMap[entityType];
  }

  if (category && categoryRouteMap[category]) {
    return categoryRouteMap[category];
  }

  return buildTabRoute('alerts');
};

/** Returns the human-readable module name for a tab route, e.g. "Lots Qualité" */
export const getTabLabel = (target: string): string => {
  try {
    const search = target.includes('?') ? target.slice(target.indexOf('?')) : '';
    const tab = new URLSearchParams(search).get('tab') ?? '';
    return TAB_LABELS[tab] ?? 'Module';
  } catch {
    return 'Module';
  }
};

/** Returns a human-readable label for a notification metadata key */
export const formatMetaKey = (key: string): string =>
  META_KEY_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const getNotificationFingerprint = (notification: SystemNotification) =>
  [
    notification.notification_type,
    notification.entity_type ?? '',
    notification.entity_id ?? '',
    notification.severity,
    notification.title.trim().toLowerCase(),
  ].join('|');

export const isAlertsExperience = (pathname: string, search: string) => {
  if (pathname === '/alerts') {
    return true;
  }

  return new URLSearchParams(search).get('tab') === 'alerts';
};

export const isInternalNotificationTarget = (target: string) =>
  target.startsWith('/') && !target.startsWith('//');
