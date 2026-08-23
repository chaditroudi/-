/**
 * Browser-side season demo — same story as `npm run demo:season` for admin demos.
 */
import { apiRequest } from '@/integrations/mongodb/client';

const STAGES = [
  'WEIGHED',
  'QC_DECIDED',
  'COLD_STORE',
  'FUMIGATION_CCP',
  'TRIAGE',
  'PACKED',
  'SHIPPED',
] as const;

export type DemoSeasonResult = {
  seasonTag: string;
  lotId: string;
  lotNumber: string;
  passportPath: string;
};

async function ensureSupplierId(): Promise<string> {
  const listed = await apiRequest<{ data: Array<{ id: string }> }>('/db/query', {
    method: 'POST',
    body: JSON.stringify({ table: 'suppliers', filters: [], limit: 1 }),
  });
  if (listed.data?.[0]?.id) return listed.data[0].id;

  const today = new Date().toISOString().slice(0, 10);
  const created = await apiRequest<{ data: Array<{ id: string }> }>('/db/insert', {
    method: 'POST',
    body: JSON.stringify({
      table: 'suppliers',
      values: {
        code: `SEASON-UI-${Date.now()}`,
        name: 'Season Demo (UI)',
        supplier_status: 'active',
        is_active: true,
        country: 'TN',
        contract_start_date: today,
        contract_end_date: '2099-12-31',
      },
    }),
  });
  const id = created.data?.[0]?.id;
  if (!id) throw new Error('Impossible de créer le fournisseur démo');
  return id;
}

export async function runDemoSeasonInApp(): Promise<DemoSeasonResult> {
  const seasonTag = `SEASON-${new Date().toISOString().slice(0, 10)}`;
  const supplierId = await ensureSupplierId();
  const lotSupplier = `${seasonTag}-${Date.now()}`;

  const intake = await apiRequest<{
    data: { lots?: Array<{ id: string; lot_internal?: string }> };
  }>('/receptions/intake', {
    method: 'POST',
    body: JSON.stringify({
      client_request_id: crypto.randomUUID(),
      supplier_id: supplierId,
      spontaneous_delivery: true,
      unit: 'kg',
      quantity_total: 750,
      gross_weight_kg: 780,
      tare_weight_kg: 30,
      variety: 'Deglet Nour',
      notes: 'demo:season UI — lab humidity=22.4 defects=3.1',
      lots: [{ lot_supplier: lotSupplier, variety: 'Deglet Nour', quantity: 750, unit: 'kg' }],
    }),
  });

  const lot = intake.data?.lots?.[0];
  if (!lot?.id) throw new Error("Intake démo échoué — vérifiez les droits réception");

  for (const toStage of STAGES) {
    const payload: Record<string, unknown> = { demo: true, season: seasonTag, toStage };
    if (toStage === 'QC_DECIDED') {
      payload.lab_humidity_pct = 22.4;
      payload.lab_defects_pct = 3.1;
      payload.decision = 'ACCEPTE';
    }
    if (toStage === 'PACKED') {
      payload.label = 'PF';
      payload.net_weight_kg = 12.5;
    }
    await apiRequest(`/trust/lots/${encodeURIComponent(lot.id)}/advance`, {
      method: 'POST',
      body: JSON.stringify({
        toStage,
        collection: 'demo_season',
        payload,
        route: 'PREMIUM_WHOLE',
      }),
    });
  }

  const lotNumber = lot.lot_internal || lot.id;
  return {
    seasonTag,
    lotId: lot.id,
    lotNumber,
    passportPath: `/#/passport/${encodeURIComponent(lotNumber)}`,
  };
}
