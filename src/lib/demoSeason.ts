/**
 * Browser-side season demo — same story as `npm run demo:season` for admin demos.
 */
import { apiRequest } from '@/integrations/mongodb/client';

const STAGES = [
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

/** 1×1 JPEG: the demo has no camera, and RG-R06 requires two arrival photos. */
const DEMO_PHOTO =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z';

async function ensureSupplierId(): Promise<string> {
  const listed = await apiRequest<{ data: Array<{ id: string }> }>('/suppliers');
  if (listed.data?.[0]?.id) return listed.data[0].id;

  const today = new Date().toISOString().slice(0, 10);
  const created = await apiRequest<{ data: { id: string } }>('/suppliers', {
    method: 'POST',
    body: JSON.stringify({
      code: `SEASON-UI-${Date.now()}`,
      name: 'Season Demo (UI)',
      supplier_status: 'active',
      is_active: true,
      country: 'TN',
      contract_start_date: today,
      contract_end_date: '2099-12-31',
    }),
  });
  const id = created.data?.id;
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
      reception_type: 'DATTE',
      delivery_note_number: `BL-${lotSupplier}`,
      vehicle_number: 'DEMO-0000',
      unit: 'kg',
      quantity_total: 750,
      gross_weight_kg: 780,
      tare_weight_kg: 30,
      weighing_source: 'MANUAL',
      weighing_manual_reason: 'Démonstration sans bascule',
      unit_count: 1,
      unit_type: 'PALETTE',
      variety: 'Deglet Nour',
      maturity_stage: 'Tamar',
      harvest_method: 'Manuelle traditionnelle',
      arrival_temperature_c: 24,
      storage_zone_code: 'ZR-DEMO',
      delivery_note_photos: [DEMO_PHOTO, DEMO_PHOTO],
      remarks: 'demo:season UI — lab humidity=22.4 defects=3.1',
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
