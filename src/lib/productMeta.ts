/**
 * Neutral product brand — one codebase for any date plant.
 * Plant identity (name, logo, colors) comes from site_settings via useBranding().
 */
export const PRODUCT = {
  name: 'Date Harvest Hub',
  /** Shown when company_name is not configured yet */
  commercialName: 'MES Dattes',
  tagline: 'MES + Connect pour usines de dattes — du quai à l’export.',
  version: '2.1.0',
  edition: 'Multi-usine',
  year: 2026,
  stack: 'React · NestJS · MongoDB',
  waves: [
    'Kernel — ledger · passport · recall',
    'B0 — Harden claims (enforce · GS1)',
    'Margin · settlement · ATP',
  ],
  pillars: [
    'Parcours lot A→Z (fil d’or)',
    'Fiches + ack shift · BRA/BDE · étiquette PF',
    'Mass balance · costing · settlements',
    'QC lab · facture TVA · portail fournisseur',
    'Prêt multi-usine (branding Settings)',
  ],
} as const;

/** Fallback on prints when settings are unavailable */
export const PRINT_BRAND_FALLBACK = {
  companyName: PRODUCT.commercialName,
  companyShortName: 'MES',
  plantName: 'Usine',
  legalName: PRODUCT.commercialName,
  footprint: 'Tunisie',
} as const;
