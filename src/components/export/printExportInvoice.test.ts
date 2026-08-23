import { describe, expect, it } from 'vitest';

import type { ExportOrder } from '@/types/exportOrders';
import {
  buildExportInvoiceCsv,
  buildExportInvoiceHtml,
  computeInvoiceTotals,
  resolveExportVatRate,
} from './printExportInvoice';

const order: ExportOrder = {
  id: 'ord-1',
  order_ref: 'EXP-2026-01',
  customer_name: 'Nordic Dates AB',
  customer_country: 'EU',
  customer_address: 'Stockholm',
  customer_contact: 'Anna',
  incoterms: 'FOB',
  port_of_loading: 'Rades',
  port_of_destination: 'Goteborg',
  lines: [
    {
      lot_id: 'l1',
      lot_ref: 'LOT-A',
      product_name: 'Deglet Nour',
      net_weight_kg: 100,
      unit_price: 4.5,
      currency: 'EUR',
    },
  ],
  total_weight_kg: 100,
  total_amount: 450,
  currency: 'EUR',
  status: 'confirmed',
  contract_language: 'en',
  notes: null,
  created_by: null,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
};

describe('export invoice TVA', () => {
  it('computes HT / TVA / TTC', () => {
    expect(computeInvoiceTotals(100, 19)).toEqual({
      ht: 100,
      vatRatePct: 19,
      tva: 19,
      ttc: 119,
      exempt: false,
    });
  });

  it('uses 0% when export exempt', () => {
    expect(resolveExportVatRate({ vatRatePct: 19, exportVatExempt: true })).toBe(0);
    expect(resolveExportVatRate({ vatRatePct: 19, exportVatExempt: false })).toBe(19);
  });

  it('builds printable HTML with TVA block', () => {
    const html = buildExportInvoiceHtml(order, {
      vatRatePct: 19,
      exportVatExempt: true,
      companyName: 'Royal Palm',
    });
    expect(html).toContain('FACTURE EXPORT');
    expect(html).toContain('FAC-EXP-2026-01');
    expect(html).toContain('Nordic Dates AB');
    expect(html).toContain('TVA (0 %)');
    expect(html).toContain('exon');
  });

  it('builds CSV bridge for accountant', () => {
    const csv = buildExportInvoiceCsv(order, { vatRatePct: 19, exportVatExempt: false });
    expect(csv.split('\n')[0]).toContain('vat_rate_pct');
    expect(csv).toContain('EXP-2026-01');
    expect(csv).toContain('85.50'); // 450 * 0.19
  });
});
