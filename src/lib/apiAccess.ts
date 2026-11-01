import type { ActorRole } from '@/types/roles';
import type { AppTab } from './roleAccess';
import contract from './serverAccess.generated.json';

/** Generated from the backend route metadata; never edit a role matrix here.
 * Refresh with UPDATE_ROLE_CONTRACT=1 vitest run scripts/role-contract.test.mjs.
 * The exhaustive contract test rejects stale projections for every existing role.
 */
export const READ_ACCESS = {
  receptions: { route: 'GET /api/receptions' },
  receptionSearch: { route: 'GET /api/receptions/search' },
  receptionAlerts: { route: 'GET /api/reception-alerts' },
  receptionLots: { route: 'GET /api/stock/reception-lots' },
  stockLots: { route: 'GET /api/stock/lots' },
  shipments: { route: 'GET /api/stock/shipments' },
  storageZones: { route: 'GET /api/storage/module3/zones' },
  productionOrders: { route: 'GET /api/production/orders' },
  stageLots: { route: 'GET /api/phase2/available-lots' },
  packagingOrders: { route: 'GET /api/packaging/orders' },
  liveFactory: { route: 'GET /api/analytics/live-factory' },
  healthScore: { route: 'GET /api/analytics/health-score' },
  batchAlerts: { route: 'GET /api/batches/alerts' },
  goldenThread: { route: 'GET /api/trust/golden-thread' },
  suppliers: { route: 'GET /api/suppliers' },
  materials: { route: 'GET /api/materials' },
  customers: { route: 'GET /api/customers' },
  exportOrders: { route: 'GET /api/export-orders' },
  capaTickets: { route: 'GET /api/capa-tickets' },
  requisitions: { route: 'GET /api/purchasing/requisitions' },
  maintenanceRequests: { route: 'GET /api/maintenance/requests' },
  employees: { route: 'GET /api/employees' },
  auditLogs: { route: 'GET /api/notifications/audit' },
  costing: { route: 'GET /api/costing/summary' },
  settlements: { route: 'GET /api/settlements' },
} as const;

export const ACTION_ACCESS = {
  receptionCreate: 'POST /api/receptions/intake',
  receptionCancel: 'POST /api/receptions/:receptionId/cancel',
  receptionQc: 'POST /api/qc/submit',
  storageMove: 'POST /api/reception-lots/:lotId/storage-moves',
  requisitionCreate: 'POST /api/purchasing/requisitions',
  recall: 'POST /api/trust/recall',
} as const;

export type ReadResource = keyof typeof READ_ACCESS;
export type WriteAction = keyof typeof ACTION_ACCESS;
export const canCallRoute = (roles: ActorRole[], route: string) =>
  roles.some(role => (contract as Record<string, string[]>)[route]?.includes(role));
export const canRead = (roles: ActorRole[], resource: ReadResource) => canCallRoute(roles, READ_ACCESS[resource].route);
export const canWrite = (roles: ActorRole[], action: WriteAction) => canCallRoute(roles, ACTION_ACCESS[action]);

/** What a screen cannot open without. Sections beyond this show their own restricted state. */
export const TAB_REQUIRES: Partial<Record<AppTab, ReadResource>> = {
  live: 'liveFactory',
  scan: 'goldenThread',
  alerts: 'batchAlerts',
  receptions: 'receptions',
  storage: 'receptionLots',
  production: 'productionOrders',
  packaging: 'packagingOrders',
  logistics: 'shipments',
  purchasing: 'requisitions',
  quality: 'capaTickets',
  suppliers: 'suppliers',
  materials: 'materials',
  export: 'exportOrders',
  customers: 'customers',
  hr: 'employees',
  maintenance: 'maintenanceRequests',
  analytics: 'healthScore',
  'sage-operations': 'goldenThread',
};

export const tabIsServed = (roles: ActorRole[], tab: AppTab) => {
  const resource = TAB_REQUIRES[tab];
  return !resource || canRead(roles, resource);
};
