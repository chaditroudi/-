export type ActorRole =
  | 'directeur_general'
  | 'directeur_usine'
  | 'responsable_production'
  | 'responsable_qualite'
  | 'inspecteur_qualite'
  | 'chef_reception'
  | 'operateur_reception'
  | 'operateur_nettoyage'
  | 'operateur_fumigation'
  | 'operateur_triage_ia'
  | 'operateur_conditionnement'
  | 'operateur_emballage'
  | 'magasinier_wms'
  | 'responsable_logistique'
  | 'responsable_achats'
  | 'responsable_maintenance'
  | 'technicien_maintenance'
  | 'administrateur_systeme'
  | 'fournisseur_externe'
  | 'client_externe'
  | 'auditeur_externe'
  | 'technico_commercial'
  | 'directeur_achat'
  | 'resp_management_qualite'
  | 'resp_qualite_haccp'
  | 'responsable_reception'
  | 'responsable_stock'
  | 'partenaire_client_export';

export type EmploymentStatus = 'active' | 'inactive' | 'on_leave' | 'terminated';

export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface RoleInfo {
  value: ActorRole;
  label: string;
  description: string;
  department: string;
  permissions: string[];
}

export const ROLE_CONFIG: Record<ActorRole, RoleInfo> = {
  directeur_general: {
    value: 'directeur_general',
    label: 'Directeur Général',
    description: 'Accès global à tous les modules, indicateurs et validations stratégiques.',
    department: 'Direction',
    permissions: ['all_modules', 'executive_dashboard', 'strategic_approvals'],
  },
  directeur_usine: {
    value: 'directeur_usine',
    label: 'Directeur Usine',
    description: 'Pilotage complet de la chaîne usine, de la réception à l’expédition.',
    department: 'Direction Usine',
    permissions: ['all_factory_modules', 'kpi_all', 'approvals_factory'],
  },
  responsable_production: {
    value: 'responsable_production',
    label: 'Responsable Production',
    description: 'Supervision des étapes de production, OEE, planning et équipes.',
    department: 'Production',
    permissions: ['production_modules', 'oee_dashboard', 'shift_planning'],
  },
  responsable_qualite: {
    value: 'responsable_qualite',
    label: 'Responsable Qualité',
    description: 'Pilotage qualité, HACCP, CCP, audits, CAPA et conformité.',
    department: 'Qualité',
    permissions: ['quality_modules', 'haccp', 'ccp_monitoring', 'audits', 'capa'],
  },
  inspecteur_qualite: {
    value: 'inspecteur_qualite',
    label: 'Inspecteur Qualité',
    description: 'Inspection qualité terrain, contrôles d’entrée et validations QC.',
    department: 'Qualité',
    permissions: ['qc_entry', 'line_quality_checks', 'ccp_read'],
  },
  chef_reception: {
    value: 'chef_reception',
    label: 'Chef de Réception',
    description: 'Supervision de la réception, pesée, LOT-ID et affectation des zones.',
    department: 'Réception',
    permissions: ['reception_all', 'weighbridge', 'lot_id', 'zone_assignment'],
  },
  operateur_reception: {
    value: 'operateur_reception',
    label: 'Opérateur Réception',
    description: 'Saisie des réceptions, pesée et impression QR/RFID sur tablette.',
    department: 'Réception',
    permissions: ['reception_entry', 'weighbridge', 'label_printing'],
  },
  operateur_nettoyage: {
    value: 'operateur_nettoyage',
    label: 'Opérateur Nettoyage',
    description: 'Suivi nettoyage, scan lots, monitoring eau et pesée sortie.',
    department: 'Production',
    permissions: ['cleaning_stage', 'lot_scan', 'water_monitoring'],
  },
  operateur_fumigation: {
    value: 'operateur_fumigation',
    label: 'Opérateur Fumigation',
    description: 'Pilotage des chambres de fumigation sous contrôle qualité.',
    department: 'Production',
    permissions: ['fumigation_stage', 'ccp1_execution', 'gas_monitoring'],
  },
  operateur_triage_ia: {
    value: 'operateur_triage_ia',
    label: 'Opérateur Triage IA',
    description: 'Suivi des lignes IA, statistiques et corrections terrain.',
    department: 'Production',
    permissions: ['ai_sorting', 'line_monitoring', 'sorting_stats'],
  },
  operateur_conditionnement: {
    value: 'operateur_conditionnement',
    label: 'Opérateur Conditionnement',
    description: 'Recettes, pesée ingrédients et suivi batch de valorisation.',
    department: 'Production',
    permissions: ['conditioning_stage', 'recipe_execution', 'ingredient_tracking'],
  },
  operateur_emballage: {
    value: 'operateur_emballage',
    label: 'Opérateur Emballage',
    description: 'Formats, étiquetage, checkweigher et détection métaux.',
    department: 'Production',
    permissions: ['packaging_stage', 'checkweigher', 'metal_detection'],
  },
  magasinier_wms: {
    value: 'magasinier_wms',
    label: 'Magasinier / WMS',
    description: 'Entreposage, inventaire, mouvements, picking et scan emplacements.',
    department: 'Magasin',
    permissions: ['warehouse', 'inventory', 'picking', 'stock_movements'],
  },
  responsable_logistique: {
    value: 'responsable_logistique',
    label: 'Responsable Logistique',
    description: 'Expédition, plan de chargement, documentation export et staging.',
    department: 'Logistique',
    permissions: ['shipping', 'export_docs', 'loading_plan', 'cold_chain'],
  },
  responsable_achats: {
    value: 'responsable_achats',
    label: 'Responsable Achats',
    description: 'Commandes d’achat, fournisseurs, contrats, prix et approvisionnements.',
    department: 'Achats',
    permissions: ['purchasing', 'suppliers', 'contracts', 'pricing'],
  },
  responsable_maintenance: {
    value: 'responsable_maintenance',
    label: 'Responsable Maintenance',
    description: 'Supervision maintenance, préventif, équipements et pièces.',
    department: 'Maintenance',
    permissions: ['maintenance', 'equipment', 'preventive_maintenance'],
  },
  technicien_maintenance: {
    value: 'technicien_maintenance',
    label: 'Technicien Maintenance',
    description: 'Interventions terrain, historique machines et ordres de travail.',
    department: 'Maintenance',
    permissions: ['maintenance_workorders', 'equipment_read', 'interventions'],
  },
  administrateur_systeme: {
    value: 'administrateur_systeme',
    label: 'Administrateur Système',
    description: 'Configuration, sécurité, utilisateurs, intégrations et administration technique.',
    department: 'IT',
    permissions: ['all_modules', 'manage_users', 'manage_system', 'integrations'],
  },
  fournisseur_externe: {
    value: 'fournisseur_externe',
    label: 'Fournisseur Externe',
    description: 'Portail fournisseur: livraisons, commandes, score et paiements propres.',
    department: 'Portail Externe',
    permissions: ['supplier_portal'],
  },
  client_externe: {
    value: 'client_externe',
    label: 'Client Externe',
    description: 'Portail client: commandes, traçabilité des lots, certificats et suivi.',
    department: 'Portail Externe',
    permissions: ['client_portal'],
  },
  auditeur_externe: {
    value: 'auditeur_externe',
    label: 'Auditeur Externe',
    description: 'Lecture seule limitée sur traçabilité, HACCP, CCP et conformité.',
    department: 'Audit',
    permissions: ['audit_readonly'],
  },
  technico_commercial: {
    value: 'technico_commercial',
    label: 'Technico Commercial',
    description: 'Rôle historique conservé pour compatibilité.',
    department: 'Commercial',
    permissions: ['sales_legacy'],
  },
  directeur_achat: {
    value: 'directeur_achat',
    label: 'Directeur Achat',
    description: 'Rôle historique conservé pour compatibilité.',
    department: 'Achats',
    permissions: ['purchasing_legacy'],
  },
  resp_management_qualite: {
    value: 'resp_management_qualite',
    label: 'Resp. Management Qualité',
    description: 'Rôle historique conservé pour compatibilité.',
    department: 'Qualité',
    permissions: ['quality_legacy'],
  },
  resp_qualite_haccp: {
    value: 'resp_qualite_haccp',
    label: 'Resp. Qualité HACCP',
    description: 'Rôle historique conservé pour compatibilité.',
    department: 'Qualité',
    permissions: ['haccp_legacy'],
  },
  responsable_reception: {
    value: 'responsable_reception',
    label: 'Responsable Réception',
    description: 'Rôle historique conservé pour compatibilité.',
    department: 'Réception',
    permissions: ['reception_legacy'],
  },
  responsable_stock: {
    value: 'responsable_stock',
    label: 'Responsable Stock',
    description: 'Rôle historique conservé pour compatibilité.',
    department: 'Magasin',
    permissions: ['stock_legacy'],
  },
  partenaire_client_export: {
    value: 'partenaire_client_export',
    label: 'Partenaire Client Export',
    description: 'Rôle historique conservé pour compatibilité.',
    department: 'Portail Externe',
    permissions: ['client_portal_legacy'],
  },
};

export const ADMIN_ROLES: ActorRole[] = [
  'directeur_general',
  'directeur_usine',
  'administrateur_systeme',
];

export const MANAGER_ROLES: ActorRole[] = [
  'responsable_production',
  'responsable_qualite',
  'chef_reception',
  'responsable_logistique',
  'responsable_achats',
  'responsable_maintenance',
  'responsable_reception',
  'responsable_stock',
  'resp_management_qualite',
];

export interface Employee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: ActorRole;
  department: string | null;
  hire_date: string;
  termination_date: string | null;
  status: EmploymentStatus;
  hourly_rate: number | null;
  supervisor_id: string | null;
  user_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type TimesheetOperationModule =
  | 'GENERAL'
  | 'FUMIGATION'
  | 'NETTOYAGE'
  | 'HYDRATATION'
  | 'TRIAGE'
  | 'CONDITIONNEMENT';

export interface Timesheet {
  id: string;
  employee_id: string;
  work_date: string;
  start_time: string;
  end_time: string | null;
  break_minutes: number;
  hours_worked: number | null;
  task_description: string | null;
  project_reference: string | null;
  operation_module: TimesheetOperationModule | null;
  operation_id: string | null;
  status: TimesheetStatus;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: ActorRole;
  assigned_at: string;
  assigned_by: string | null;
}
