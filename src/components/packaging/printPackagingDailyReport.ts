import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PackagingOrder, PackagingKpis } from '@/types/packaging';

const esc = (s: string | number | null | undefined) =>
  String(s ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const sameDay = (isoDate: string | null | undefined, reportDate: Date) => {
  if (!isoDate) return false;
  const d = new Date(isoDate);
  return (
    d.getFullYear() === reportDate.getFullYear() &&
    d.getMonth() === reportDate.getMonth() &&
    d.getDate() === reportDate.getDate()
  );
};

export function printPackagingDailyReport(
  orders: PackagingOrder[],
  kpis: PackagingKpis | null,
  reportDate = new Date(),
) {
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) {
    alert("Impossible d'ouvrir la fenêtre d'impression. Vérifiez que les popups sont autorisés.");
    return;
  }

  const dateStr = format(reportDate, 'EEEE dd MMMM yyyy', { locale: fr });
  const now = format(new Date(), "dd/MM/yyyy 'à' HH:mm", { locale: fr });

  const todayOrders = orders.filter((o) => sameDay(o.created_at, reportDate) || sameDay(o.started_at, reportDate));

  const completedOrders = todayOrders.filter((o) => o.status === 'TERMINE');
  const activeOrders = todayOrders.filter((o) => o.status === 'EN_COURS');
  const totalProduced = todayOrders.reduce((s, o) => s + (o.produced_units ?? 0), 0);
  const totalTarget = todayOrders.reduce((s, o) => s + (o.target_units ?? 0), 0);
  const totalRejected = todayOrders.reduce((s, o) => s + (o.rejected_units ?? 0), 0);
  const totalMetalFailures = todayOrders.reduce((s, o) => s + (o.metal_detector_failures ?? 0), 0);
  const totalCheckFailures = todayOrders.reduce((s, o) => s + (o.checkweigher_failures ?? 0), 0);
  const yieldPct = totalTarget > 0 ? ((totalProduced / totalTarget) * 100).toFixed(1) : null;
  const rejectionPct = totalProduced > 0 ? ((totalRejected / totalProduced) * 100).toFixed(1) : null;

  const orderRows = todayOrders.map((o) => {
    const orderYield = o.target_units > 0 ? ((o.produced_units / o.target_units) * 100).toFixed(0) : '—';
    const rejPct = o.produced_units > 0 ? ((o.rejected_units / o.produced_units) * 100).toFixed(1) : '0.0';
    const checkPct = o.checkweigher_count > 0 ? ((o.checkweigher_failures / o.checkweigher_count) * 100).toFixed(1) : '0.0';
    const statusLabel = { PLANIFIE: 'Planifié', EN_COURS: 'En cours', PAUSE: 'Pause', TERMINE: 'Terminé', ANNULE: 'Annulé' }[o.status] ?? o.status;
    return `
    <tr>
      <td><code>${esc(o.order_number)}</code></td>
      <td>${esc(o.bom_name)} <span style="color:#6b7280;font-size:10px">G.${esc(o.grade)}</span></td>
      <td class="center">${esc(o.line)}</td>
      <td class="num">${o.source_weight_kg.toLocaleString('fr-TN')} kg</td>
      <td class="num">${o.produced_units} / ${o.target_units}</td>
      <td class="num ${Number(orderYield) < 90 ? 'warn' : ''}">${orderYield}%</td>
      <td class="num ${Number(rejPct) > 2 ? 'warn' : ''}">${rejPct}%</td>
      <td class="num ${o.metal_detector_failures > 0 ? 'warn' : ''}">${o.metal_detector_failures > 0 ? '⚠ ' + o.metal_detector_failures : '0'}</td>
      <td class="num ${Number(checkPct) > 2 ? 'warn' : ''}">${checkPct}%</td>
      <td>${esc(o.operator_name)}</td>
      <td>${esc(statusLabel)}</td>
    </tr>`;
  }).join('');

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Rapport journalier Conditionnement — ${esc(dateStr)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 22px; color: #111; font-size: 12px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 2px solid #166534; padding-bottom: 10px; }
    h1 { font-size: 18px; font-weight: 700; margin: 0; }
    .sub { color: #555; font-size: 11px; margin-top: 2px; }
    .logo { text-align: right; font-size: 14px; font-weight: 700; color: #166534; }
    .logo small { display: block; font-size: 10px; font-weight: 400; color: #666; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
    .stat-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; }
    .stat-card h3 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #6b7280; margin: 0 0 6px; }
    .stat-row { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; }
    .val { font-weight: 700; }
    .val.alert { color: #991b1b; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #555; margin: 14px 0 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border-bottom: 1px solid #eee; padding: 5px; text-align: left; }
    th { background: #f9fafb; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: .3px; }
    td.num { text-align: right; }
    td.center { text-align: center; }
    td.ok { color: #166534; font-weight: 700; }
    td.warn { color: #991b1b; font-weight: 700; }
    code { font-family: monospace; font-size: 10px; background: #f3f4f6; padding: 1px 4px; border-radius: 2px; }
    .sig-section { display: flex; justify-content: space-between; margin-top: 22px; }
    .sig-box { border-top: 1px solid #333; padding-top: 5px; width: 160px; font-size: 10px; color: #666; }
    .footer { margin-top: 16px; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
    @media print { body { padding: 10px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Rapport journalier — Conditionnement</h1>
      <p class="sub">${esc(dateStr)}</p>
    </div>
    <div class="logo">Royal Palm<small>Groupe Ennour Investissement, Tozeur</small></div>
  </div>

  <div class="stats">
    <div class="stat-card">
      <h3>📦 Ordres du jour</h3>
      <div class="stat-row"><span>Total</span><span class="val">${todayOrders.length}</span></div>
      <div class="stat-row"><span>En cours</span><span class="val">${activeOrders.length}</span></div>
      <div class="stat-row"><span>Terminés</span><span class="val">${completedOrders.length}</span></div>
    </div>
    <div class="stat-card">
      <h3>🏭 Production</h3>
      <div class="stat-row"><span>Unités produites</span><span class="val">${totalProduced.toLocaleString('fr-TN')}</span></div>
      <div class="stat-row"><span>Objectif</span><span class="val">${totalTarget.toLocaleString('fr-TN')}</span></div>
      <div class="stat-row"><span>Rendement</span><span class="val">${yieldPct != null ? yieldPct + '%' : '—'}</span></div>
    </div>
    <div class="stat-card">
      <h3>✅ Qualité</h3>
      <div class="stat-row"><span>Rejets</span><span class="val ${totalRejected > 0 ? 'alert' : ''}">${totalRejected} (${rejectionPct ?? '—'}%)</span></div>
      <div class="stat-row"><span>Éch. pondéral</span><span class="val ${totalCheckFailures > 0 ? 'alert' : ''}">${totalCheckFailures}</span></div>
      <div class="stat-row"><span>Détection métal</span><span class="val ${totalMetalFailures > 0 ? 'alert' : ''}">${totalMetalFailures > 0 ? '⚠ ' + totalMetalFailures : '0'}</span></div>
    </div>
    <div class="stat-card">
      <h3>🎁 Palettes</h3>
      <div class="stat-row"><span>Scellées aujourd'hui</span><span class="val">${kpis?.palettes_sealed_today ?? '—'}</span></div>
      <div class="stat-row"><span>En cours</span><span class="val">${kpis?.active_orders ?? '—'}</span></div>
    </div>
  </div>

  ${todayOrders.length > 0 ? `
  <div class="section-title">Ordres de conditionnement</div>
  <table>
    <thead>
      <tr>
        <th>N° OF</th>
        <th>Nomenclature</th>
        <th class="center">Ligne</th>
        <th class="num">Lot source</th>
        <th class="num">Prod / Obj</th>
        <th class="num">Rendement</th>
        <th class="num">Rejet</th>
        <th class="num">Métal</th>
        <th class="num">Pond.</th>
        <th>Opérateur</th>
        <th>Statut</th>
      </tr>
    </thead>
    <tbody>${orderRows || '<tr><td colspan="11" style="text-align:center;color:#9ca3af">Aucun ordre</td></tr>'}</tbody>
  </table>` : '<p style="color:#9ca3af;font-style:italic;margin:12px 0">Aucun ordre de conditionnement créé ce jour.</p>'}

  <div class="sig-section">
    <div class="sig-box">Chef de ligne</div>
    <div class="sig-box">Responsable qualité</div>
    <div class="sig-box">Directeur usine</div>
  </div>

  <div class="footer">
    Généré le ${esc(now)} · Rapport Conditionnement — MES Royal Palm · Groupe Ennour Investissement Tozeur
  </div>

  <script>setTimeout(function(){window.print();},200);</script>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
}
