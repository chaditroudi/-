/**
 * Neutral product brand — one codebase for any date plant.
 * Plant identity (name, logo, colors) comes from site_settings via useBranding().
 */
export const PRODUCT = {
  name: 'Date Harvest Hub',
  /** Shown when company_name is not configured yet */
  commercialName: 'Date Harvest Hub',
  tagline: 'MES + Connect pour usines de dattes — du quai à l’export.',
  version: '2.1.0',
  edition: 'Édition usine',
  year: 2026,
  stack: 'React · NestJS · MongoDB',
  waves: [
    'Socle — registre · passeport · rappel',
    'B0 — contrôles stricts (enforce · GS1)',
    'Marge · règlements · disponibilité à promettre (ATP)',
  ],
  pillars: [
    'Parcours lot A→Z (fil d’or)',
    'Fiches + accusé de relève · BRA/BDE · étiquette PF',
    'Bilan matière · coûts · règlements',
    'Laboratoire qualité · facture TVA · portail fournisseur',
    'Identité visuelle configurable par usine',
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
