import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ReceptionV2, receptionStatusLabels } from '@/types/reception';

const esc = (s: string) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export function printDailyReceptionReport(receptions: ReceptionV2[], reportDate = new Date()) {
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) {
    alert("Impossible d'ouvrir la fenêtre d'impression. Vérifiez que les popups sont autorisés.");
    return;
  }

  const sameDay = (d: Date) =>
    d.getFullYear() === reportDate.getFullYear() &&
    d.getMonth() === reportDate.getMonth() &&
    d.getDate() === reportDate.getDate();

  const today = receptions.filter((r) => sameDay(new Date(r.created_at)));
  const dateStr = format(reportDate, 'EEEE dd MMMM yyyy', { locale: fr });
  const now = format(new Date(), "dd/MM/yyyy 'à' HH:mm", { locale: fr });

  const totalKg = today.reduce((s, r) => s + (Number(r.quantity_total) || 0), 0);
  const accepted = today.filter((r) => ['VALIDE', 'ACCEPTE'].includes(r.status)).length;
  const rejected = today.filter((r) => r.status === 'REJETE').length;
  const blocked = today.filter((r) => r.status === 'BLOQUE').length;

  const gradeCount: Record<string, number> = {};
  today.forEach((r) => {
    if (r.qc_grade) gradeCount[r.qc_grade] = (gradeCount[r.qc_grade] ?? 0) + 1;
  });
  const gradeRows = Object.entries(gradeCount)
    .map(([g, c]) => `<tr><td>${esc(g)}</td><td class="num">${c}</td></tr>`)
    .join('');

  const receptionRows = today
    .map(
      (r) => `<tr>
      <td><code>${esc(r.reception_number)}</code></td>
      <td>${esc(r.supplier?.name || '-')}</td>
      <td>${esc(r.variety || '-')}</td>
      <td class="num">${Number(r.quantity_total || 0).toLocaleString('fr-TN')} ${esc(r.unit || 'kg')}</td>
      <td>${esc(r.storage_zone_code || '-')}</td>
      <td>${esc(r.qc_grade || '-')}</td>
      <td>${esc(receptionStatusLabels[r.status] || r.status)}</td>
    </tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Rapport réception — ${esc(dateStr)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 28px; color: #111; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    h1 { font-size: 20px; font-weight: 700; margin: 0; }
    .sub { color: #555; font-size: 12px; margin-top: 3px; }
    .logo { font-size: 15px; font-weight: 700; color: #166534; }
    .logo small { display: block; font-size: 10px; font-weight: 400; color: #555; }
    .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
    .stat { border: 1px solid #ddd; border-radius: 6px; padding: 10px; text-align: center; }
    .stat .val { font-size: 22px; font-weight: 700; }
    .stat .lbl { font-size: 11px; color: #555; margin-top: 2px; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #555; margin: 18px 0 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border-bottom: 1px solid #eee; padding: 7px 6px; text-align: left; }
    th { background: #f7f7f7; font-weight: 700; }
    td.num, th.num { text-align: right; }
    code { font-family: monospace; font-size: 11px; background: #f3f4f6; padding: 1px 4px; border-radius: 3px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .footer { margin-top: 24px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
    .sig { display: flex; justify-content: space-between; margin-top: 24px; }
    .sig-box { border-top: 1px solid #333; width: 180px; padding-top: 4px; font-size: 11px; color: #555; }
    @media print {
      body { padding: 12px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Rapport journalier — Réception</h1>
      <p class="sub">${esc(dateStr)}</p>
    </div>
    <div class="logo">
      Royal Palm
      <small>Groupe Ennour Investissement, Tozeur</small>
    </div>
  </div>

  <div class="stats">
    <div class="stat"><div class="val">${today.length}</div><div class="lbl">Réceptions</div></div>
    <div class="stat"><div class="val">${totalKg.toLocaleString('fr-TN')} kg</div><div class="lbl">Volume total</div></div>
    <div class="stat"><div class="val">${accepted}</div><div class="lbl">Acceptés</div></div>
    <div class="stat"><div class="val">${rejected}</div><div class="lbl">Rejetés</div></div>
    <div class="stat"><div class="val">${blocked}</div><div class="lbl">Bloqués</div></div>
  </div>

  <div class="two-col">
    <div>
      <p class="section-title">Répartition grades QC</p>
      <table>
        <thead><tr><th>Grade</th><th class="num">Lots</th></tr></thead>
        <tbody>${gradeRows || '<tr><td colspan="2" style="color:#888;text-align:center">Aucune décision QC</td></tr>'}</tbody>
      </table>
    </div>
  </div>

  <p class="section-title">Détail des réceptions</p>
  <table>
    <thead>
      <tr>
        <th>N° réception</th>
        <th>Fournisseur</th>
        <th>Variété</th>
        <th class="num">Quantité</th>
        <th>Zone</th>
        <th>Grade QC</th>
        <th>Statut</th>
      </tr>
    </thead>
    <tbody>${receptionRows || '<tr><td colspan="7" style="text-align:center;color:#888;padding:20px">Aucune réception pour cette journée</td></tr>'}</tbody>
  </table>

  <div class="sig">
    <div class="sig-box">Responsable réception</div>
    <div class="sig-box">Responsable qualité</div>
    <div class="sig-box">Directeur production</div>
  </div>

  <p class="footer">
    Généré le ${esc(now)} • RG-Q11 Royal Palm Phase 1
    — Ce document constitue le rapport journalier de réception dattes.
  </p>

  <script>setTimeout(function() { window.print(); }, 200);</script>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
}
