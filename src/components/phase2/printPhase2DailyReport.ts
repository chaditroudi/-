import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FumigationCycle, CleaningCycle, HydrationCycle, TriageSession, FUMIGATION_PROTOCOL_CONFIG } from '@/types/phase2';

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

export function printPhase2DailyReport(
  data: {
    fumigation: FumigationCycle[];
    cleaning: CleaningCycle[];
    hydration: HydrationCycle[];
    triage: TriageSession[];
  },
  reportDate = new Date()
) {
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) {
    alert("Impossible d'ouvrir la fenêtre d'impression. Vérifiez que les popups sont autorisés.");
    return;
  }

  const dateStr = format(reportDate, 'EEEE dd MMMM yyyy', { locale: fr });
  const now = format(new Date(), "dd/MM/yyyy 'à' HH:mm", { locale: fr });

  // Filter to today
  const todayFum = data.fumigation.filter((c) => sameDay(c.created_at, reportDate));
  const todayNet = data.cleaning.filter((c) => sameDay(c.created_at, reportDate));
  const todayHyd = data.hydration.filter((c) => sameDay(c.created_at, reportDate));
  const todayTri = data.triage.filter((s) => sameDay(s.created_at, reportDate));

  // Fumigation stats
  const fumCompleted = todayFum.filter((c) => c.status === 'TERMINE');
  const fumCompliant = fumCompleted.filter((c) => c.duration_compliant && c.parameters_compliant);
  const fumKg = todayFum.reduce((s, c) => s + c.total_weight_kg, 0);

  // Nettoyage stats
  const netCompleted = todayNet.filter((c) => c.status === 'TERMINE');
  const avgYield = netCompleted.length > 0
    ? (netCompleted.reduce((s, c) => s + (c.yield_percent ?? 0), 0) / netCompleted.length).toFixed(1)
    : null;

  // Hydratation stats
  const hydCompleted = todayHyd.filter((c) => c.status === 'TERMINE' || c.status === 'NON_CONFORME');
  const hydConform = hydCompleted.filter((c) => c.conformity === 'VERT');

  // Triage stats
  const triCompleted = todayTri.filter((s) => s.status === 'TERMINE');
  const avgExtra = triCompleted.length > 0
    ? (triCompleted.reduce((s, t) => s + t.extra_percent, 0) / triCompleted.length).toFixed(1)
    : null;
  const avgReject = triCompleted.length > 0
    ? (triCompleted.reduce((s, t) => s + t.reject_percent, 0) / triCompleted.length).toFixed(1)
    : null;
  const triKg = triCompleted.reduce((s, t) => s + t.total_sorted_kg, 0);

  const fumRows = todayFum.map((c) => `
    <tr>
      <td><code>${esc(c.cycle_number)}</code></td>
      <td>${esc(c.chamber)}</td>
      <td>${esc(FUMIGATION_PROTOCOL_CONFIG[c.protocol].label.split(' (')[0])}</td>
      <td class="num">${c.total_weight_kg.toLocaleString('fr-TN')} kg</td>
      <td>${esc(c.t0_start ? format(new Date(c.t0_start), 'HH:mm') : '—')}</td>
      <td>${esc(c.status)}</td>
      <td class="center">${c.status === 'TERMINE' ? (c.duration_compliant && c.parameters_compliant ? '✓' : '✗') : '—'}</td>
    </tr>`).join('');

  const netRows = todayNet.map((c) => `
    <tr>
      <td><code>${esc(c.cycle_number)}</code></td>
      <td>${esc(c.lot_number)}</td>
      <td class="center">${esc(c.program)}</td>
      <td class="num">${c.weight_in_kg != null ? c.weight_in_kg.toLocaleString('fr-TN') + ' kg' : '—'}</td>
      <td class="num">${c.weight_out_kg != null ? c.weight_out_kg.toLocaleString('fr-TN') + ' kg' : '—'}</td>
      <td class="num ${c.yield_percent != null && c.yield_percent < 92 ? 'warn' : ''}">${c.yield_percent != null ? c.yield_percent + '%' : '—'}</td>
      <td>${esc(c.status === 'TERMINE' ? 'Terminé' : c.status)}</td>
    </tr>`).join('');

  const hydRows = todayHyd.map((c) => `
    <tr>
      <td><code>${esc(c.cycle_number)}</code></td>
      <td>${esc(c.chamber)}</td>
      <td>${esc(c.program_applied)}</td>
      <td class="num">${c.humidity_in_percent != null ? c.humidity_in_percent + '%' : '—'}</td>
      <td class="num">${c.humidity_out_avg != null ? c.humidity_out_avg + '%' : '—'}</td>
      <td class="center ${c.conformity === 'VERT' ? 'ok' : c.conformity === 'ROUGE' ? 'warn' : ''}">${c.conformity ?? '—'}</td>
    </tr>`).join('');

  const triRows = todayTri.map((s) => `
    <tr>
      <td><code>${esc(s.session_number)}</code></td>
      <td class="center">${esc(s.line)}</td>
      <td>${esc(s.parent_lot_number)}</td>
      <td class="num">${s.total_sorted_kg.toLocaleString('fr-TN')} kg</td>
      <td class="num">${s.extra_percent}%</td>
      <td class="num">${s.cat1_percent}%</td>
      <td class="num ${s.reject_percent > 10 ? 'warn' : ''}">${s.reject_percent}%</td>
      <td>${esc(s.status === 'TERMINE' ? 'Terminé' : s.status)}</td>
    </tr>`).join('');

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Rapport journalier Phase 2 — ${esc(dateStr)}</title>
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
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #555; margin: 14px 0 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border-bottom: 1px solid #eee; padding: 5px 5px; text-align: left; }
    th { background: #f9fafb; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: .3px; }
    td.num, th.num { text-align: right; }
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
      <h1>Rapport journalier — Traitement Phase 2</h1>
      <p class="sub">${esc(dateStr)}</p>
    </div>
    <div class="logo">Royal Palm<small>Groupe Ennour Investissement, Tozeur</small></div>
  </div>

  <div class="stats">
    <div class="stat-card">
      <h3>🔥 Fumigation</h3>
      <div class="stat-row"><span>Cycles démarrés</span><span class="val">${todayFum.length}</span></div>
      <div class="stat-row"><span>Terminés</span><span class="val">${fumCompleted.length}</span></div>
      <div class="stat-row"><span>Conformes CCP</span><span class="val">${fumCompliant.length}/${fumCompleted.length}</span></div>
      <div class="stat-row"><span>Volume traité</span><span class="val">${fumKg.toLocaleString('fr-TN')} kg</span></div>
    </div>
    <div class="stat-card">
      <h3>💧 Nettoyage</h3>
      <div class="stat-row"><span>Cycles</span><span class="val">${todayNet.length}</span></div>
      <div class="stat-row"><span>Terminés</span><span class="val">${netCompleted.length}</span></div>
      <div class="stat-row"><span>Rendement moy.</span><span class="val">${avgYield != null ? avgYield + '%' : '—'}</span></div>
    </div>
    <div class="stat-card">
      <h3>💨 Hydratation</h3>
      <div class="stat-row"><span>Cycles</span><span class="val">${todayHyd.length}</span></div>
      <div class="stat-row"><span>Terminés</span><span class="val">${hydCompleted.length}</span></div>
      <div class="stat-row"><span>Conformes</span><span class="val">${hydConform.length}/${hydCompleted.length}</span></div>
    </div>
    <div class="stat-card">
      <h3>✂️ Triage</h3>
      <div class="stat-row"><span>Sessions</span><span class="val">${todayTri.length}</span></div>
      <div class="stat-row"><span>Volume trié</span><span class="val">${triKg.toLocaleString('fr-TN')} kg</span></div>
      <div class="stat-row"><span>Extra moy.</span><span class="val">${avgExtra != null ? avgExtra + '%' : '—'}</span></div>
      <div class="stat-row"><span>Rejet moy.</span><span class="val">${avgReject != null ? avgReject + '%' : '—'}</span></div>
    </div>
  </div>

  ${todayFum.length > 0 ? `
  <div class="section-title">Cycles de fumigation</div>
  <table>
    <thead><tr><th>N° cycle</th><th>Chambre</th><th>Protocole</th><th class="num">Poids</th><th>T0</th><th>Statut</th><th class="center">CCP</th></tr></thead>
    <tbody>${fumRows || '<tr><td colspan="7" style="text-align:center;color:#9ca3af">Aucun cycle</td></tr>'}</tbody>
  </table>` : ''}

  ${todayNet.length > 0 ? `
  <div class="section-title">Cycles nettoyage</div>
  <table>
    <thead><tr><th>N° cycle</th><th>Lot</th><th class="center">Prog.</th><th class="num">Entrée</th><th class="num">Sortie</th><th class="num">Rendement</th><th>Statut</th></tr></thead>
    <tbody>${netRows}</tbody>
  </table>` : ''}

  ${todayHyd.length > 0 ? `
  <div class="section-title">Cycles hydratation/séchage</div>
  <table>
    <thead><tr><th>N° cycle</th><th>Chambre</th><th>Programme</th><th class="num">Hum. entrée</th><th class="num">Hum. sortie</th><th class="center">Conformité</th></tr></thead>
    <tbody>${hydRows}</tbody>
  </table>` : ''}

  ${todayTri.length > 0 ? `
  <div class="section-title">Sessions triage</div>
  <table>
    <thead><tr><th>N° session</th><th class="center">Ligne</th><th>Lot parent</th><th class="num">Volume</th><th class="num">Extra</th><th class="num">Cat I</th><th class="num">Rejet</th><th>Statut</th></tr></thead>
    <tbody>${triRows}</tbody>
  </table>` : ''}

  <div class="sig-section">
    <div class="sig-box">Responsable production</div>
    <div class="sig-box">Responsable qualité</div>
    <div class="sig-box">Directeur usine</div>
  </div>

  <div class="footer">
    Généré le ${esc(now)} · Rapport Phase 2 — MES Royal Palm · Groupe Ennour Investissement Tozeur
  </div>

  <script>setTimeout(function(){window.print();},200);</script>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
}
