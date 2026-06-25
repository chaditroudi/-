import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FumigationCycle, FUMIGATION_PROTOCOL_CONFIG } from '@/types/phase2';

const esc = (s: string | number | null | undefined) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const fmt = (iso: string | null) =>
  iso ? format(new Date(iso), "dd/MM/yyyy 'à' HH:mm", { locale: fr }) : '—';

const minutes_to_hm = (min: number | null) => {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m.toString().padStart(2, '0')}`;
};

export function printFumigationCertificate(cycle: FumigationCycle) {
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) {
    alert("Impossible d'ouvrir la fenêtre d'impression. Vérifiez que les popups sont autorisés.");
    return;
  }

  const protoConfig = FUMIGATION_PROTOCOL_CONFIG[cycle.protocol];
  const now = format(new Date(), "dd/MM/yyyy 'à' HH:mm", { locale: fr });
  const isCompliant =
    cycle.duration_compliant === true && cycle.parameters_compliant === true;

  const lotRows = (cycle.lot_refs ?? [])
    .map(
      (l) =>
        `<tr>
          <td>${esc(l.lot_number)}</td>
          <td>${esc(l.variety ?? '—')}</td>
          <td class="num">${Number(l.weight_kg || 0).toLocaleString('fr-TN')} kg</td>
          <td>${l.is_bio ? '<span class="badge bio">BIO</span>' : '—'}</td>
        </tr>`
    )
    .join('');

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Certificat de fumigation — ${esc(cycle.cycle_number)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 24px; color: #111; font-size: 12px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 2px solid #166534; padding-bottom: 12px; }
    h1 { font-size: 18px; font-weight: 700; margin: 0; color: #166534; }
    .sub { color: #555; font-size: 11px; margin-top: 3px; }
    .logo { text-align: right; font-size: 14px; font-weight: 700; color: #166534; }
    .logo small { display: block; font-size: 10px; font-weight: 400; color: #666; }
    .status-box { display: inline-block; padding: 6px 14px; border-radius: 4px; font-weight: 700; font-size: 13px; margin-bottom: 14px; }
    .status-ok { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
    .status-nok { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 14px; }
    .section { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; }
    .section h2 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #6b7280; margin: 0 0 8px; }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; }
    dt { color: #6b7280; font-weight: 400; white-space: nowrap; }
    dd { font-weight: 600; margin: 0; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
    th, td { border-bottom: 1px solid #eee; padding: 5px 6px; text-align: left; }
    th { background: #f9fafb; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: .3px; }
    td.num, th.num { text-align: right; }
    .badge { display: inline-block; padding: 1px 6px; border-radius: 9px; font-size: 10px; font-weight: 600; }
    .badge.bio { background: #d1fae5; color: #065f46; }
    .sig-section { margin-top: 20px; display: flex; justify-content: space-between; gap: 16px; }
    .sig-box { flex: 1; border-top: 1px solid #333; padding-top: 6px; }
    .sig-name { font-weight: 700; font-size: 12px; }
    .sig-time { font-size: 10px; color: #666; }
    .sig-label { font-size: 10px; color: #888; margin-top: 2px; }
    .footer { margin-top: 16px; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; display: flex; justify-content: space-between; }
    .ccp-warn { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 4px; padding: 6px 10px; font-size: 11px; color: #92400e; margin-bottom: 10px; }
    @media print {
      body { padding: 12px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <h1>Certificat de fumigation</h1>
      <p class="sub">CCP-1 Royal Palm — Module 5 | Réf: RG-FUM-14</p>
    </div>
    <div class="logo">
      Royal Palm
      <small>Groupe Ennour Investissement, Tozeur</small>
      <small>Date d'émission: ${esc(now)}</small>
    </div>
  </div>

  <div class="${isCompliant ? 'status-box status-ok' : 'status-box status-nok'}">
    ${isCompliant ? '✓ CYCLE CONFORME — Lots autorisés à traitement suivant' : '✗ CYCLE NON CONFORME — Action qualité requise'}
  </div>

  ${!isCompliant ? `<div class="ccp-warn">⚠ Ce certificat signale une non-conformité CCP. Lot mis en quarantaine. Notifier immédiatement le Responsable Qualité.</div>` : ''}

  <div class="grid-2">
    <div class="section">
      <h2>Identification cycle</h2>
      <dl>
        <dt>N° cycle</dt><dd>${esc(cycle.cycle_number)}</dd>
        <dt>Chambre</dt><dd>${esc(cycle.chamber)}</dd>
        <dt>Protocole</dt><dd>${esc(protoConfig.label)}</dd>
        <dt>Statut</dt><dd>${esc(cycle.status)}</dd>
        <dt>Lots bio</dt><dd>${cycle.has_bio_lots ? 'Oui' : 'Non'}</dd>
        <dt>Poids total</dt><dd>${Number(cycle.total_weight_kg || 0).toLocaleString('fr-TN')} kg</dd>
        <dt>Taux remplissage</dt><dd>${esc(cycle.fill_rate_percent)}%</dd>
      </dl>
    </div>
    <div class="section">
      <h2>Paramètres CCP</h2>
      <dl>
        <dt>T0 démarrage</dt><dd>${fmt(cycle.t0_start)}</dd>
        <dt>Fin réelle</dt><dd>${fmt(cycle.t_end_real)}</dd>
        <dt>Durée réelle</dt><dd>${minutes_to_hm(cycle.duration_minutes)}</dd>
        <dt>Durée min requise</dt><dd>${minutes_to_hm(cycle.minimum_duration_minutes)}</dd>
        <dt>Durée conforme</dt><dd>${cycle.duration_compliant === true ? '✓ Oui' : cycle.duration_compliant === false ? '✗ Non' : '—'}</dd>
        <dt>Paramètres conformes</dt><dd>${cycle.parameters_compliant === true ? '✓ Oui' : cycle.parameters_compliant === false ? '✗ Non' : '—'}</dd>
        <dt>Conc. résiduelle</dt><dd>${cycle.residual_concentration_ppm != null ? `${cycle.residual_concentration_ppm} ppm` : '—'}</dd>
        <dt>VLE résiduelle OK</dt><dd>${cycle.residual_tlv_compliant === true ? '✓ Oui' : cycle.residual_tlv_compliant === false ? '✗ Non' : '—'}</dd>
      </dl>
    </div>
  </div>

  <div class="grid-2">
    <div class="section">
      <h2>Produit utilisé</h2>
      <dl>
        <dt>Concentration cible</dt><dd>${esc(protoConfig.target_concentration)}</dd>
        <dt>Température cible</dt><dd>${esc(protoConfig.target_temperature)}</dd>
        <dt>Dose calculée</dt><dd>${cycle.dose_calculated_g != null ? `${cycle.dose_calculated_g} g` : '—'}</dd>
        <dt>Dose appliquée</dt><dd>${cycle.dose_applied_g != null ? `${cycle.dose_applied_g} g` : '—'}</dd>
        <dt>Écart dosage</dt><dd>${cycle.dose_variance_percent != null ? `${cycle.dose_variance_percent}%` : '—'}</dd>
        <dt>N° lot produit</dt><dd>${esc(cycle.product_lot_number)}</dd>
        <dt>Date expiration</dt><dd>${cycle.product_expiry_date ? format(new Date(cycle.product_expiry_date), 'dd/MM/yyyy') : '—'}</dd>
      </dl>
    </div>
    <div class="section">
      <h2>Lots traités (${(cycle.lot_refs ?? []).length})</h2>
      <table>
        <thead><tr><th>N° lot</th><th>Variété</th><th class="num">Poids</th><th>Type</th></tr></thead>
        <tbody>${lotRows || '<tr><td colspan="4" style="text-align:center;color:#9ca3af">Aucun lot</td></tr>'}</tbody>
      </table>
    </div>
  </div>

  <div class="sig-section">
    <div class="sig-box">
      <div class="sig-name">${cycle.operator_name ? esc(cycle.operator_name) : '____________________________'}</div>
      ${cycle.operator_signed_at ? `<div class="sig-time">${fmt(cycle.operator_signed_at)}</div>` : '<div style="height:14px"></div>'}
      <div class="sig-label">Opérateur fumigation</div>
    </div>
    <div class="sig-box">
      <div class="sig-name">${cycle.quality_inspector_name ? esc(cycle.quality_inspector_name) : '____________________________'}</div>
      ${cycle.quality_signed_at ? `<div class="sig-time">${fmt(cycle.quality_signed_at)}</div>` : '<div style="height:14px"></div>'}
      <div class="sig-label">Responsable Qualité / HACCP</div>
    </div>
    <div class="sig-box">
      <div class="sig-name">____________________________</div>
      <div style="height:14px"></div>
      <div class="sig-label">Directeur production</div>
    </div>
  </div>

  <div class="footer">
    <span>Généré le ${esc(now)} • CCP-1 Royal Palm Phase 2 • RG-FUM-14 — Conservation 7 ans obligatoire</span>
    <span>Système MES Royal Palm v2 — Groupe Ennour Investissement</span>
  </div>

  <script>setTimeout(function() { window.print(); }, 200);</script>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
}
