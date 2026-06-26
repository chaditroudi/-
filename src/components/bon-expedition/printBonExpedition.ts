import type { BonExpedition, ExpeditionLigne } from "@/types/bonExpedition";
import { PRODUIT_LABELS, PRODUIT_ORDER } from "@/types/bonExpedition";

const e = (v: string | number | null | undefined) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const buildLignesMap = (lignes: ExpeditionLigne[]) => {
  const map = new Map<string, ExpeditionLigne>();
  for (const l of lignes) map.set(l.produit, l);
  return map;
};

export function printBonExpedition(bon: BonExpedition) {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) { alert("Autorisez les popups pour imprimer."); return; }

  const lignesMap = buildLignesMap(bon.lignes ?? []);
  const statutLabel = bon.statut === "valide" ? "✓ Validé" : bon.statut === "annule" ? "✗ Annulé" : "Brouillon";

  const tableRows = PRODUIT_ORDER.map((produit) => {
    const ligne = lignesMap.get(produit);
    return `<tr>
      <td class="label">${e(PRODUIT_LABELS[produit])}</td>
      <td>${e(ligne?.nature_caisse)}</td>
      <td>${e(ligne?.quantite_caisse)}</td>
      <td>${e(ligne?.observation)}</td>
    </tr>`;
  }).join("");

  win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>BDE ${e(bon.numero_bon)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:11px;color:#111;background:#fff;padding:10mm}
  @page{size:A4 portrait;margin:0}
  @media print{body{padding:10mm}}

  .page{width:190mm}

  /* ── Header ── */
  .header{display:flex;border:2px solid #1a5276;margin-bottom:4px}
  .logo-cell{min-width:110px;border-right:1px solid #1a5276;display:flex;align-items:center;justify-content:center;padding:6px 10px;flex-direction:column}
  .logo-text{color:#107754;font-weight:bold;font-size:15px;line-height:1.1}
  .logo-sub{color:#888;font-size:8px}
  .title-cell{flex:1;border-right:1px solid #1a5276;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px}
  .bon-title{color:#1a5276;font-weight:bold;font-size:14px}
  .checkboxes{display:flex;gap:18px;margin-top:6px;font-size:10px}
  .cb{display:inline-flex;align-items:center;gap:4px}
  .cb-box{width:13px;height:13px;border:1.5px solid #1a5276;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold}
  .meta-cell{min-width:130px;display:flex;flex-direction:column;justify-content:space-between;padding:6px 10px}
  .meta-annee{font-size:10px}
  .meta-bon{font-weight:bold;font-size:14px;color:#c0392b}
  .meta-statut{font-size:9px;color:#555;margin-top:2px}

  /* ── Info rows ── */
  .info-row{display:flex;gap:4px;margin-bottom:3px;font-size:10px}
  .info-cell{border:1px solid #1a5276;padding:3px 6px;flex:1}
  .lbl{font-weight:700}

  /* ── Main layout ── */
  .main-layout{display:flex;gap:4px;margin-top:4px}

  /* ── Table ── */
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #1a5276;padding:3px 6px;text-align:center;font-size:10px}
  th{background:#1a5276;color:#fff;font-size:10px;font-weight:600}
  td.label{text-align:left;background:#eaf4fb;font-weight:600;min-width:100px}
  .casse-section{margin-top:4px}
  .casse-title{background:#d6eaf8;font-weight:bold;text-align:left;padding:3px 6px;border:1px solid #1a5276;font-size:10px}

  /* ── Right column ── */
  .right-col{display:flex;flex-direction:column;gap:3px;min-width:148px}
  .right-cell{border:1px solid #1a5276;padding:5px 7px;font-size:10px}
  .right-label{color:#1a5276;font-weight:700;margin-bottom:2px;font-size:9px;text-transform:uppercase;letter-spacing:.04em}
  .right-value{font-size:11px;min-height:16px}
  .sig-cell{border:1px solid #1a5276;padding:5px 7px;font-size:10px;min-height:60px}
  .sig-label{color:#1a5276;font-weight:700;font-size:9px;margin-bottom:2px}

  /* ── Signature bottom ── */
  .sig-row{display:flex;gap:4px;margin-top:6px}
  .sig-box{flex:1;border:1px solid #1a5276;padding:6px 8px;min-height:48px}
  .sig-box-label{font-weight:700;font-size:10px;color:#1a5276;margin-bottom:3px}

  /* ── Footer ── */
  .footer{border-top:1px solid #1a5276;margin-top:6px;padding-top:3px;display:flex;justify-content:space-between;font-size:9px;color:#666}
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
      <div class="bon-title">BON D'EXPEDITION</div>
      <div class="checkboxes">
        <span class="cb"><span class="cb-box">${bon.conventionnel ? "✓" : ""}</span> Conventionnel</span>
        <span class="cb"><span class="cb-box">${bon.bio_certifie ? "✓" : ""}</span> TN-Bio-001</span>
        <span class="cb"><span class="cb-box">${bon.ggp ? "✓" : ""}</span> GGP</span>
      </div>
    </div>
    <div class="meta-cell">
      <div class="meta-annee">Année&nbsp;: <strong>${e(bon.annee)}</strong></div>
      <div class="meta-bon">Nr&nbsp; ${e(bon.numero_bon)}</div>
      <div class="meta-statut">${e(statutLabel)}</div>
    </div>
  </div>

  <!-- Lieu + Date -->
  <div class="info-row">
    <div class="info-cell">
      <span class="lbl">Lieu&nbsp;:</span> ${e(bon.lieu)}
    </div>
    <div class="info-cell" style="min-width:160px">
      <span class="lbl">Date&nbsp;:</span> ${e(bon.date_expedition)}
    </div>
  </div>

  <!-- Fournisseur + Contrôleur -->
  <div class="info-row">
    <div class="info-cell">
      <span class="lbl">Code Fournisseur&nbsp;:</span> ${e(bon.code_fournisseur)}
    </div>
    <div class="info-cell">
      <span class="lbl">Code Contrôleur&nbsp;:</span> ${e(bon.code_controleur)}
    </div>
  </div>

  <!-- Main layout -->
  <div class="main-layout">

    <!-- Table + Casse -->
    <div style="flex:1">
      <table>
        <thead>
          <tr>
            <th style="text-align:left;min-width:100px">Produit</th>
            <th>Nature de caisse</th>
            <th>Quantité de caisse</th>
            <th>Observation</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <!-- Casse -->
      <div class="casse-section">
        <div class="casse-title">Casse</div>
        <table>
          <thead>
            <tr>
              <th style="text-align:left;width:80px"></th>
              <th>GC</th>
              <th>P</th>
              <th>L</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="label">Nature</td>
              <td colspan="3">${e(bon.casse_nature)}</td>
            </tr>
            <tr>
              <td class="label">Quantité</td>
              <td>${bon.casse_gc ?? ""}</td>
              <td>${bon.casse_p ?? ""}</td>
              <td>${bon.casse_l ?? ""}</td>
            </tr>
          </tbody>
        </table>
        <div style="font-size:8px;color:#555;margin-top:2px">(*) GC&nbsp;: Grand Caisse / P&nbsp;: Plateau / L&nbsp;: Lame</div>
      </div>

      <!-- Signature bas -->
      <div class="sig-row">
        <div class="sig-box">
          <div class="sig-box-label">Nom et Signature (Expéditeur)</div>
          <div style="font-size:10px">${e(bon.nom_signataire)}</div>
        </div>
        <div class="sig-box">
          <div class="sig-box-label">Nom et Signature (Récepteur)</div>
          <div style="font-size:10px">${e(bon.responsable_reception)}</div>
        </div>
      </div>
    </div>

    <!-- Right column -->
    <div class="right-col">
      <div class="right-cell">
        <div class="right-label">Camion</div>
        <div class="right-value">${e(bon.numero_camion)}</div>
      </div>
      <div class="right-cell">
        <div class="right-label">Chauffeur</div>
        <div class="right-value">${e(bon.nom_chauffeur)}</div>
      </div>
      <div class="right-cell">
        <div class="right-label">Lieu de réception</div>
        <div class="right-value">${e(bon.lieu_reception)}</div>
      </div>
      <div class="right-cell">
        <div class="right-label">Responsable réception</div>
        <div class="right-value">${e(bon.responsable_reception)}</div>
      </div>
      <div class="sig-cell">
        <div class="sig-label">Nom et signature</div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>(*) GC&nbsp;: Grand Caisse / P&nbsp;: Plateau / L&nbsp;: Lame</span>
    <span class="version">V02 - ${e(bon.annee)}</span>
  </div>

</div>
<script>window.onload=()=>{ window.print(); window.onafterprint=()=>window.close(); }</script>
</body>
</html>`);
  win.document.close();
}
