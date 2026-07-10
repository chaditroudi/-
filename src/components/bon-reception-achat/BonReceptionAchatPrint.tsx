import { forwardRef } from "react";
import type { BonReceptionAchat, BranchLine } from "@/types/bonReceptionAchat";

interface Props {
  bon: BonReceptionAchat;
}

const Row = ({ label, gc, rp, gcm, l, poidBrut, poidNet }: {
  label: string; gc?: number | null; rp?: number | null; gcm?: number | null;
  l?: number | null; poidBrut?: number | null; poidNet?: number | null;
}) => (
  <tr className="border border-[#1a5276] text-center text-xs">
    <td className="border border-[#1a5276] text-left px-1 py-0.5 font-medium bg-[#eaf4fb]">{label}</td>
    <td className="border border-[#1a5276] px-1 py-0.5">{gc ?? ""}</td>
    <td className="border border-[#1a5276] px-1 py-0.5">{rp ?? ""}</td>
    <td className="border border-[#1a5276] px-1 py-0.5">{gcm ?? ""}</td>
    <td className="border border-[#1a5276] px-1 py-0.5">{l ?? ""}</td>
    <td className="border border-[#1a5276] px-1 py-0.5">{poidBrut ?? ""}</td>
    <td className="border border-[#1a5276] px-1 py-0.5">{poidNet ?? ""}</td>
  </tr>
);

export const BonReceptionAchatPrint = forwardRef<HTMLDivElement, Props>(({ bon }, ref) => {
  const b1 = bon.branche_premiere;
  const b2 = bon.branche_deuxieme;
  const vr = bon.vrac;
  const bs = bon.branche_seche;

  const netB2 = b2.poid_net != null && b2.poid_brut != null ? b2.poid_brut - b2.poid_net : null;
  const netBS = bs.poid_net != null && bs.poid_brut != null ? bs.poid_brut - bs.poid_net : null;

  return (
    <div
      ref={ref}
      className="bg-white text-[#1a1a1a] font-sans"
      style={{ width: "210mm", minHeight: "297mm", padding: "12mm", fontFamily: "Arial, sans-serif", fontSize: "12px" }}
    >
      {/* Header */}
      <div className="flex items-stretch border-2 border-[#1a5276] mb-2">
        {/* Logo cell */}
        <div className="border-r border-[#1a5276] flex items-center justify-center px-4 py-2" style={{ minWidth: 120 }}>
          <div className="text-center">
            <div className="text-[#107754] font-bold text-lg leading-tight">Royal</div>
            <div className="text-[#107754] font-bold text-lg leading-tight">Palm</div>
            <div className="text-[11px] text-gray-500">Group</div>
          </div>
        </div>

        {/* Center title */}
        <div className="flex-1 flex flex-col items-center justify-center border-r border-[#1a5276] px-4 py-2">
          <div className="text-[#1a5276] font-bold text-base text-center">BON DE RECEPTION ACHAT</div>
          <div className="flex gap-6 mt-2 text-xs">
            <label className="flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center border border-[#1a5276] text-center">
                {bon.convention ? "✓" : ""}
              </span>
              <span className="font-semibold">Convention</span>
            </label>
            <label className="flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center border border-[#1a5276] text-center">
                {bon.bio_certifie ? "✓" : ""}
              </span>
              <span>TN-Bio-001</span>
            </label>
          </div>
        </div>

        {/* Right meta */}
        <div className="flex flex-col justify-between text-xs px-3 py-2" style={{ minWidth: 140 }}>
          <div className="font-medium">Année&nbsp;: <span className="font-bold">{bon.annee}</span></div>
          <div className="font-bold text-base">{bon.numero_bon}</div>
          <div className="text-gray-600">{bon.statut === "valide" ? "✓ Validé" : bon.statut === "annule" ? "✗ Annulé" : "Brouillon"}</div>
        </div>
      </div>

      {/* Row 1: Expedition + Date */}
      <div className="flex gap-2 mb-1 text-xs">
        <div className="flex-1 border border-[#1a5276] px-2 py-1">
          <span className="font-medium">N° Bon d&apos;expédition&nbsp;:</span> <span className="border-b border-dotted border-gray-400 inline-block min-w-[60px]">{bon.numero_expedition ?? ""}</span>
          &nbsp;&nbsp;<span className="font-medium">Lieu&nbsp;:</span> <span className="border-b border-dotted border-gray-400 inline-block min-w-[60px]">{bon.lieu_expedition ?? ""}</span>
        </div>
        <div className="border border-[#1a5276] px-2 py-1" style={{ minWidth: 160 }}>
          <span className="font-medium">Date&nbsp;:</span> {bon.date_reception ?? ""}
        </div>
      </div>

      {/* Row 2: Fournisseur + Facture + Time */}
      <div className="flex gap-2 mb-1 text-xs">
        <div className="flex-1 border border-[#1a5276] px-2 py-1">
          <span className="font-medium">Fournisseur&nbsp;:</span> <span className="font-bold">{bon.fournisseur_nom ?? ""}</span>
          &nbsp;&nbsp;<span className="font-medium">N° Facture&nbsp;:</span> {bon.numero_facture ?? ""}
        </div>
        <div className="border border-[#1a5276] px-2 py-1" style={{ minWidth: 160 }}>
          <span className="font-medium">H. Arrivée&nbsp;:</span> {bon.heure_arrivee ?? ""}
        </div>
      </div>

      {/* Row 3: Region + Lot */}
      <div className="flex gap-2 mb-1 text-xs">
        <div className="border border-[#1a5276] px-2 py-1 flex gap-4">
          <label className="flex items-center gap-1">
            <span className="inline-block w-4 h-4 border border-[#1a5276]">{bon.region === "el_jirid" ? "✓" : ""}</span>
            El jirid
          </label>
          <label className="flex items-center gap-1">
            <span className="inline-block w-4 h-4 border border-[#1a5276]">{bon.region === "kebilli" ? "✓" : ""}</span>
            Kebilli
          </label>
        </div>
        <div className="flex-1 border border-[#1a5276] px-2 py-1">
          <span className="font-medium">N° de Lot&nbsp;:</span> {bon.numero_lot ?? ""}
        </div>
      </div>

      {/* Main table + right column */}
      <div className="flex gap-2 mb-2">
        {/* Left: table */}
        <div className="flex-1">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-[#1a5276] text-white text-center">
                <th className="border border-[#1a5276] px-1 py-0.5 text-left">Type</th>
                <th className="border border-[#1a5276] px-1 py-0.5">GC</th>
                <th className="border border-[#1a5276] px-1 py-0.5">RP</th>
                <th className="border border-[#1a5276] px-1 py-0.5">GCM</th>
                <th className="border border-[#1a5276] px-1 py-0.5">L</th>
                <th className="border border-[#1a5276] px-1 py-0.5">Poid Brut</th>
                <th className="border border-[#1a5276] px-1 py-0.5">Poid Net</th>
              </tr>
            </thead>
            <tbody>
              <Row label="Branche 1ère" gc={b1.gc} rp={b1.rp} gcm={b1.gcm} l={b1.l} poidBrut={b1.poid_brut} poidNet={b1.poid_net} />
              <tr className="border border-[#1a5276] text-[11px]">
                <td className="border border-[#1a5276] px-1 py-0.5 text-left bg-[#eaf4fb]">Nbre de palette</td>
                <td colSpan={6} className="border border-[#1a5276] px-1 py-0.5">{b1.nbre_palette ?? ""}</td>
              </tr>
              <tr className="border border-[#1a5276] text-[11px]">
                <td className="border border-[#1a5276] px-1 py-0.5 text-left bg-[#eaf4fb]">Observation</td>
                <td colSpan={6} className="border border-[#1a5276] px-1 py-0.5">{b1.observation ?? ""}</td>
              </tr>

              <Row label="Branche 2ème" gc={b2.gc} rp={b2.rp} gcm={b2.gcm} l={b2.l} poidBrut={b2.poid_brut} poidNet={b2.poid_net} />
              <tr className="border border-[#1a5276] text-[11px]">
                <td className="border border-[#1a5276] px-1 py-0.5 text-left bg-[#eaf4fb]">Nbre de palette</td>
                <td colSpan={5} className="border border-[#1a5276] px-1 py-0.5">{b2.nbre_palette ?? ""}</td>
                <td className="border border-[#1a5276] px-1 py-0.5 text-red-600 text-right">
                  {netB2 != null ? `-${netB2}` : ""}
                </td>
              </tr>
              <tr className="border border-[#1a5276] text-[11px]">
                <td className="border border-[#1a5276] px-1 py-0.5 text-left bg-[#eaf4fb]">Observation</td>
                <td colSpan={6} className="border border-[#1a5276] px-1 py-0.5">{b2.observation ?? ""}</td>
              </tr>

              <Row label="Vrac" gc={vr.gc} rp={vr.rp} gcm={vr.gcm} l={vr.l} poidBrut={vr.poid_brut} poidNet={vr.poid_net} />
              <tr className="border border-[#1a5276] text-[11px]">
                <td className="border border-[#1a5276] px-1 py-0.5 text-left bg-[#eaf4fb]">Nbre de palette</td>
                <td colSpan={6} className="border border-[#1a5276] px-1 py-0.5">{vr.nbre_palette ?? ""}</td>
              </tr>
              <tr className="border border-[#1a5276] text-[11px]">
                <td className="border border-[#1a5276] px-1 py-0.5 text-left bg-[#eaf4fb]">Observation</td>
                <td colSpan={6} className="border border-[#1a5276] px-1 py-0.5">{vr.observation ?? ""}</td>
              </tr>

              <Row label="Branche Sèche" gc={bs.gc} rp={bs.rp} gcm={bs.gcm} l={bs.l} poidBrut={bs.poid_brut} poidNet={bs.poid_net} />
              <tr className="border border-[#1a5276] text-[11px]">
                <td className="border border-[#1a5276] px-1 py-0.5 text-left bg-[#eaf4fb]">Nbre de palette</td>
                <td colSpan={3} className="border border-[#1a5276] px-1 py-0.5 text-green-700">
                  {bs.nbre_palette_ajout != null ? `+${bs.nbre_palette_ajout}` : ""}
                </td>
                <td colSpan={2} className="border border-[#1a5276] px-1 py-0.5 text-red-600">
                  {bs.nbre_palette_retrait != null ? `-${bs.nbre_palette_retrait}` : ""}
                </td>
                <td className="border border-[#1a5276] px-1 py-0.5 text-red-600 text-right">
                  {netBS != null ? `-${netBS}` : ""}
                </td>
              </tr>
              <tr className="border border-[#1a5276] text-[11px]">
                <td className="border border-[#1a5276] px-1 py-0.5 text-left bg-[#eaf4fb]">Observations</td>
                <td colSpan={6} className="border border-[#1a5276] px-1 py-0.5">{bs.observation ?? ""}</td>
              </tr>

              {/* Casse */}
              <tr className="bg-[#d6eaf8] text-[11px]">
                <td className="border border-[#1a5276] px-1 py-0.5 font-bold" colSpan={7}>Casse</td>
              </tr>
              <tr className="border border-[#1a5276] text-[11px]">
                <td className="border border-[#1a5276] px-1 py-0.5 bg-[#eaf4fb]">Nature</td>
                <td colSpan={6} className="border border-[#1a5276] px-1 py-0.5">
                  {bon.casse.map((c) => c.nature).join(", ")}
                </td>
              </tr>
              <tr className="border border-[#1a5276] text-[11px]">
                <td className="border border-[#1a5276] px-1 py-0.5 bg-[#eaf4fb]">Quantité</td>
                <td colSpan={6} className="border border-[#1a5276] px-1 py-0.5">
                  {bon.casse.map((c) => c.quantite).join(", ")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-1 text-[11px]" style={{ minWidth: 148 }}>
          <div className="border border-[#1a5276] px-2 py-1">
            <div className="font-medium text-[#1a5276]">Camion&nbsp;:</div>
            <div className="font-bold">{bon.numero_camion ?? ""}</div>
          </div>
          <div className="border border-[#1a5276] px-2 py-1">
            <div className="font-medium text-[#1a5276]">Chauffeur&nbsp;:</div>
            <div>{bon.nom_chauffeur ?? ""}</div>
          </div>
          <div className="border border-[#1a5276] px-2 py-1">
            <div className="font-medium text-[#1a5276]">Lieu de réception&nbsp;:</div>
            <div>{bon.lieu_reception ?? ""}</div>
          </div>
          <div className="border border-[#1a5276] px-2 py-1">
            <div className="font-medium text-[#1a5276]">Responsable réception&nbsp;:</div>
            <div>{bon.responsable_reception ?? ""}</div>
          </div>
          <div className="border border-[#1a5276] px-2 py-1">
            <div className="font-medium text-[#1a5276]">N° Rapport QCR&nbsp;:</div>
            <div>{bon.numero_rapport_qcr ?? ""}</div>
          </div>
          <div className="border border-[#1a5276] px-2 py-1">
            <div className="font-medium text-[#1a5276]">N° fiche palette&nbsp;:</div>
            <div>{bon.numero_fiche_palette ?? ""}</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[#1a5276] pt-1 text-[11px] text-gray-500 flex justify-between">
        <span>(*) GC&nbsp;: Grand Caisse / P&nbsp;: Plateau / L&nbsp;: Lame / GCR&nbsp;: GC Royal / GCI&nbsp;: GC jaune / GCN&nbsp;: GC Bleu</span>
        <span className="font-bold text-[#1a5276]">V01 - {bon.annee}</span>
      </div>
    </div>
  );
});

BonReceptionAchatPrint.displayName = "BonReceptionAchatPrint";
