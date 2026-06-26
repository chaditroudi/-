import type { QCInspection, RQCData, RQCCritere } from "@/types/reception";
import type { ReceptionV2 } from "@/types/reception";

const e = (v: string | number | null | undefined) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const pct = (v: number | null | undefined) => (v != null ? `${v}%` : "");

const avg = (c: RQCCritere) => {
  const vals = [c.test1, c.test2, c.test3].filter((v): v is number => v != null);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
};

const critereRow = (label: string, c: RQCCritere, highlight = false) => {
  const mean = c.taux_moyen ?? avg(c);
  return `<tr${highlight ? ' class="highlight"' : ""}>
    <td class="label">${e(label)}</td>
    <td>${pct(c.test1)}</td>
    <td>${pct(c.test2)}</td>
    <td>${pct(c.test3)}</td>
    <td class="mean">${pct(mean)}</td>
  </tr>`;
};

export function printRQC(inspection: QCInspection, reception: ReceptionV2) {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) { alert("Autorisez les popups pour imprimer."); return; }

  const rqc: RQCData = inspection.rqc ?? {
    conventionnel: false, bio_certifie: false, ggp: false,
    bon_de_reception_ref: null,
    poids_echantillon_branche_kg: null, poids_tb_kg: null, taux_tb_percent: null,
    poids_vrac_kg: null, type_dattes_branche: true, type_dattes_vrac: false,
    infestee: { test1: null, test2: null, test3: null, taux_moyen: null },
    fermentee: { test1: null, test2: null, test3: null, taux_moyen: null },
    immature: { test1: null, test2: null, test3: null, taux_moyen: null },
    craquellee: { test1: null, test2: null, test3: null, taux_moyen: null },
    grasse: { test1: null, test2: null, test3: null, taux_moyen: null },
    seche: { test1: null, test2: null, test3: null, taux_moyen: null },
    tachee: { test1: null, test2: null, test3: null, taux_moyen: null },
    ridee: { test1: null, test2: null, test3: null, taux_moyen: null },
    petit_calibre: { test1: null, test2: null, test3: null, taux_moyen: null },
    taux_dechet_percent: null, endommage_percent: null,
    db_score: null, td_percent: null, conclusion: null,
    responsable_qc1: null, responsable_qc2: null, directeur_qc: null,
  };

  const supplierName = reception.supplier?.name ?? reception.supplier_name_snapshot ?? "";
  const tauxDechet = rqc.taux_dechet_percent ??
    (() => {
      const vals = [
        rqc.infestee.taux_moyen ?? avg(rqc.infestee),
        rqc.fermentee.taux_moyen ?? avg(rqc.fermentee),
        rqc.immature.taux_moyen ?? avg(rqc.immature),
        rqc.craquellee.taux_moyen ?? avg(rqc.craquellee),
      ].filter((v): v is number => v != null);
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) * 10) / 10 : null;
    })();

  const dateStr = reception.actual_arrival_date
    ? new Date(reception.actual_arrival_date).toLocaleDateString("fr-FR")
    : "";

  win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>RQC ${e(inspection.inspection_number)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:10px;color:#111;background:#fff;padding:8mm}
  @page{size:A4 portrait;margin:0}

  .page{width:194mm}

  .header{display:flex;border:2px solid #1a5276;margin-bottom:4px}
  .logo-cell{min-width:100px;border-right:1px solid #1a5276;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:5px 8px}
  .logo-text{color:#107754;font-weight:bold;font-size:13px;line-height:1.1}
  .logo-sub{color:#888;font-size:7px}
  .title-cell{flex:1;border-right:1px solid #1a5276;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:5px}
  .bon-title{color:#1a5276;font-weight:bold;font-size:12px;text-align:center}
  .bon-sub{color:#1a5276;font-size:10px;text-align:center;margin-top:1px}
  .meta-cell{min-width:120px;display:flex;flex-direction:column;justify-content:space-between;padding:5px 8px}
  .meta-annee{font-size:9px}
  .meta-no{font-weight:bold;font-size:14px;color:#c0392b;letter-spacing:.05em}

  .cb-row{display:flex;gap:12px;border:1px solid #1a5276;padding:3px 6px;margin-bottom:3px;font-size:9px;align-items:center}
  .cb{display:inline-flex;align-items:center;gap:3px}
  .cb-box{width:11px;height:11px;border:1.5px solid #1a5276;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:bold}

  .info-row{display:flex;gap:3px;margin-bottom:3px}
  .info-cell{border:1px solid #1a5276;padding:2px 5px;flex:1;font-size:9px}
  .lbl{font-weight:700}

  .supplier-row{display:flex;gap:3px;margin-bottom:3px}
  .supplier-cell{border:1px solid #1a5276;padding:3px 5px;font-size:9px}

  .section-header{background:#d6eaf8;font-weight:bold;text-align:center;padding:2px;border:1px solid #1a5276;font-size:10px;letter-spacing:.05em;margin-bottom:0}

  table{border-collapse:collapse;width:100%;margin-bottom:3px}
  th,td{border:1px solid #1a5276;padding:2px 4px;text-align:center;font-size:9px}
  th{background:#1a5276;color:#fff;font-weight:600}
  td.label{text-align:left;background:#eaf4fb;font-weight:500;min-width:90px}
  tr.highlight td{background:#fff9e6}
  td.mean{font-weight:bold}

  .conclusion-row{display:flex;gap:3px;margin-top:3px}
  .conclusion-cell{border:1px solid #1a5276;padding:4px 6px;font-size:9px;flex:1}

  .note{font-size:8px;color:#444;margin-top:2px;padding:2px 5px;border-top:1px solid #1a5276}

  .sig-row{display:flex;gap:3px;margin-top:4px}
  .sig-cell{flex:1;border:1px solid #1a5276;padding:4px 6px;min-height:44px}
  .sig-label{font-weight:700;font-size:9px;color:#1a5276;margin-bottom:2px}
  .sig-value{font-size:10px;margin-top:2px}

  .footer{display:flex;justify-content:space-between;margin-top:3px;font-size:8px;color:#666;border-top:1px solid #1a5276;padding-top:2px}
  .version{font-weight:bold;color:#1a5276;font-size:9px}
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
      <div class="bon-title">RAPPORT CONTRÔLE QUALITE</div>
      <div class="bon-sub">RECEPTION ACHAT</div>
    </div>
    <div class="meta-cell">
      <div class="meta-annee">Année&nbsp;: <strong>${e(rqc.conventionnel || true ? new Date().getFullYear() : "")}</strong></div>
      <div class="meta-no">N° ${e(inspection.inspection_number)}</div>
    </div>
  </div>

  <!-- Convention checkboxes -->
  <div class="cb-row">
    <span class="cb"><span class="cb-box">${rqc.conventionnel ? "✓" : ""}</span> Conventionnel</span>
    <span class="cb"><span class="cb-box">${rqc.bio_certifie ? "✓" : ""}</span> TN-Bio 001</span>
    <span class="cb"><span class="cb-box">${rqc.ggp ? "✓" : ""}</span> GGP</span>
    <span style="margin-left:auto"><span class="lbl">Date réception&nbsp;:</span> ${e(dateStr)}</span>
    <span style="margin-left:16px"><span class="lbl">Bon de Réception&nbsp;:</span> ${e(rqc.bon_de_reception_ref ?? reception.reception_number)}</span>
  </div>

  <!-- Fournisseur row -->
  <div class="supplier-row">
    <div class="supplier-cell" style="flex:1.5">
      <span class="lbl">Fournisseur&nbsp;:</span> ${e(supplierName)}
    </div>
    <div class="supplier-cell" style="flex:1">
      <span class="lbl">Poids&nbsp;:</span> ${e(reception.quantity_total)} kg
    </div>
    <div class="supplier-cell" style="flex:1">
      <span class="lbl">Nbr caisses&nbsp;:</span> ${e(reception.crate_count)}
    </div>
    <div class="supplier-cell" style="flex:1.2">
      <span class="lbl">Type dattes&nbsp;:</span>
      <span class="cb"><span class="cb-box">${rqc.type_dattes_branche ? "✓" : ""}</span> Branche</span>
      <span class="cb" style="margin-left:6px"><span class="cb-box">${rqc.type_dattes_vrac ? "✓" : ""}</span> Vrac</span>
    </div>
  </div>

  <!-- Poids échantillon -->
  <div class="info-row">
    <div class="info-cell">
      <span class="lbl">Poids Ech&nbsp;:</span> ${rqc.poids_echantillon_branche_kg != null ? rqc.poids_echantillon_branche_kg + " kg" : ""}
    </div>
    <div class="info-cell">
      <span class="lbl">Poids T.B&nbsp;:</span> ${rqc.poids_tb_kg != null ? rqc.poids_tb_kg + " kg" : ""}
    </div>
    <div class="info-cell">
      <span class="lbl">% T.B&nbsp;:</span> ${pct(rqc.taux_tb_percent)}
    </div>
    <div class="info-cell">
      <span class="lbl">VRAC&nbsp;:</span> ${rqc.poids_vrac_kg != null ? rqc.poids_vrac_kg : "0"}
    </div>
  </div>

  <!-- Section BRANCHE -->
  <div class="section-header">BRANCHE</div>

  <!-- Criteria table -->
  <table>
    <thead>
      <tr>
        <th style="text-align:left">Critères du Contrôle</th>
        <th>TEST 1</th><th>TEST 2</th><th>TEST 3</th><th>Taux Moyen</th>
      </tr>
    </thead>
    <tbody>
      ${critereRow("Infestée", rqc.infestee, true)}
      ${critereRow("Fermentée", rqc.fermentee, true)}
      ${critereRow("Immature", rqc.immature, true)}
      ${critereRow("Craquelée", rqc.craquellee, true)}
      ${critereRow("Grasse", rqc.grasse)}
      ${critereRow("Sèche", rqc.seche)}
      ${critereRow("Tachée", rqc.tachee)}
      ${critereRow("Ridée", rqc.ridee)}
      ${critereRow("Petit calibre", rqc.petit_calibre)}
      <tr style="background:#fff3cd">
        <td class="label" style="font-weight:bold">Taux déchet</td>
        <td colspan="3"></td>
        <td class="mean">${pct(tauxDechet)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Conclusion -->
  <div class="conclusion-row">
    <div class="conclusion-cell" style="flex:2">
      <span class="lbl">Conclusion&nbsp;:</span> ${e(rqc.conclusion)}
    </div>
    <div class="conclusion-cell">
      <span class="lbl">Endommagé&nbsp;:</span> ${pct(rqc.endommage_percent)}
    </div>
    <div class="conclusion-cell">
      <span class="lbl">DB&nbsp;:</span> ${e(rqc.db_score)}
    </div>
    <div class="conclusion-cell">
      <span class="lbl">TD&nbsp;:</span> ${pct(rqc.td_percent)}
    </div>
    <div class="conclusion-cell">
      <span class="lbl">Taux déchet&nbsp;:</span> <strong>${pct(tauxDechet)}</strong>
    </div>
  </div>

  <!-- Note -->
  <div class="note">
    NB&nbsp;: taux du déchet = infestée + Fermentée + Immature + Craquelée
  </div>

  <!-- Signatures -->
  <div class="sig-row">
    <div class="sig-cell">
      <div class="sig-label">Responsable QC 1</div>
      <div class="sig-value">${e(rqc.responsable_qc1 ?? inspection.inspector_name)}</div>
    </div>
    <div class="sig-cell">
      <div class="sig-label">Responsable QC2</div>
      <div class="sig-value">${e(rqc.responsable_qc2 ?? inspection.secondary_inspector_name)}</div>
    </div>
    <div class="sig-cell">
      <div class="sig-label">Directeur QC</div>
      <div class="sig-value">${e(rqc.directeur_qc)}</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>Inspection n° ${e(inspection.inspection_number)} — généré le ${new Date().toLocaleDateString("fr-FR")}</span>
    <span class="version">V01 - 2023</span>
  </div>

</div>
<script>window.onload=()=>{ window.print(); window.onafterprint=()=>window.close(); }</script>
</body>
</html>`);
  win.document.close();
}
