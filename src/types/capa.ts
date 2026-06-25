export type CAPAStatus = 'OUVERT' | 'EN_COURS' | 'FERME' | 'VERIFIE';
export type CAPASeverity = 'CRITIQUE' | 'MAJEUR' | 'MINEUR';

export interface CAPATicket {
  id: string;
  ticket_number: string;
  reception_id: string;
  inspection_id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  reception_number: string | null;
  nc_codes: string[];
  severity: CAPASeverity;
  status: CAPAStatus;
  root_cause: string | null;
  corrective_action: string | null;
  preventive_action: string | null;
  deadline: string | null;
  responsible: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
}

export const capaStatusLabels: Record<CAPAStatus, string> = {
  OUVERT:   'Ouvert',
  EN_COURS: 'En cours',
  FERME:    'Fermé',
  VERIFIE:  'Vérifié',
};

export const capaStatusColors: Record<CAPAStatus, string> = {
  OUVERT:   'border-red-300 bg-red-50 text-red-700',
  EN_COURS: 'border-amber-300 bg-amber-50 text-amber-700',
  FERME:    'border-blue-300 bg-blue-50 text-blue-700',
  VERIFIE:  'border-emerald-300 bg-emerald-50 text-emerald-700',
};

export const capaSeverityColors: Record<CAPASeverity, string> = {
  CRITIQUE: 'border-red-400 bg-red-100 text-red-800',
  MAJEUR:   'border-orange-300 bg-orange-50 text-orange-700',
  MINEUR:   'border-yellow-200 bg-yellow-50 text-yellow-700',
};
