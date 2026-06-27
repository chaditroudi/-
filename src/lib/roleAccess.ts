import type { ActorRole } from '@/types/roles';

export type AppTab =
  | 'home'
  | 'live'
  | 'scan'
  | 'receptions'
  | 'batches'
  | 'storage'
  | 'production'
  | 'packaging'
  | 'logistics'
  | 'purchasing'
  | 'analytics'
  | 'alerts'
  | 'suppliers'
  | 'materials'
  | 'quality'
  | 'hr'
  | 'stock-dashboard'
  | 'stock-lots'
  | 'stock-products'
  | 'stock-movements'
  | 'sage-operations'
  | 'export'
  | 'customers'
  | 'settings';

export type RoleAction =
  | 'executive_dashboard'
  | 'production_supervision'
  | 'quality_supervision'
  | 'qc_entry_scan'
  | 'reception_weighing'
  | 'reception_data_entry'
  | 'qr_label_printing'
  | 'line_cleaning_monitoring'
  | 'fumigation_monitoring'
  | 'sorting_override'
  | 'conditioning_execution'
  | 'packaging_execution'
  | 'warehouse_operations'
  | 'shipping_planning'
  | 'purchasing_management'
  | 'maintenance_management'
  | 'maintenance_interventions'
  | 'user_permissions_admin'
  | 'supplier_portal_access'
  | 'client_portal_access'
  | 'audit_readonly_access';

export interface RoleWorkspaceProfile {
  role: ActorRole;
  interfaceLabel: string;
  workspaceLabel: string;
  defaultTab: AppTab;
  primaryTabs: AppTab[];
  quickTabs: AppTab[];
  actions: RoleAction[];
}

const ALL_APP_TABS: AppTab[] = [
  'home',
  'receptions',
  'batches',
  'storage',
  'production',
  'packaging',
  'logistics',
  'purchasing',
  'analytics',
  'alerts',
  'suppliers',
  'materials',
  'quality',
  'hr',
  'stock-dashboard',
  'stock-lots',
  'stock-products',
  'stock-movements',
  'sage-operations',
  'export',
  'customers',
  'settings',
];

const ALL_ROLE_ACTIONS: RoleAction[] = [
  'executive_dashboard',
  'production_supervision',
  'quality_supervision',
  'qc_entry_scan',
  'reception_weighing',
  'reception_data_entry',
  'qr_label_printing',
  'line_cleaning_monitoring',
  'fumigation_monitoring',
  'sorting_override',
  'conditioning_execution',
  'packaging_execution',
  'warehouse_operations',
  'shipping_planning',
  'purchasing_management',
  'maintenance_management',
  'maintenance_interventions',
  'user_permissions_admin',
  'supplier_portal_access',
  'client_portal_access',
  'audit_readonly_access',
];

const ROLE_WORKSPACES: Record<ActorRole, RoleWorkspaceProfile> = {
  directeur_usine: {
    role: 'directeur_usine',
    interfaceLabel: 'Dashboard exécutif web',
    workspaceLabel: 'Pilotage global usine',
    defaultTab: 'home',
    primaryTabs: ['home', 'production', 'packaging', 'receptions', 'storage', 'alerts', 'analytics', 'export', 'customers', 'sage-operations'],
    quickTabs: ['quality', 'suppliers', 'purchasing', 'logistics', 'hr', 'settings'],
    actions: ['executive_dashboard', 'production_supervision', 'quality_supervision', 'shipping_planning', 'purchasing_management'],
  },
  directeur_general: {
    role: 'directeur_general',
    interfaceLabel: 'Dashboard exécutif web',
    workspaceLabel: 'Direction et arbitrage',
    defaultTab: 'home',
    primaryTabs: ['home', 'analytics', 'alerts', 'export', 'sage-operations', 'production', 'packaging', 'receptions'],
    quickTabs: ['quality', 'purchasing', 'logistics', 'suppliers', 'storage', 'hr', 'settings'],
    actions: ['executive_dashboard', 'production_supervision', 'quality_supervision', 'shipping_planning', 'purchasing_management', 'user_permissions_admin'],
  },
  responsable_production: {
    role: 'responsable_production',
    interfaceLabel: 'Dashboard production web',
    workspaceLabel: 'Supervision production',
    defaultTab: 'production',
    primaryTabs: ['production', 'packaging', 'storage', 'alerts', 'batches', 'home'],
    quickTabs: ['sage-operations', 'analytics', 'hr'],
    actions: ['production_supervision'],
  },
  responsable_qualite: {
    role: 'responsable_qualite',
    interfaceLabel: 'Dashboard qualité web',
    workspaceLabel: 'Pilotage qualité',
    defaultTab: 'batches',
    primaryTabs: ['batches', 'quality', 'receptions', 'alerts', 'storage', 'home'],
    quickTabs: ['sage-operations', 'analytics', 'hr'],
    actions: ['quality_supervision', 'qc_entry_scan', 'production_supervision'],
  },
  inspecteur_qualite: {
    role: 'inspecteur_qualite',
    interfaceLabel: 'Tablette terrain',
    workspaceLabel: 'Inspection qualité terrain',
    defaultTab: 'batches',
    primaryTabs: ['batches', 'receptions', 'alerts'],
    quickTabs: ['home', 'storage'],
    actions: ['qc_entry_scan'],
  },
  chef_reception: {
    role: 'chef_reception',
    interfaceLabel: 'Tablette + PC réception',
    workspaceLabel: 'Supervision réception',
    defaultTab: 'receptions',
    primaryTabs: ['receptions', 'storage', 'alerts', 'home'],
    quickTabs: ['sage-operations', 'hr'],
    actions: ['reception_weighing', 'reception_data_entry', 'qr_label_printing', 'qc_entry_scan'],
  },
  operateur_reception: {
    role: 'operateur_reception',
    interfaceLabel: 'Tablette terrain',
    workspaceLabel: 'Saisie réception',
    defaultTab: 'receptions',
    primaryTabs: ['receptions', 'alerts'],
    quickTabs: ['home'],
    actions: ['reception_data_entry', 'reception_weighing', 'qr_label_printing'],
  },
  operateur_nettoyage: {
    role: 'operateur_nettoyage',
    interfaceLabel: 'Terminal tactile ligne',
    workspaceLabel: 'Nettoyage ligne',
    defaultTab: 'production',
    primaryTabs: ['production', 'alerts'],
    quickTabs: ['home'],
    actions: ['line_cleaning_monitoring'],
  },
  operateur_fumigation: {
    role: 'operateur_fumigation',
    interfaceLabel: 'Poste de contrôle dédié',
    workspaceLabel: 'Suivi fumigation',
    defaultTab: 'production',
    primaryTabs: ['production', 'alerts'],
    quickTabs: ['home'],
    actions: ['fumigation_monitoring'],
  },
  operateur_triage_ia: {
    role: 'operateur_triage_ia',
    interfaceLabel: 'Écran grand format + tablette',
    workspaceLabel: 'Triage IA',
    defaultTab: 'production',
    primaryTabs: ['production', 'alerts', 'batches'],
    quickTabs: ['home'],
    actions: ['sorting_override'],
  },
  operateur_conditionnement: {
    role: 'operateur_conditionnement',
    interfaceLabel: 'Terminal tactile ligne',
    workspaceLabel: 'Conditionnement',
    defaultTab: 'packaging',
    primaryTabs: ['packaging', 'alerts'],
    quickTabs: ['home'],
    actions: ['conditioning_execution'],
  },
  operateur_emballage: {
    role: 'operateur_emballage',
    interfaceLabel: 'Terminal tactile ligne',
    workspaceLabel: 'Emballage',
    defaultTab: 'packaging',
    primaryTabs: ['packaging', 'alerts'],
    quickTabs: ['home'],
    actions: ['packaging_execution'],
  },
  magasinier_wms: {
    role: 'magasinier_wms',
    interfaceLabel: 'Lecteur mobile RF',
    workspaceLabel: 'Opérations magasin',
    defaultTab: 'storage',
    primaryTabs: ['storage', 'alerts'],
    quickTabs: ['home'],
    actions: ['warehouse_operations'],
  },
  responsable_logistique: {
    role: 'responsable_logistique',
    interfaceLabel: 'PC bureau',
    workspaceLabel: 'Pilotage logistique',
    defaultTab: 'logistics',
    primaryTabs: ['logistics', 'export', 'storage', 'alerts', 'home'],
    quickTabs: ['analytics', 'hr'],
    actions: ['shipping_planning'],
  },
  responsable_achats: {
    role: 'responsable_achats',
    interfaceLabel: 'PC bureau',
    workspaceLabel: 'Achats et fournisseurs',
    defaultTab: 'purchasing',
    primaryTabs: ['purchasing', 'suppliers', 'materials', 'alerts', 'home'],
    quickTabs: ['analytics', 'hr'],
    actions: ['purchasing_management'],
  },
  responsable_maintenance: {
    role: 'responsable_maintenance',
    interfaceLabel: 'Application mobile',
    workspaceLabel: 'Supervision maintenance',
    defaultTab: 'alerts',
    primaryTabs: ['alerts', 'home'],
    quickTabs: ['production', 'hr'],
    actions: ['maintenance_management'],
  },
  technicien_maintenance: {
    role: 'technicien_maintenance',
    interfaceLabel: 'Tablette terrain',
    workspaceLabel: 'Interventions maintenance',
    defaultTab: 'alerts',
    primaryTabs: ['alerts', 'home'],
    quickTabs: ['production'],
    actions: ['maintenance_interventions'],
  },
  administrateur_systeme: {
    role: 'administrateur_systeme',
    interfaceLabel: 'Console admin web',
    workspaceLabel: 'Administration système globale',
    defaultTab: 'home',
    primaryTabs: ALL_APP_TABS,
    quickTabs: ['receptions', 'suppliers', 'purchasing', 'storage', 'production', 'logistics'],
    actions: ALL_ROLE_ACTIONS,
  },
  fournisseur_externe: {
    role: 'fournisseur_externe',
    interfaceLabel: 'Portail fournisseur web',
    workspaceLabel: 'Espace fournisseur',
    defaultTab: 'suppliers',
    primaryTabs: ['suppliers'],
    quickTabs: [],
    actions: ['supplier_portal_access'],
  },
  client_externe: {
    role: 'client_externe',
    interfaceLabel: 'Portail client web',
    workspaceLabel: 'Espace client',
    defaultTab: 'logistics',
    primaryTabs: ['logistics'],
    quickTabs: [],
    actions: ['client_portal_access'],
  },
  auditeur_externe: {
    role: 'auditeur_externe',
    interfaceLabel: 'Portail audit limité',
    workspaceLabel: 'Lecture audit',
    defaultTab: 'quality',
    primaryTabs: ['quality', 'alerts', 'receptions', 'batches'],
    quickTabs: [],
    actions: ['audit_readonly_access'],
  },
  technico_commercial: {
    role: 'technico_commercial',
    interfaceLabel: 'PC bureau',
    workspaceLabel: 'Commercial',
    defaultTab: 'export',
    primaryTabs: ['export', 'purchasing', 'logistics', 'home'],
    quickTabs: ['analytics', 'batches'],
    actions: ['purchasing_management', 'shipping_planning'],
  },
  directeur_achat: {
    role: 'directeur_achat',
    interfaceLabel: 'PC bureau',
    workspaceLabel: 'Direction achats',
    defaultTab: 'purchasing',
    primaryTabs: ['purchasing', 'suppliers', 'analytics', 'home'],
    quickTabs: ['materials', 'hr'],
    actions: ['purchasing_management'],
  },
  resp_management_qualite: {
    role: 'resp_management_qualite',
    interfaceLabel: 'Dashboard qualité web',
    workspaceLabel: 'Management qualité',
    defaultTab: 'batches',
    primaryTabs: ['batches', 'quality', 'receptions', 'alerts', 'home'],
    quickTabs: ['analytics', 'storage', 'hr'],
    actions: ['quality_supervision', 'qc_entry_scan'],
  },
  resp_qualite_haccp: {
    role: 'resp_qualite_haccp',
    interfaceLabel: 'Dashboard qualité web',
    workspaceLabel: 'Qualité HACCP',
    defaultTab: 'batches',
    primaryTabs: ['batches', 'quality', 'alerts', 'receptions', 'home'],
    quickTabs: ['analytics', 'hr'],
    actions: ['quality_supervision', 'qc_entry_scan'],
  },
  responsable_reception: {
    role: 'responsable_reception',
    interfaceLabel: 'Tablette + PC réception',
    workspaceLabel: 'Responsable réception',
    defaultTab: 'receptions',
    primaryTabs: ['receptions', 'storage', 'alerts', 'home'],
    quickTabs: ['hr'],
    actions: ['reception_weighing', 'reception_data_entry', 'qr_label_printing', 'qc_entry_scan'],
  },
  responsable_stock: {
    role: 'responsable_stock',
    interfaceLabel: 'Lecteur mobile RF',
    workspaceLabel: 'Responsable stock',
    defaultTab: 'storage',
    primaryTabs: ['storage', 'alerts', 'purchasing', 'home'],
    quickTabs: ['hr'],
    actions: ['warehouse_operations'],
  },
  partenaire_client_export: {
    role: 'partenaire_client_export',
    interfaceLabel: 'Portail client web',
    workspaceLabel: 'Client export',
    defaultTab: 'logistics',
    primaryTabs: ['logistics'],
    quickTabs: [],
    actions: ['client_portal_access'],
  },
};

const unique = <T,>(items: T[]) => Array.from(new Set(items));

export const getRoleWorkspaceProfile = (roles: ActorRole[]) => {
  const profiles = roles
    .map((role) => ROLE_WORKSPACES[role])
    .filter(Boolean);

  if (profiles.length === 0) {
    return {
      interfaceLabel: 'Interface web',
      workspaceLabel: 'Opérations',
      defaultTab: 'home' as AppTab,
      primaryTabs: ['home', 'receptions', 'production', 'alerts'] as AppTab[],
      quickTabs: ['stock-dashboard', 'sage-operations'] as AppTab[],
      actions: [] as RoleAction[],
    };
  }

  return {
    interfaceLabel: profiles[0].interfaceLabel,
    workspaceLabel: profiles[0].workspaceLabel,
    defaultTab: profiles[0].defaultTab,
    primaryTabs: unique(profiles.flatMap((profile) => profile.primaryTabs)),
    quickTabs: unique(profiles.flatMap((profile) => profile.quickTabs)),
    actions: unique(profiles.flatMap((profile) => profile.actions)),
  };
};

export const getAccessibleTabs = (roles: ActorRole[]) => {
  const profile = getRoleWorkspaceProfile(roles);
  return unique<AppTab>([...profile.primaryTabs, ...profile.quickTabs, 'home', 'live', 'scan']);
};

export const canAccessTab = (roles: ActorRole[], tab: AppTab) => {
  const profile = getRoleWorkspaceProfile(roles);
  return profile.primaryTabs.includes(tab) || profile.quickTabs.includes(tab) || tab === 'home' || tab === 'live' || tab === 'scan';
};

export const canPerformAction = (roles: ActorRole[], action: RoleAction) => {
  const profile = getRoleWorkspaceProfile(roles);
  return profile.actions.includes(action);
};
