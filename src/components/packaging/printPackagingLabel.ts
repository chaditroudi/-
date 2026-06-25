import { format, addDays } from 'date-fns';
import { LabelTemplate, PackagingOrder, formatGS1HRI, PACKAGING_FORMAT_CONFIG } from '@/types/packaging';

export function printPackagingLabel(
  order: PackagingOrder,
  template: LabelTemplate,
  copies = 1,
) {
  const today = new Date();
  const expiryDate = addDays(today, template.use_by_days);
  const prodDateYYMMDD = format(today, 'yyMMdd');
  const expiryDateYYMMDD = format(expiryDate, 'yyMMdd');
  const prodDateDisplay = format(today, 'dd/MM/yyyy');
  const expiryDateDisplay = format(expiryDate, 'dd/MM/yyyy');

  const gs1hri = formatGS1HRI({
    gtin: template.gtin,
    lotNumber: order.source_lot_number,
    productionDate: prodDateYYMMDD,
    expiryDate: expiryDateYYMMDD,
    netWeightG: template.net_weight_g,
  });

  const formatLabel = PACKAGING_FORMAT_CONFIG[order.bom_format];
  const isPrivateLabel = template.brand === 'PRIVATE_LABEL';

  const labelHtml = `
<div class="label-wrapper">
  <div class="brand">${isPrivateLabel ? (template.client_name ?? 'Marque Blanche') : 'Royal Palm'}</div>
  <div class="product-name">${template.product_name}</div>
  ${template.variety ? `<div class="variety">${template.variety}</div>` : ''}
  <div class="weight-bar">
    <span class="weight">${formatLabel.label}</span>
    <span class="origin">${template.origin}</span>
  </div>
  <div class="divider"></div>
  <div class="dates-row">
    <div><span class="label-key">Prod:</span> ${prodDateDisplay}</div>
    <div><span class="label-key">DLC:</span> ${expiryDateDisplay}</div>
  </div>
  <div class="lot-row">
    <span class="label-key">Lot:</span>
    <span class="lot-value">${order.source_lot_number}</span>
  </div>
  ${template.gtin ? `<div class="gtin-row"><span class="label-key">GTIN:</span> ${template.gtin}</div>` : ''}
  <div class="gs1-bar">${gs1hri}</div>
  <div class="divider"></div>
  <div class="ingredients">
    <span class="label-key">Ingrédients:</span> ${template.ingredients}
  </div>
  ${template.allergens ? `<div class="allergens"><strong>Allergènes:</strong> ${template.allergens}</div>` : ''}
  <div class="storage">${template.storage_temp}</div>
</div>`;

  const labelBlock = Array.from({ length: copies }, () => labelHtml).join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Étiquettes — ${order.order_number}</title>
<style>
  @page { size: 100mm 150mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }
  body { background: #fff; }
  .label-wrapper {
    width: 100mm;
    min-height: 150mm;
    padding: 6mm 5mm;
    border: 1px solid #ddd;
    page-break-after: always;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .brand { font-size: 8pt; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .product-name { font-size: 14pt; font-weight: bold; line-height: 1.2; margin: 2px 0; }
  .variety { font-size: 10pt; color: #444; font-style: italic; }
  .weight-bar {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin: 4px 0;
  }
  .weight { font-size: 20pt; font-weight: bold; }
  .origin { font-size: 7pt; color: #666; text-align: right; max-width: 45mm; }
  .divider { border-top: 0.5pt solid #ccc; margin: 3px 0; }
  .dates-row { display: flex; justify-content: space-between; font-size: 9pt; }
  .lot-row { font-size: 9pt; margin: 2px 0; }
  .gtin-row { font-size: 7pt; color: #888; }
  .gs1-bar {
    font-size: 6.5pt;
    font-family: 'Courier New', monospace;
    color: #333;
    background: #f5f5f5;
    padding: 2px 3px;
    border-radius: 2px;
    word-break: break-all;
    margin: 3px 0;
  }
  .label-key { font-weight: bold; }
  .lot-value { font-family: 'Courier New', monospace; font-weight: bold; }
  .ingredients { font-size: 7pt; color: #444; line-height: 1.3; }
  .allergens { font-size: 7pt; color: #c00; margin-top: 2px; }
  .storage { font-size: 7pt; color: #444; margin-top: 2px; font-style: italic; }
  @media print {
    .label-wrapper { border: none; }
  }
</style>
</head>
<body>
${labelBlock}
</body>
</html>`;

  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 200);
}
