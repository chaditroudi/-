import type { SystemNotification } from '@/types/notifications';

const buildTabRoute = (tab: string) => `/?tab=${tab}`;

const entityRouteMap: Record<string, string> = {
  reception: buildTabRoute('receptions'),
  receptions: buildTabRoute('receptions'),
  supplier: buildTabRoute('suppliers'),
  suppliers: buildTabRoute('suppliers'),
  material: buildTabRoute('materials'),
  materials: buildTabRoute('materials'),
  batch: buildTabRoute('batches'),
  batches: buildTabRoute('batches'),
  stock: buildTabRoute('stock-dashboard'),
  storage: buildTabRoute('storage'),
  production: buildTabRoute('production'),
  packaging: buildTabRoute('packaging'),
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

export const getNotificationTarget = (notification: SystemNotification): string => {
  if (notification.action_url) {
    return notification.action_url;
  }

  const entityType = notification.entity_type?.toLowerCase().trim();
  const category = notification.category?.toLowerCase().trim();

  if (notification.severity === 'error' || notification.severity === 'warning') {
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
