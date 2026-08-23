import type { CostSummaryView } from '@/lib/api/costing';

const fmt = (n: number, digits = 2) =>
  n.toLocaleString('fr-TN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** CFO pack — printable period cost & margin roll-up (Wave B). */
export function printCfoCostPack(
  data: CostSummaryView,
  brand?: { companyName?: string; plantName?: string },
) {
  const company = brand?.companyName || 'Date Harvest Hub';
  const plant = brand?.plantName || '';
  const periodLabel =
    data.period === 'week' ? 'Semaine' : data.period === 'quarter' ? 'Trimestre' : 'Mois';

  const rows = data.breakdown
    .map(
      (row) =>
        `<tr>
          <td>${row.label}</td>
          <td style="text-align:right">${fmt(row.amount)} TND</td>
          <td style="text-align:right">${row.percentage}%</td>
        </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/><title>CFO Pack — ${periodLabel}</title>
<style>
  body{font-family:Segoe UI,Arial,sans-serif;max-width:720px;margin:24px auto;color:#111;line-height:1.4}
  h1{font-size:20px;margin:0} .meta{color:#555;font-size:13px;margin:4px 0 16px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left}
  th{background:#f8fafc;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b}
  .kpi{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:16px 0}
  .kpi div{border:1px solid #e2e8f0;border-radius:12px;padding:12px}
  .kpi strong{display:block;font-size:18px;margin-top:4px}
  @media print{body{margin:12px}}
</style></head><body>
  <h1>${company}</h1>
  <p class="meta">${plant ? `${plant} · ` : ''}Pack CFO — coûts standard · ${periodLabel} · base ${data.basis}</p>
  <div class="kpi">
    <div><span>Coût / kg</span><strong>${fmt(data.totals.cost_tnd_per_kg, 3)} TND</strong></div>
    <div><span>Cible / kg</span><strong>${fmt(data.totals.target_cost_tnd_per_kg, 3)} TND</strong></div>
    <div><span>Écart</span><strong>${fmt(data.totals.cost_variance_pct, 1)}%</strong></div>
  </div>
  <p class="meta">Produit ${fmt(data.totals.produced_kg, 1)} kg · Déchets ${fmt(data.totals.waste_kg, 1)} kg · Total ${fmt(data.totals.total_cost_tnd)} TND</p>
  <table>
    <thead><tr><th>Poste</th><th style="text-align:right">Montant</th><th style="text-align:right">%</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="meta" style="margin-top:20px">Sources: ${data.sources.triage_sessions} triage · ${data.sources.packaging_orders} OF · ${data.sources.reception_lots_with_purchase_cost} lots achat${
    data.sources.mass_balance_unbalanced
      ? ` · ${data.sources.mass_balance_unbalanced} bilan hors tolérance`
      : ''
  }</p>
  <p class="meta">Généré ${new Date().toLocaleString('fr-FR')} — Wave B margin engine</p>
</body></html>`;

  const win = window.open('', '_blank', 'noopener,noreferrer,width=800,height=900');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
