/** Canonical departments — mirrors server/src/modules/org/departments.ts */

export const DEPARTMENTS = [
  'stock',
  'production',
  'quality',
  'maintenance',
  'hr',
  'purchasing',
  'logistics',
  'reception',
  'finance',
  'direction',
] as const;

export type DepartmentCode = (typeof DEPARTMENTS)[number];

export const DEPARTMENT_LABELS: Record<DepartmentCode, string> = {
  stock: 'Stock / Magasin',
  production: 'Production',
  quality: 'Qualité',
  maintenance: 'Maintenance',
  hr: 'RH',
  purchasing: 'Achats',
  logistics: 'Logistique',
  reception: 'Réception',
  finance: 'Finance / DAF',
  direction: 'Direction',
};

export const ORG_ROLES = [
  'employee',
  'department_manager',
  'purchasing_officer',
  'purchasing_manager',
  'finance_director',
] as const;

export type OrgRole = (typeof ORG_ROLES)[number];

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  employee: 'Employé',
  department_manager: 'Responsable département',
  purchasing_officer: 'Acheteur',
  purchasing_manager: 'Responsable Achats',
  finance_director: 'Directeur financier / DAF',
};
