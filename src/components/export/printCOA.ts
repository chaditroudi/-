import type { COADocument } from '@/types/exportOrders';

export function printCOA(coa: COADocument): void {
  const now = new Date().toLocaleDateString('fr-FR');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>COA — ${coa.coa_ref}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; margin: 0; }
    @page { size: A4; margin: 14mm; }
    .page { width: 210mm; min-height: 297mm; padding: 14mm; margin: 0 auto; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #1a5276; color: white; padding: 5px 8px; font-size: 10px; text-align: left; }
    td { border: 1px solid #ccc; padding: 4px 8px; font-size: 11px; }
    .label { background: #eaf4fb; font-weight: 600; width: 40%; }
    h2 { font-size: 12px; color: #1a5276; border-bottom: 1.5px solid #1a5276; padding-bottom: 4px; margin: 14px 0 8px; text-transform: uppercase; }
    .pass { color: #065f46; font-weight: 700; }
    .fail { color: #991b1b; font-weight: 700; }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div style="display:flex;align-items:stretch;border:2px solid #1a5276;margin-bottom:14px">
    <div style="min-width:100px;border-right:1px solid #1a5276;display:flex;align-items:center;justify-content:center;padding:8px">
      <div style="text-align:center">
        <div style="color:#107754;font-weight:700;font-size:16px;line-height:1.1">Royal</div>
        <div style="color:#107754;font-weight:700;font-size:16px;line-height:1.1">Palm</div>
        <div style="color:#888;font-size:8px">Group</div>
      </div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px;border-right:1px solid #1a5276">
      <div style="font-size:15px;font-weight:700;color:#1a5276">CERTIFICAT D'ANALYSE (COA)</div>
      <div style="font-size:10px;color:#555;margin-top:4px">Certificate of Analysis</div>
    </div>
    <div style="min-width:160px;padding:10px;font-size:10px;display:flex;flex-direction:column;gap:3px">
      <div><strong>Réf. COA :</strong> <span style="font-family:monospace">${coa.coa_ref}</span></div>
      <div><strong>Lot :</strong> <span style="font-family:monospace">${coa.batch_ref ?? '—'}</span></div>
      <div><strong>Date :</strong> ${now}</div>
      ${coa.expiry_date ? `<div><strong>Expiration :</strong> ${coa.expiry_date}</div>` : ''}
    </div>
  </div>

  <!-- Identification -->
  <h2>Identification du Lot</h2>
  <table>
    <tbody>
      <tr><td class="label">Référence lot interne</td><td style="font-family:monospace">${coa.batch_ref ?? '—'}</td></tr>
      <tr><td class="label">Fournisseur</td><td>${coa.supplier_name ?? '—'}</td></tr>
      <tr><td class="label">Région d'origine</td><td>${coa.origin_region ?? '—'}</td></tr>
      <tr><td class="label">Exploitation</td><td>${coa.origin_farm ?? '—'}</td></tr>
      <tr><td class="label">Date de récolte</td><td>${coa.harvest_date ?? '—'}</td></tr>
      <tr><td class="label">Date de production</td><td>${coa.production_date ?? '—'}</td></tr>
      <tr><td class="label">Date d'expiration</td><td>${coa.expiry_date ?? '—'}</td></tr>
      <tr><td class="label">Certifications</td><td>${coa.certifications.join(', ') || '—'}</td></tr>
    </tbody>
  </table>

  <!-- Résultats d'analyse -->
  <h2>Résultats d'Analyse</h2>
  <table>
    <thead>
      <tr>
        <th>Paramètre</th>
        <th>Valeur mesurée</th>
        <th>Norme / Limite</th>
        <th>Résultat</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Humidité (%)</td>
        <td>${coa.humidity_pct != null ? coa.humidity_pct + ' %' : '—'}</td>
        <td>14 % – 18 %</td>
        <td class="${coa.humidity_pct != null ? (coa.humidity_pct >= 14 && coa.humidity_pct <= 18 ? 'pass' : 'fail') : ''}">
          ${coa.humidity_pct != null ? (coa.humidity_pct >= 14 && coa.humidity_pct <= 18 ? '✓ CONFORME' : '✗ NON CONFORME') : '—'}
        </td>
      </tr>
      <tr>
        <td>Score moisissure</td>
        <td>${coa.mold_score != null ? coa.mold_score : '—'}</td>
        <td>≤ 1</td>
        <td class="${coa.mold_score != null ? (coa.mold_score <= 1 ? 'pass' : 'fail') : ''}">
          ${coa.mold_score != null ? (coa.mold_score <= 1 ? '✓ CONFORME' : '✗ NON CONFORME') : '—'}
        </td>
      </tr>
      <tr>
        <td>Grade visuel</td>
        <td>${coa.visual_grade ?? '—'}</td>
        <td>Premium / Standard</td>
        <td class="${coa.visual_grade ? (['premium', 'standard'].includes(coa.visual_grade) ? 'pass' : 'fail') : ''}">
          ${coa.visual_grade ? (['premium', 'standard'].includes(coa.visual_grade) ? '✓ CONFORME' : '✗ NON CONFORME') : '—'}
        </td>
      </tr>
      <tr>
        <td>Poids net (kg)</td>
        <td>${coa.net_weight_kg != null ? coa.net_weight_kg.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' kg' : '—'}</td>
        <td>—</td>
        <td>—</td>
      </tr>
      <tr>
        <td>Poids brut (kg)</td>
        <td>${coa.gross_weight_kg != null ? coa.gross_weight_kg.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' kg' : '—'}</td>
        <td>—</td>
        <td>—</td>
      </tr>
    </tbody>
  </table>

  ${coa.notes ? `
  <h2>Observations</h2>
  <div style="border:1px solid #ccc;padding:8px;font-size:11px;background:#fafafa">${coa.notes}</div>
  ` : ''}

  <!-- Approbation -->
  <h2>Approbation</h2>
  <div style="display:flex;gap:16px;margin-top:8px">
    <div style="flex:1;border:1px solid #1a5276;padding:8px">
      <div style="font-size:10px;font-weight:600;color:#1a5276;margin-bottom:4px">Approuvé par</div>
      <div style="font-size:11px">${coa.approved_by ?? '___________________'}</div>
      <div style="font-size:10px;color:#555;margin-top:4px">Date : ${coa.approved_at ? new Date(coa.approved_at).toLocaleDateString('fr-FR') : '___________________'}</div>
    </div>
    <div style="flex:1;border:1px solid #1a5276;padding:8px">
      <div style="font-size:10px;font-weight:600;color:#1a5276;margin-bottom:4px">Visa qualité</div>
      <div style="font-size:11px">___________________</div>
      <div style="font-size:10px;color:#555;margin-top:4px">Date : ___________________</div>
    </div>
  </div>

  <!-- Footer -->
  <div style="border-top:1px solid #1a5276;padding-top:6px;font-size:8.5px;color:#777;display:flex;justify-content:space-between;margin-top:14px">
    <span>COA ${coa.coa_ref} — Généré le ${now}</span>
    <span>Royal Palm Group — Groupe Ennour Investissement, Tozeur, Tunisie</span>
  </div>
</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=1200');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}
