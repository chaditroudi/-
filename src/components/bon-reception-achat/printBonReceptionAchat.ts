import type { BonReceptionAchat, BranchLine, BranchSeche } from "@/types/bonReceptionAchat";

const e = (v: string | number | null | undefined) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const num = (v: number | null | undefined) => (v != null ? String(v) : "");

const branchRows = (title: string, branch: BranchLine, deltaLabel?: string) => `
  <tr class="branch-header">
    <td class="label">${e(title)}</td>
    <td>${num(branch.gc)}</td>
    <td>${num(branch.rp)}</td>
    <td>${num(branch.gcm)}</td>
    <td>${num(branch.l)}</td>
    <td>${num(branch.poid_brut)}</td>
    <td>${num(branch.poid_net)}</td>
  </tr>
  <tr class="sub-row">
    <td class="label">Nbre de palette</td>
    <td colspan="5">${num(branch.nbre_palette)}</td>
    <td class="neg">${deltaLabel ?? ""}</td>
  </tr>
  <tr class="sub-row">
    <td class="label">Observation</td>
    <td colspan="6">${e(branch.observation)}</td>
  </tr>`;

const branchSecheRows = (bs: BranchSeche) => {
  const delta = bs.poid_brut != null && bs.poid_net != null ? bs.poid_brut - bs.poid_net : null;
  return `
  <tr class="branch-header">
    <td class="label">Branche Sèche</td>
    <td>${num(bs.gc)}</td>
    <td>${num(bs.rp)}</td>
    <td>${num(bs.gcm)}</td>
    <td>${num(bs.l)}</td>
    <td>${num(bs.poid_brut)}</td>
    <td>${num(bs.poid_net)}</td>
  </tr>
  <tr class="sub-row">
    <td class="label">Nbre de palette</td>
    <td colspan="2" class="pos">${bs.nbre_palette_ajout != null ? "+" + bs.nbre_palette_ajout : ""}</td>
    <td colspan="2" class="neg">${bs.nbre_palette_retrait != null ? "-" + bs.nbre_palette_retrait : ""}</td>
    <td></td>
    <td class="neg">${delta != null ? "-" + delta : ""}</td>
  </tr>
  <tr class="sub-row">
    <td class="label">Observations</td>
    <td colspan="6">${e(bs.observation)}</td>
  </tr>`;
};

export function printBonReceptionAchat(bon: BonReceptionAchat) {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) { alert("Autorisez les popups pour imprimer."); return; }

  const b2Delta = bon.branche_deuxieme.poid_brut != null && bon.branche_deuxieme.poid_net != null
    ? "-" + (bon.branche_deuxieme.poid_brut - bon.branche_deuxieme.poid_net)
    : "";

  const casseRows = bon.casse.length
    ? `<tr class="sub-row"><td class="label">Nature</td><td colspan="6">${bon.casse.map((c) => e(c.nature)).join(" / ")}</td></tr>
       <tr class="sub-row"><td class="label">Quantité</td><td colspan="6">${bon.casse.map((c) => num(c.quantite)).join(" / ")}</td></tr>`
    : `<tr class="sub-row"><td class="label">Nature</td><td colspan="6"></td></tr>
       <tr class="sub-row"><td class="label">Quantité</td><td colspan="6"></td></tr>`;

  const statutLabel = bon.statut === "valide" ? "✓ Validé" : bon.statut === "annule" ? "✗ Annulé" : "Brouillon";

  win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>BRA ${e(bon.numero_bon)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:11px;color:#111;background:#fff;padding:10mm}
  @page{size:A4 portrait;margin:0}
  @media print{body{padding:10mm}}

  .page{width:190mm}

  /* Header */
  .header{display:flex;border:2px solid #1a5276;margin-bottom:4px}
  .logo-cell{min-width:110px;border-right:1px solid #1a5276;display:flex;align-items:center;justify-content:center;padding:6px 10px;flex-direction:column;gap:1px}
  .logo-text{color:#107754;font-weight:bold;font-size:15px;line-height:1.1}
  .logo-sub{color:#888;font-size:8px}
  .title-cell{flex:1;border-right:1px solid #1a5276;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px}
  .bon-title{color:#1a5276;font-weight:bold;font-size:13px;text-align:center}
  .checkboxes{display:flex;gap:24px;margin-top:5px;font-size:10px}
  .cb{display:inline-flex;align-items:center;gap:4px}
  .cb-box{width:14px;height:14px;border:1px solid #1a5276;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold}
  .meta-cell{min-width:130px;display:flex;flex-direction:column;justify-content:space-between;padding:6px 10px}
  .meta-annee{font-size:10px}
  .meta-bon{font-weight:bold;font-size:13px;color:#1a5276}
  .meta-statut{font-size:9px;color:#555}

  /* Info rows */
  .info-row{display:flex;gap:4px;margin-bottom:3px;font-size:10px}
  .info-cell{border:1px solid #1a5276;padding:3px 6px;flex:1}
  .info-cell.narrow{flex:none;min-width:150px}
  .lbl{font-weight:600}

  /* Region */
  .region-row{display:flex;gap:4px;margin-bottom:3px;font-size:10px}
  .region-cell{border:1px solid #1a5276;padding:3px 8px;display:flex;gap:16px;align-items:center}

  /* Main layout */
  .main-layout{display:flex;gap:4px;margin-top:4px}

  /* Table */
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #1a5276;padding:3px 5px;text-align:center;font-size:10px}
  th{background:#1a5276;color:#fff;font-size:10px}
  td.label{text-align:left;background:#eaf4fb;font-weight:500}
  tr.branch-header td{background:#f0f7fb}
  tr.sub-row td{background:#fff}
  tr.casse-header td{background:#d6eaf8;font-weight:bold;text-align:left}
  td.neg{color:#c0392b}
  td.pos{color:#1a7a4a}

  /* Right column */
  .right-col{display:flex;flex-direction:column;gap:3px;min-width:140px}
  .right-cell{border:1px solid #1a5276;padding:4px 6px;font-size:10px}
  .right-label{color:#1a5276;font-weight:600;margin-bottom:1px;font-size:9px}
  .right-value{font-size:11px}

  /* Footer */
  .footer{border-top:1px solid #1a5276;margin-top:4px;padding-top:3px;display:flex;justify-content:space-between;font-size:8px;color:#666}
  .version{font-weight:bold;color:#1a5276;font-size:10px}
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="logo-cell">
      <span class="logo-text">Royal</span>
      <span class="logo-text">Palm</span>
      <span class="logo-sub">Group</span>
    </div>
    <div class="title-cell">
      <div class="bon-title">BON DE RECEPTION ACHAT</div>
      <div class="checkboxes">
        <span class="cb"><span class="cb-box">${bon.convention ? "✓" : ""}</span> Convention</span>
        <span class="cb"><span class="cb-box">${bon.bio_certifie ? "✓" : ""}</span> TN-Bio-001</span>
      </div>
    </div>
    <div class="meta-cell">
      <div class="meta-annee">Année&nbsp;: <strong>${e(bon.annee)}</strong></div>
      <div class="meta-bon">${e(bon.numero_bon)}</div>
      <div class="meta-statut">${e(statutLabel)}</div>
    </div>
  </div>

  <!-- Info rows -->
  <div class="info-row">
    <div class="info-cell">
      <span class="lbl">N° Bon d'expédition&nbsp;:</span> ${e(bon.numero_expedition)}
      &nbsp;&nbsp;<span class="lbl">Lieu&nbsp;:</span> ${e(bon.lieu_expedition)}
    </div>
    <div class="info-cell narrow"><span class="lbl">Date&nbsp;:</span> ${e(bon.date_reception)}</div>
  </div>
  <div class="info-row">
    <div class="info-cell">
      <span class="lbl">Fournisseur&nbsp;:</span> <strong>${e(bon.fournisseur_nom)}</strong>
      &nbsp;&nbsp;<span class="lbl">N° Facture&nbsp;:</span> ${e(bon.numero_facture)}
    </div>
    <div class="info-cell narrow"><span class="lbl">H. Arrivée&nbsp;:</span> ${e(bon.heure_arrivee)}</div>
  </div>
  <div class="region-row">
    <div class="region-cell">
      <span class="cb"><span class="cb-box">${bon.region === "el_jirid" ? "✓" : ""}</span> El jirid</span>
      <span class="cb"><span class="cb-box">${bon.region === "kebilli" ? "✓" : ""}</span> Kebilli</span>
    </div>
    <div class="info-cell"><span class="lbl">N° de Lot&nbsp;:</span> ${e(bon.numero_lot)}</div>
  </div>

  <!-- Main layout -->
  <div class="main-layout">
    <!-- Table -->
    <table style="flex:1">
      <thead>
        <tr>
          <th style="text-align:left">Type</th>
          <th>GC</th><th>RP</th><th>GCM</th><th>L</th>
          <th>Poid Brut</th><th>Poid Net</th>
        </tr>
      </thead>
      <tbody>
        ${branchRows("Branche 1ère", bon.branche_premiere)}
        ${branchRows("Branche 2ème", bon.branche_deuxieme, b2Delta)}
        ${branchRows("Vrac", bon.vrac)}
        ${branchSecheRows(bon.branche_seche)}
        <tr class="casse-header"><td colspan="7">Casse</td></tr>
        ${casseRows}
      </tbody>
    </table>

    <!-- Right column -->
    <div class="right-col">
      <div class="right-cell"><div class="right-label">Camion</div><div class="right-value">${e(bon.numero_camion)}</div></div>
      <div class="right-cell"><div class="right-label">Chauffeur</div><div class="right-value">${e(bon.nom_chauffeur)}</div></div>
      <div class="right-cell"><div class="right-label">Lieu de réception</div><div class="right-value">${e(bon.lieu_reception)}</div></div>
      <div class="right-cell"><div class="right-label">Responsable réception</div><div class="right-value">${e(bon.responsable_reception)}</div></div>
      <div class="right-cell"><div class="right-label">N° Rapport QCR</div><div class="right-value">${e(bon.numero_rapport_qcr)}</div></div>
      <div class="right-cell"><div class="right-label">N° fiche palette</div><div class="right-value">${e(bon.numero_fiche_palette)}</div></div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>(*) GC : Grand Caisse / P : Plateau / L : Lame / GCR : GC Royal / GCI : GC jaune / GCN : GC Bleu</span>
    <span class="version">V01 - ${e(bon.annee)}</span>
  </div>

</div>
<script>window.onload=()=>{ window.print(); window.onafterprint=()=>window.close(); }</script>
</body>
</html>`);
  win.document.close();
}
