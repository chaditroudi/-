/**
 * Facture export lite — HT / TVA / TTC printable + CSV compta bridge.
 */

import type { ExportOrder } from '@/types/exportOrders';

export type InvoiceVatOptions = {
  vatRatePct: number;
  exportVatExempt: boolean;
  companyName?: string | null;
  companyLegalName?: string | null;
  plantAddress?: string | null;
  plantPhone?: string | null;
  currencyFallback?: string;
};

export type InvoiceTotals = {
  ht: number;
  vatRatePct: number;
  tva: number;
  ttc: number;
  exempt: boolean;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(n: number, currency: string): string {
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function resolveExportVatRate(opts: {
  vatRatePct: number;
  exportVatExempt: boolean;
}): number {
  if (opts.exportVatExempt) return 0;
  return Math.max(0, Number(opts.vatRatePct) || 0);
}

export function computeInvoiceTotals(ht: number, vatRatePct: number): InvoiceTotals {
  const rate = Math.max(0, vatRatePct) / 100;
  const safeHt = Math.round(Math.max(0, ht) * 100) / 100;
  const tva = Math.round(safeHt * rate * 100) / 100;
  const ttc = Math.round((safeHt + tva) * 100) / 100;
  return {
    ht: safeHt,
    vatRatePct,
    tva,
    ttc,
    exempt: vatRatePct === 0,
  };
}

export function buildExportInvoiceHtml(
  order: ExportOrder,
  options: InvoiceVatOptions,
): string {
  const currency = order.currency || options.currencyFallback || 'EUR';
  const vatRate = resolveExportVatRate(options);
  const totals = computeInvoiceTotals(Number(order.total_amount) || 0, vatRate);
  const company = escapeHtml(String(options.companyLegalName || options.companyName || 'MES Dattes'));
  const invoiceRef = `FAC-${escapeHtml(order.order_ref || order.id)}`;
  const today = new Date().toLocaleDateString('fr-FR');

  const lines = (order.lines || [])
    .map((line) => {
      const lineHt = Math.round((Number(line.net_weight_kg) || 0) * (Number(line.unit_price) || 0) * 100) / 100;
      return `<tr>
        <td>${escapeHtml(line.lot_ref || line.lot_id || '—')}</td>
        <td>${escapeHtml(line.product_name || '—')}</td>
        <td class="num">${(Number(line.net_weight_kg) || 0).toLocaleString('fr-FR')}</td>
        <td class="num">${(Number(line.unit_price) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
        <td class="num">${money(lineHt, currency)}</td>
      </tr>`;
    })
    .join('');

  const vatNote = totals.exempt
    ? "TVA exonérée — opération d'exportation (réglage site)."
    : `TVA ${totals.vatRatePct} % appliquée selon le tarif site.`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Facture ${invoiceRef}</title>
<style>
  @page { margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 11pt; }
  h1 { font-size: 18pt; margin: 0 0 4px; }
  .muted { color: #666; font-size: 9pt; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 18px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border-bottom: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 10pt; }
  th { background: #f5f5f5; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.4px; }
  .num { text-align: right; white-space: nowrap; }
  .totals { width: 280px; margin-left: auto; margin-top: 16px; }
  .totals .row { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .ttc { font-size: 13pt; font-weight: bold; border-top: 2px solid #111; margin-top: 6px; padding-top: 8px; }
  .note { margin-top: 20px; padding: 10px; background: #f8faf8; border: 1px solid #d1e7dd; font-size: 9pt; }
</style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <h1>FACTURE EXPORT</h1>
      <div class="muted">${company}</div>
      ${options.plantAddress ? `<div class="muted">${escapeHtml(options.plantAddress)}</div>` : ''}
      ${options.plantPhone ? `<div class="muted">${escapeHtml(options.plantPhone)}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div><strong>${invoiceRef}</strong></div>
      <div class="muted">Commande ${escapeHtml(order.order_ref)}</div>
      <div class="muted">Date ${today}</div>
      <div class="muted">Statut ${escapeHtml(order.status)}</div>
    </div>
  </div>

  <div class="grid">
    <div>
      <div class="muted">VENDEUR</div>
      <div><strong>${company}</strong></div>
    </div>
    <div>
      <div class="muted">ACHETEUR</div>
      <div><strong>${escapeHtml(order.customer_name)}</strong></div>
      <div class="muted">${escapeHtml(order.customer_country)}</div>
      ${order.customer_address ? `<div>${escapeHtml(order.customer_address)}</div>` : ''}
      ${order.customer_contact ? `<div class="muted">${escapeHtml(order.customer_contact)}</div>` : ''}
    </div>
  </div>

  <div class="muted">
    Incoterms ${escapeHtml(order.incoterms || '—')}
    · Chargement ${escapeHtml(order.port_of_loading || '—')}
    · Destination ${escapeHtml(order.port_of_destination || '—')}
  </div>

  <table>
    <thead>
      <tr>
        <th>Lot</th>
        <th>Produit</th>
        <th class="num">Poids (kg)</th>
        <th class="num">P.U.</th>
        <th class="num">HT</th>
      </tr>
    </thead>
    <tbody>
      ${lines || `<tr><td colspan="5" class="muted">Aucune ligne</td></tr>`}
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Total HT</span><span>${money(totals.ht, currency)}</span></div>
    <div class="row"><span>TVA (${totals.vatRatePct} %)</span><span>${money(totals.tva, currency)}</span></div>
    <div class="row ttc"><span>Total TTC</span><span>${money(totals.ttc, currency)}</span></div>
  </div>

  <div class="note">${escapeHtml(vatNote)}
    ${order.notes ? `<br/>Notes : ${escapeHtml(order.notes)}` : ''}
  </div>
</body>
</html>`;
}

export function printExportInvoice(order: ExportOrder, options: InvoiceVatOptions): void {
  const html = buildExportInvoiceHtml(order, options);
  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1000');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

/** Simple CSV for accountant / Sage import bridge. */
export function buildExportInvoiceCsv(
  order: ExportOrder,
  options: Pick<InvoiceVatOptions, 'vatRatePct' | 'exportVatExempt'>,
): string {
  const currency = order.currency || 'EUR';
  const vatRate = resolveExportVatRate(options);
  const totals = computeInvoiceTotals(Number(order.total_amount) || 0, vatRate);
  const header = [
    'invoice_ref',
    'order_ref',
    'customer',
    'country',
    'currency',
    'ht',
    'vat_rate_pct',
    'tva',
    'ttc',
    'lot_ref',
    'product',
    'net_weight_kg',
    'unit_price',
    'line_ht',
  ].join(';');

  const invoiceRef = `FAC-${order.order_ref || order.id}`;
  const rows = (order.lines || []).map((line) => {
    const lineHt = Math.round((Number(line.net_weight_kg) || 0) * (Number(line.unit_price) || 0) * 100) / 100;
    return [
      invoiceRef,
      order.order_ref,
      order.customer_name,
      order.customer_country,
      currency,
      totals.ht.toFixed(2),
      totals.vatRatePct,
      totals.tva.toFixed(2),
      totals.ttc.toFixed(2),
      line.lot_ref || line.lot_id,
      line.product_name,
      line.net_weight_kg,
      line.unit_price,
      lineHt.toFixed(2),
    ]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(';');
  });

  if (rows.length === 0) {
    rows.push(
      [
        invoiceRef,
        order.order_ref,
        order.customer_name,
        order.customer_country,
        currency,
        totals.ht.toFixed(2),
        totals.vatRatePct,
        totals.tva.toFixed(2),
        totals.ttc.toFixed(2),
        '',
        '',
        '',
        '',
        '',
      ]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(';'),
    );
  }

  return [header, ...rows].join('\n');
}

export function downloadExportInvoiceCsv(
  order: ExportOrder,
  options: Pick<InvoiceVatOptions, 'vatRatePct' | 'exportVatExempt'>,
): void {
  const csv = buildExportInvoiceCsv(order, options);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `FAC-${order.order_ref || order.id}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
