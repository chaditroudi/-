/**
 * Commercial product metadata — single source for About / buyer handoff UI.
 */
export const PRODUCT = {
  name: 'Date Harvest Hub',
  commercialName: 'Royal Palm MES',
  tagline: 'MES / ERP traçabilité pour fabrication de dattes — du quai à l’export.',
  version: '2.1.0',
  edition: 'Enterprise Traceability',
  year: 2026,
  stack: 'React · NestJS · MongoDB',
  waves: ['Wave A — Trust gates', 'Wave B — Mass balance & costing', 'Wave C — Settlements & margin'],
  pillars: [
    'Parcours lot A→Z (fil d’or)',
    'Fiches techniques atelier',
    'Documents BRA / BDE',
    'Réception · QC · Froid · CCP · Triage · Packing · Export',
    'Rôles & portails (usine, fournisseur, client)',
  ],
} as const;
