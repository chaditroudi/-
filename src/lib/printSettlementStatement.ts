import type { SupplierSettlement } from '@/lib/api/settlements';

const GRADE_LABELS: Record<string, string> = {
  EXTRA: 'Extra',
  CATEGORIE_I: 'Catégorie I',
  CATEGORIE_II: 'Catégorie II',
  REJETE: 'Rejeté',
};

const fmt = (n: number, digits = 2) =>
  n.toLocaleString('fr-TN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Same-day farmer/supplier grade settlement statement (Wave C). */
export function printSettlementStatement(
  settlement: SupplierSettlement,
  brand?: { companyName?: string; plantName?: string; plantEmail?: string | null },
) {
  const company = brand?.companyName || 'Date Harvest Hub';
  const plant = brand?.plantName || '';
  const lines = (settlement.lines || [])
    .map(
      (line) =>
        `<tr>
          <td>${GRADE_LABELS[line.grade] || line.grade}</td>
          <td style="text-align:right">${fmt(line.weight_kg, 1)} kg</td>
          <td style="text-align:right">${fmt(line.price_tnd_per_kg, 3)}</td>
          <td style="text-align:right">${fmt(line.amount_tnd, 2)}</td>
          <td>${line.lot_number || '—'}</td>
        </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/><title>Règlement ${settlement.settlement_number}</title>
<style>
  body{font-family:Segoe UI,Arial,sans-serif;max-width:720px;margin:24px auto;color:#111}
  h1{font-size:20px;margin:0} .meta{color:#555;font-size:13px;margin:4px 0 16px}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}
  th,td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left}
  th{background:#f8fafc;font-size:11px;text-transform:uppercase;color:#64748b}
  .total{font-size:18px;font-weight:700;margin-top:16px}
  @media print{body{margin:12px}}
</style></head><body>
  <h1>${company}</h1>
  <p class="meta">${plant ? `${plant} · ` : ''}Relevé de règlement grades (triage)</p>
  <p><strong>N° ${settlement.settlement_number}</strong> · Statut ${settlement.status}</p>
  <p class="meta">Fournisseur: ${settlement.supplier_name || settlement.supplier_id}<br/>
  Lot parent: ${settlement.parent_lot_number || '—'} · Session: ${settlement.triage_session_number || '—'}</p>
  <table>
    <thead><tr><th>Grade</th><th style="text-align:right">Poids</th><th style="text-align:right">Prix/kg</th><th style="text-align:right">Montant</th><th>Sous-lot</th></tr></thead>
    <tbody>${lines || '<tr><td colspan="5">Aucune ligne</td></tr>'}</tbody>
  </table>
  <p class="meta">Poids payable: ${fmt(settlement.payable_weight_kg, 1)} kg (hors rejet)</p>
  <p class="total">${fmt(settlement.total_amount_tnd, 2)} ${settlement.currency || 'TND'}</p>
  <p class="meta">Base: ${settlement.basis || 'grade_prices'} · ${brand?.plantEmail || ''}<br/>
  Généré ${new Date().toLocaleString('fr-FR')} — vérifiable vs passeport lot / triage</p>
</body></html>`;

  const win = window.open('', '_blank', 'noopener,noreferrer,width=800,height=900');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
