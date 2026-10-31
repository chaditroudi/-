export type ProductionView =
  | 'today' | 'orders' | 'pipeline'
  | 'fumigation' | 'nettoyage' | 'hydratation' | 'triage'
  | 'flux' | 'balance' | 'haccp' | 'kpi' | 'alertes';

export const PRODUCTION_VIEWS: ProductionView[] = [
  'today', 'orders', 'pipeline', 'fumigation', 'nettoyage', 'hydratation', 'triage', 'flux', 'balance', 'haccp', 'kpi', 'alertes',
];
