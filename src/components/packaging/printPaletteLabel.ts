import { format } from 'date-fns';
import { PackagingPalette, PackagingOrder, PackagingBOMItem, PACKAGING_FORMAT_CONFIG } from '@/types/packaging';

export function printPaletteLabel(
  palette: PackagingPalette,
  order: PackagingOrder,
  bom: PackagingBOMItem,
) {
  const today = format(new Date(), 'dd/MM/yyyy');
  const formatLabel = PACKAGING_FORMAT_CONFIG[bom.format];
  const ssccDisplay = palette.sscc
    ? palette.sscc.replace(/(.{2})(.{8})(.{8})/, '($1) $2 $3 $4')
    : 'N/A';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Étiquette palette — ${palette.palette_number}</title>
<style>
  @page { size: 148mm 210mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }
  body { background: #fff; }
  .pal-label {
    width: 148mm;
    min-height: 210mm;
    padding: 8mm;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1pt solid #000;
    padding-bottom: 4mm;
    margin-bottom: 4mm;
  }
  .company { font-size: 16pt; font-weight: bold; }
  .doc-type { font-size: 9pt; color: #666; text-align: right; }
  .palette-num { font-size: 22pt; font-weight: bold; letter-spacing: 1px; text-align: center; margin: 3mm 0; }
  .section { margin-top: 4mm; }
  .section-title { font-size: 8pt; font-weight: bold; text-transform: uppercase; color: #666; letter-spacing: 0.5px; border-bottom: 0.5pt solid #ddd; margin-bottom: 2mm; }
  .row { display: flex; justify-content: space-between; font-size: 10pt; padding: 1mm 0; }
  .row-key { color: #666; }
  .row-val { font-weight: bold; }
  .sscc-section {
    margin-top: 6mm;
    border: 1.5pt solid #000;
    padding: 4mm;
    text-align: center;
  }
  .sscc-title { font-size: 8pt; font-weight: bold; text-transform: uppercase; margin-bottom: 2mm; }
  .sscc-code { font-size: 14pt; font-family: 'Courier New', monospace; font-weight: bold; letter-spacing: 2px; }
  .sscc-ai { font-size: 8pt; color: #444; margin-top: 1mm; }
  .signatures { display: flex; justify-content: space-between; margin-top: 8mm; padding-top: 4mm; border-top: 0.5pt solid #ddd; }
  .sig-box { text-align: center; width: 60mm; }
  .sig-line { border-top: 0.5pt solid #000; margin-top: 12mm; font-size: 8pt; color: #666; }
</style>
</head>
<body>
<div class="pal-label">
  <div class="header">
    <div>
      <div class="company">Royal Palm</div>
      <div style="font-size:8pt;color:#666">Groupe Ennour Investissement — Tozeur</div>
    </div>
    <div class="doc-type">
      <div>ÉTIQUETTE PALETTE</div>
      <div>${today}</div>
    </div>
  </div>

  <div class="palette-num">${palette.palette_number}</div>

  <div class="section">
    <div class="section-title">Produit</div>
    <div class="row"><span class="row-key">Désignation</span><span class="row-val">${bom.name}</span></div>
    <div class="row"><span class="row-key">Format</span><span class="row-val">${formatLabel.label}</span></div>
    <div class="row"><span class="row-key">Lot source</span><span class="row-val">${order.source_lot_number}</span></div>
    <div class="row"><span class="row-key">Grade</span><span class="row-val">${order.grade.replace('_', ' ')}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Contenu palette</div>
    <div class="row"><span class="row-key">Nb colis</span><span class="row-val">${palette.box_count}</span></div>
    <div class="row"><span class="row-key">Poids net</span><span class="row-val">${palette.net_weight_kg} kg</span></div>
    <div class="row"><span class="row-key">Poids brut</span><span class="row-val">${palette.gross_weight_kg} kg</span></div>
    <div class="row"><span class="row-key">OF</span><span class="row-val">${order.order_number}</span></div>
    <div class="row"><span class="row-key">Ligne</span><span class="row-val">${order.line}</span></div>
  </div>

  ${palette.sscc ? `
  <div class="sscc-section">
    <div class="sscc-title">Code SSCC — GS1-128</div>
    <div class="sscc-ai">(00)</div>
    <div class="sscc-code">${ssccDisplay}</div>
  </div>
  ` : `
  <div class="sscc-section">
    <div class="sscc-title">Sceau</div>
    <div class="sscc-code">${palette.seal_number ?? '—'}</div>
  </div>
  `}

  <div class="signatures">
    <div class="sig-box">
      <div class="sig-line">Opérateur scellage</div>
    </div>
    <div class="sig-box">
      <div class="sig-line">Responsable production</div>
    </div>
  </div>
</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 200);
}
