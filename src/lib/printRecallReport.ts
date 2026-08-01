/**
 * Printable recall dossier — HTML → browser print / Save as PDF.
 * Uses trust recall drill payload (upstream / downstream / shipments / palettes).
 */

import type { RecallDrillResult } from '@/lib/api/trust';

export type RecallReportMeta = {
  companyName?: string;
  plantName?: string;
  coordinator?: string | null;
  preparedBy?: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    });
  } catch {
    return iso;
  }
}

function nodesTable(
  title: string,
  nodes: RecallDrillResult['upstream'],
): string {
  const rows =
    nodes.length === 0
      ? `<tr><td colspan="4" class="muted">Aucun nœud</td></tr>`
      : nodes
          .map(
            (n) => `<tr>
      <td>${escapeHtml(n.label)}</td>
      <td>${escapeHtml(n.type)}</td>
      <td>${escapeHtml(n.sublabel || '—')}</td>
      <td>${escapeHtml(n.status || '—')}</td>
    </tr>`,
          )
          .join('');
  return `
    <h2>${escapeHtml(title)} (${nodes.length})</h2>
    <table>
      <thead><tr><th>Élément</th><th>Type</th><th>Détail</th><th>Statut</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function buildRecallReportHtml(
  result: RecallDrillResult,
  meta: RecallReportMeta = {},
): string {
  const company = meta.companyName || 'Royal Palm Dates';
  const plant = meta.plantName || 'Usine';
  const coordinator = meta.coordinator?.trim() || 'Non renseigné (Paramètres → Qualité)';
  const preparedBy = meta.preparedBy?.trim() || 'Opérateur système';

  const shipRows =
    result.impactedShipments.length === 0
      ? `<tr><td colspan="3" class="muted">Aucune expédition liée</td></tr>`
      : result.impactedShipments
          .map(
            (s) => `<tr>
      <td>${escapeHtml(s.reference || s.id || '—')}</td>
      <td>${escapeHtml(s.customer || '—')}</td>
      <td>${escapeHtml(s.status || '—')}</td>
    </tr>`,
          )
          .join('');

  const palRows =
    result.impactedPalettes.length === 0
      ? `<tr><td colspan="3" class="muted">Aucune palette liée</td></tr>`
      : result.impactedPalettes
          .map(
            (p) => `<tr>
      <td>${escapeHtml(p.palette_number || p.id || '—')}</td>
      <td>${escapeHtml(p.sscc || '—')}</td>
      <td>${escapeHtml(p.status || '—')}</td>
    </tr>`,
          )
          .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Rapport recall — ${escapeHtml(result.lotNumber)}</title>
  <style>
    body { font-family: system-ui, Segoe UI, sans-serif; max-width: 900px; margin: 24px auto; color: #111; line-height: 1.4; font-size: 13px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .06em; color: #444; margin: 22px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
    .banner { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 18px; }
    .chip { border: 1px solid #ccc; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 600; }
    .ok { background: #ecfdf5; border-color: #6ee7b7; color: #065f46; }
    .bad { background: #fef2f2; border-color: #fca5a5; color: #991b1b; }
    .warn { background: #fffbeb; border-color: #fcd34d; color: #92400e; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    .muted { color: #888; font-style: italic; }
    .box { border: 1px solid #f59e0b; background: #fffbeb; padding: 10px 12px; border-radius: 8px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0; }
    .stat { border: 1px solid #e5e5e5; border-radius: 8px; padding: 8px; }
    .stat b { display: block; font-size: 18px; }
    .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 28px; }
    .sign div { border-top: 1px solid #333; padding-top: 8px; min-height: 64px; }
    @media print { body { margin: 12px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <p class="meta">${escapeHtml(company)} · ${escapeHtml(plant)} · Rapport de rappel / recall drill</p>
  <h1>Dossier recall — ${escapeHtml(result.lotNumber)}</h1>
  <p class="meta">
    Lot résolu : <strong>${escapeHtml(result.resolvedLotId)}</strong><br/>
    Exécuté le ${escapeHtml(formatWhen(result.ranAt))} · Durée ${result.elapsedMs}&nbsp;ms
    (cible &lt;&nbsp;${result.targetSeconds}s)
  </p>

  <div class="banner">
    <span class="chip ${result.under60s ? 'ok' : 'warn'}">
      ${result.under60s ? 'Sous 60 s' : 'Au-delà de 60 s'}
    </span>
    <span class="chip ${result.valid ? 'ok' : 'bad'}">
      Chaîne hash ${result.valid ? 'valide' : 'cassée'}
    </span>
    <span class="chip">Vague ${escapeHtml(result.wave)}</span>
  </div>

  <div class="grid">
    <div class="stat"><b>${result.stats.nodeCount}</b>Nœuds</div>
    <div class="stat"><b>${result.stats.upstreamCount}</b>Amont</div>
    <div class="stat"><b>${result.stats.downstreamCount}</b>Aval</div>
    <div class="stat"><b>${result.stats.shipmentCount}</b>Expéditions</div>
  </div>

  <div class="box">
    <strong>Coordinateur recall :</strong> ${escapeHtml(coordinator)}<br/>
    <strong>Préparé par :</strong> ${escapeHtml(preparedBy)}<br/>
    <strong>Tip hash :</strong> <code>${escapeHtml(result.tipHash || '—')}</code>
  </div>

  ${nodesTable('Amont (fournisseurs / réception / process)', result.upstream)}
  ${nodesTable('Aval (grades / PF / clients)', result.downstream)}

  <h2>Expéditions impactées (${result.impactedShipments.length})</h2>
  <table>
    <thead><tr><th>Référence</th><th>Client</th><th>Statut</th></tr></thead>
    <tbody>${shipRows}</tbody>
  </table>

  <h2>Palettes impactées (${result.impactedPalettes.length})</h2>
  <table>
    <thead><tr><th>Palette</th><th>SSCC</th><th>Statut</th></tr></thead>
    <tbody>${palRows}</tbody>
  </table>

  <h2>Actions recommandées</h2>
  <ol>
    <li>Isoler physiquement les palettes / lots listés ci-dessus.</li>
    <li>Notifier le coordinateur recall et la Direction Qualité.</li>
    <li>Bloquer les expéditions ouvertes liées (statut bloqué / recall).</li>
    <li>Conserver ce rapport + passeport lot dans le dossier audit.</li>
  </ol>

  <div class="sign">
    <div>Visa Qualité<br/><span class="muted">Nom / date</span></div>
    <div>Visa Direction<br/><span class="muted">Nom / date</span></div>
  </div>

  <p class="meta" style="margin-top:24px">
    Document généré par Date Harvest Hub · usage audit / exercice de rappel ·
    ${escapeHtml(formatWhen(new Date().toISOString()))}
  </p>
</body>
</html>`;
}

export function printRecallReport(
  result: RecallDrillResult,
  meta: RecallReportMeta = {},
): void {
  const html = buildRecallReportHtml(result, meta);
  const w = window.open('', '_blank', 'noopener,noreferrer,width=920,height=1000');
  if (!w) {
    throw new Error('Pop-up bloquée — autorisez les fenêtres pour imprimer le rapport.');
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
