/**
 * Shop-floor PF (produit fini) label — lot, grade, weight, QR payload text.
 * Printable from Parcours / Conditionnement without a full packaging order.
 */

export type PfLotLabelInput = {
  lotNumber: string;
  productName?: string | null;
  variety?: string | null;
  grade?: string | null;
  netWeightKg?: number | null;
  companyName?: string | null;
  plantName?: string | null;
  packedAt?: string | null;
  copies?: number;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatWeight(kg: number | null | undefined): string {
  if (kg == null || Number.isNaN(Number(kg))) return '—';
  return `${Number(kg).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg`;
}

export function buildPfLotLabelHtml(input: PfLotLabelInput): string {
  const lot = String(input.lotNumber || '').trim() || '—';
  const product = escapeHtml(String(input.productName || 'Dattes — Produit fini'));
  const variety = input.variety ? escapeHtml(String(input.variety)) : '';
  const grade = escapeHtml(String(input.grade || 'PF'));
  const company = escapeHtml(String(input.companyName || 'MES Dattes'));
  const plant = escapeHtml(String(input.plantName || ''));
  const packed =
    input.packedAt ||
    new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const weight = escapeHtml(formatWeight(input.netWeightKg));
  const qrPayload = escapeHtml(`LOT:${lot}`);
  const copies = Math.max(1, Math.min(20, Number(input.copies) || 1));

  const one = `
<div class="label">
  <div class="brand">${company}${plant ? ` · ${plant}` : ''}</div>
  <div class="doc">ÉTIQUETTE PF</div>
  <div class="product">${product}</div>
  ${variety ? `<div class="variety">${variety}</div>` : ''}
  <div class="lot">${escapeHtml(lot)}</div>
  <div class="grid">
    <div><span class="k">Grade</span><span class="v">${grade}</span></div>
    <div><span class="k">Poids net</span><span class="v">${weight}</span></div>
    <div><span class="k">Conditionné</span><span class="v">${escapeHtml(packed)}</span></div>
  </div>
  <div class="qr-box">
    <div class="qr-title">Scan / traçabilité</div>
    <div class="qr-code">${qrPayload}</div>
  </div>
</div>`;

  const body = Array.from({ length: copies }, () => one).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Étiquette PF — ${escapeHtml(lot)}</title>
<style>
  @page { size: 100mm 70mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; }
  body { background: #fff; color: #111; }
  .label {
    width: 100mm;
    min-height: 70mm;
    padding: 4mm 5mm;
    border: 1px solid #ddd;
    page-break-after: always;
    display: flex;
    flex-direction: column;
    gap: 2mm;
  }
  .brand { font-size: 8pt; color: #555; text-transform: uppercase; letter-spacing: 0.6px; }
  .doc { font-size: 8pt; font-weight: bold; color: #166534; letter-spacing: 1px; }
  .product { font-size: 13pt; font-weight: bold; line-height: 1.2; }
  .variety { font-size: 9pt; color: #444; font-style: italic; }
  .lot {
    margin-top: 1mm;
    font-family: "Courier New", monospace;
    font-size: 16pt;
    font-weight: bold;
    letter-spacing: 1px;
    border: 1.5pt solid #111;
    padding: 2mm 3mm;
    text-align: center;
  }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 2mm; margin-top: 1mm; }
  .k { display: block; font-size: 7pt; color: #666; text-transform: uppercase; }
  .v { display: block; font-size: 10pt; font-weight: bold; }
  .qr-box {
    margin-top: auto;
    border-top: 0.5pt solid #ccc;
    padding-top: 2mm;
    text-align: center;
  }
  .qr-title { font-size: 7pt; color: #666; text-transform: uppercase; }
  .qr-code { font-family: "Courier New", monospace; font-size: 11pt; font-weight: bold; letter-spacing: 1px; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

export function printPfLotLabel(input: PfLotLabelInput): void {
  const html = buildPfLotLabelHtml(input);
  const win = window.open('', '_blank', 'noopener,noreferrer,width=480,height=640');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
