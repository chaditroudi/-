export type ReceptionStatus = 'pending' | 'in_progress' | 'verified' | 'accepted' | 'rejected' | 'quarantine';

export type ComplianceStatus = 'compliant' | 'non_compliant' | 'critical';

export type QCDecision = 'accepted' | 'rejected' | 'quarantine';

import type { SupplierCertification, SupplierStatus } from '@/lib/royalPalmPhase1';

export type SupplierIdentificationStatus = 'unverified' | 'verified' | 'expired' | 'rejected';
export type SupplierQualificationStatus = 'prospect' | 'qualified' | 'approved' | 'suspended' | 'blacklisted';
export type SupplierComplianceStatus = 'compliant' | 'warning' | 'non_compliant';
export type SupplierRiskLevel = 'low' | 'medium' | 'high';
export type SupplierContractStatus = 'draft' | 'active' | 'expired' | 'terminated' | 'under_review';

export interface SupplierContractRecord {
  id?: string;
  reference: string | null;
  type: 'annuel' | 'saisonnier' | 'ponctuel' | 'achat_sur_pied';
  status: SupplierContractStatus;
  start_date: string | null;
  end_date: string | null;
  expiry_alert_at?: string | null;
  document_url: string | null;
  compliance_status: SupplierComplianceStatus;
  reviewed_at?: string | null;
  notes?: string | null;
}

export interface SupplierPerformanceSnapshot {
  at: string;
  by: string;
  quality_score: number | null;
  delivery_reliability_score: number | null;
  traceability_score: number | null;
  rejection_rate: number | null;
  delivered_lots_count: number | null;
  total_delivered_tons: number | null;
  qualification_status: SupplierQualificationStatus | null;
  supplier_status: SupplierStatus | null;
  compliance_status: SupplierComplianceStatus | null;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string;
  is_active: boolean;
  rating: number;
  actor_type?: 'producteur_direct' | 'collecteur' | 'cooperative' | 'societe' | null;
  nickname?: string | null;
  fiscal_identifier?: string | null;
  tax_registration_number?: string | null;
  id_document_type?: string | null;
  id_document_number?: string | null;
  identification_status?: SupplierIdentificationStatus;
  identification_notes?: string | null;
  name_ar?: string | null;
  contact_name_ar?: string | null;
  address_ar?: string | null;
  secondary_phone?: string | null;
  postal_address?: string | null;
  cin_document_url?: string | null;
  region?: string | null;
  locality?: string | null;
  oasis_name?: string | null;
  gps_coordinates?: string | null;
  produced_varieties?: string[];
  exploited_area_ha?: number | null;
  palm_tree_count?: number | null;
  annual_production_tons?: number | null;
  farming_mode?: 'traditionnel' | 'moderne_intensif' | 'biologique_certifie' | null;
  irrigation_source?: 'puits_artesien' | 'source_naturelle' | 'forage' | 'reseau_gid' | null;
  contract_type?: 'annuel' | 'saisonnier' | 'ponctuel' | 'achat_sur_pied' | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  contract_expiry_alert_at?: string | null;
  payment_terms?: 'immediat' | '15_jours' | '30_jours' | 'avance_et_solde' | null;
  bank_rib?: string | null;
  agreed_price_tnd_per_kg?: number | null;
  certifications?: SupplierCertification[];
  contract_documents?: string[];
  supplier_status?: SupplierStatus;
  qualification_status?: SupplierQualificationStatus;
  compliance_status?: SupplierComplianceStatus;
  risk_level?: SupplierRiskLevel;
  onboarding_date?: string | null;
  approval_date?: string | null;
  approved_by?: string | null;
  last_audit_date?: string | null;
  next_audit_date?: string | null;
  audit_score?: number;
  qualification_notes?: string | null;
  quality_score?: number;
  delivery_reliability_score?: number;
  traceability_score?: number;
  delivered_lots_count?: number;
  total_delivered_tons?: number;
  rejection_rate?: number;
  last_delivery_date?: string | null;
  total_paid_amount_tnd?: number;
  last_evaluation_date?: string | null;
  next_evaluation_date?: string | null;
  contract_records?: SupplierContractRecord[];
  performance_history?: SupplierPerformanceSnapshot[];
  created_at: string;
  updated_at: string;
}

export interface Material {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  category: string | null;
  min_stock: number;
  created_at: string;
  updated_at: string;
}

export interface MaterialReception {
  id: string;
  reception_number: string;
  supplier_id: string;
  material_id: string;
  quantity: number;
  unit: string;
  lot_number: string | null;
  status: ReceptionStatus;
  received_at: string;
  verified_at: string | null;
  verified_by: string | null;
  notes: string | null;
  quality_score: number | null;
  temperature: number | null;
  humidity: number | null;
  // New fields for enhanced protocol
  delivery_note_number: string | null;
  supplier_certificate_number: string | null;
  photos_urls: string[] | null;
  origin_country: string | null;
  origin_farm: string | null;
  harvest_date: string | null;
  visual_appearance: string | null;
  defect_percentage: number | null;
  caliber_uniformity: boolean | null;
  batch_id: string | null;
  sampling_size: number | null;
  inspector_name: string | null;
  rejection_reason: string | null;
  // Compliance assessment fields
  document_compliance: ComplianceStatus | null;
  origin_compliance: ComplianceStatus | null;
  visual_compliance: ComplianceStatus | null;
  temperature_compliance: ComplianceStatus | null;
  humidity_compliance: ComplianceStatus | null;
  contamination_check: ComplianceStatus | null;
  packaging_compliance: ComplianceStatus | null;
  // Quarantine management
  quarantine_reason: string | null;
  quarantine_release_date: string | null;
  quarantine_released_by: string | null;
  // QC Decision
  qc_decision: QCDecision | null;
  qc_decision_date: string | null;
  qc_decision_by: string | null;
  critical_non_conformity_count: number;
  non_conformity_count: number;
  created_at: string;
  updated_at: string;
  // Joined data
  supplier?: Supplier;
  material?: Material;
}

export interface ReceptionAuditLog {
  id: string;
  reception_id: string;
  action: string;
  old_status: ReceptionStatus | null;
  new_status: ReceptionStatus | null;
  performed_by: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export const statusLabels: Record<ReceptionStatus, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  verified: 'Vérifié',
  accepted: 'Accepté',
  rejected: 'Rejeté',
  quarantine: 'Quarantaine'
};

export const statusColors: Record<ReceptionStatus, string> = {
  pending: 'bg-yellow-500',
  in_progress: 'bg-blue-500',
  verified: 'bg-purple-500',
  accepted: 'bg-green-500',
  rejected: 'bg-red-500',
  quarantine: 'bg-orange-500'
};

export const complianceLabels: Record<ComplianceStatus, string> = {
  compliant: 'Conforme',
  non_compliant: 'Non Conforme',
  critical: 'Critique'
};

export const complianceColors: Record<ComplianceStatus, string> = {
  compliant: 'bg-green-500 text-white',
  non_compliant: 'bg-yellow-500 text-black',
  critical: 'bg-red-500 text-white'
};

export const qcDecisionLabels: Record<QCDecision, string> = {
  accepted: 'ACCEPTÉ',
  rejected: 'REJETÉ',
  quarantine: 'QUARANTAINE'
};

export const visualAppearanceOptions = [
  { value: 'excellent', label: 'Excellent - Dattes brillantes, calibre uniforme' },
  { value: 'good', label: 'Bon - Quelques variations mineures' },
  { value: 'acceptable', label: 'Acceptable - Défauts mineurs tolérables' },
  { value: 'poor', label: 'Médiocre - Défauts significatifs' },
  { value: 'rejected', label: 'Rejeté - Non conforme' }
];

// QC Control parameters for compliance-based assessment
export const qcControlParameters = [
  {
    id: 'document_compliance',
    name: 'Documents',
    description: 'Bon de livraison, certificats fournisseur',
    criticalIf: 'Documents manquants ou falsifiés'
  },
  {
    id: 'origin_compliance',
    name: 'Traçabilité Origine',
    description: 'Pays, palmeraie, date de récolte',
    criticalIf: 'Origine non traçable'
  },
  {
    id: 'visual_compliance',
    name: 'Aspect Visuel',
    description: 'Apparence, couleur, calibre, défauts',
    criticalIf: 'Moisissures visibles, corps étrangers'
  },
  {
    id: 'temperature_compliance',
    name: 'Température',
    description: 'Température à réception (15-25°C)',
    criticalIf: 'Hors plage critique (>30°C ou <5°C)'
  },
  {
    id: 'humidity_compliance',
    name: 'Humidité',
    description: 'Taux d\'humidité (20-24%)',
    criticalIf: 'Humidité >28% (risque moisissure)'
  },
  {
    id: 'contamination_check',
    name: 'Contamination',
    description: 'Moisissures, parasites, corps étrangers',
    criticalIf: 'Présence de contamination'
  },
  {
    id: 'packaging_compliance',
    name: 'Emballage',
    description: 'Intégrité de l\'emballage',
    criticalIf: 'Emballage endommagé exposant le produit'
  }
];
