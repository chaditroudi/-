import type { ActorRole } from '@/types/roles';
import type { AppTab } from './roleAccess';

/**
 * Which roles the server lets read what. The server decides; this only stops the client
 * offering, or asking for, what it will be refused. `scripts/role-contract.test.mjs`
 * compares every entry with the live route table, so the two cannot drift apart.
 */

const FULL_ACCESS: ActorRole[] = ['administrateur_systeme', 'directeur_general', 'directeur_usine'];

const RECEPTION: ActorRole[] = [
  'chef_reception', 'inspecteur_qualite', 'magasinier_wms', 'operateur_reception',
  'responsable_qualite', 'responsable_reception', 'responsable_stock',
];

const STOCK: ActorRole[] = [
  'chef_reception', 'magasinier_wms', 'responsable_logistique', 'responsable_qualite',
  'responsable_reception', 'responsable_stock',
];

const STORAGE: ActorRole[] = [
  'chef_reception', 'magasinier_wms', 'operateur_reception', 'responsable_logistique',
  'responsable_maintenance', 'responsable_reception', 'responsable_stock', 'technicien_maintenance',
];

const STAGES: ActorRole[] = [
  'inspecteur_qualite', 'magasinier_wms', 'operateur_conditionnement', 'operateur_emballage',
  'operateur_fumigation', 'operateur_nettoyage', 'operateur_triage_ia', 'resp_management_qualite',
  'resp_qualite_haccp', 'responsable_production', 'responsable_qualite', 'responsable_stock',
];

const PACKAGING: ActorRole[] = [
  'operateur_conditionnement', 'operateur_emballage', 'resp_qualite_haccp', 'responsable_production',
  'responsable_qualite', 'responsable_stock',
];

const ANALYTICS: ActorRole[] = [
  'chef_reception', 'directeur_achat', 'resp_management_qualite', 'resp_qualite_haccp',
  'responsable_achats', 'responsable_logistique', 'responsable_production', 'responsable_qualite',
  'responsable_reception', 'responsable_stock', 'technico_commercial',
];

const STAFF: ActorRole[] = [
  ...new Set<ActorRole>([
    ...RECEPTION, ...STOCK, ...STAGES,
    'auditeur_externe', 'directeur_achat', 'responsable_achats', 'responsable_maintenance',
    'technicien_maintenance', 'technico_commercial',
  ]),
];

const PURCHASING: ActorRole[] = [
  'chef_reception', 'directeur_achat', 'magasinier_wms', 'responsable_achats', 'responsable_logistique',
  'responsable_maintenance', 'responsable_production', 'responsable_qualite', 'responsable_reception',
  'responsable_stock',
];

const MAINTENANCE: ActorRole[] = [
  'chef_reception', 'magasinier_wms', 'responsable_achats', 'responsable_logistique',
  'responsable_maintenance', 'responsable_production', 'responsable_qualite', 'responsable_reception',
  'responsable_stock', 'technicien_maintenance',
];

const EMPLOYEES: ActorRole[] = [
  'chef_reception', 'directeur_achat', 'resp_management_qualite', 'resp_qualite_haccp',
  'responsable_achats', 'responsable_logistique', 'responsable_maintenance', 'responsable_production',
  'responsable_qualite', 'responsable_reception', 'responsable_stock',
];

export const READ_ACCESS = {
  receptions: { route: 'GET /api/receptions', roles: RECEPTION },
  receptionSearch: { route: 'GET /api/receptions/search', roles: RECEPTION },
  receptionAlerts: { route: 'GET /api/reception-alerts', roles: RECEPTION },
  receptionLots: { route: 'GET /api/stock/reception-lots', roles: STOCK },
  stockLots: { route: 'GET /api/stock/lots', roles: STOCK },
  shipments: { route: 'GET /api/stock/shipments', roles: STOCK },
  storageZones: { route: 'GET /api/storage/module3/zones', roles: STORAGE },
  productionOrders: { route: 'GET /api/production/orders', roles: STAFF },
  stageLots: { route: 'GET /api/phase2/available-lots', roles: STAGES },
  packagingOrders: { route: 'GET /api/packaging/orders', roles: PACKAGING },
  liveFactory: { route: 'GET /api/analytics/live-factory', roles: ANALYTICS },
  healthScore: { route: 'GET /api/analytics/health-score', roles: ANALYTICS },
  batchAlerts: { route: 'GET /api/batches/alerts', roles: STAFF },
  goldenThread: { route: 'GET /api/trust/golden-thread', roles: STAFF },
  suppliers: { route: 'GET /api/suppliers', roles: [...STAFF, 'fournisseur_externe'] as ActorRole[] },
  materials: { route: 'GET /api/materials', roles: STAFF },
  customers: { route: 'GET /api/customers', roles: STAFF },
  exportOrders: { route: 'GET /api/export-orders', roles: STAFF },
  capaTickets: { route: 'GET /api/capa-tickets', roles: STAFF },
  requisitions: { route: 'GET /api/purchasing/requisitions', roles: PURCHASING },
  maintenanceRequests: { route: 'GET /api/maintenance/requests', roles: MAINTENANCE },
  employees: { route: 'GET /api/employees', roles: EMPLOYEES },
} satisfies Record<string, { route: string; roles: ActorRole[] }>;

export type ReadResource = keyof typeof READ_ACCESS;

export const canRead = (roles: ActorRole[], resource: ReadResource) =>
  roles.some((role) => FULL_ACCESS.includes(role) || READ_ACCESS[resource].roles.includes(role));

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
