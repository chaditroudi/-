import { badRequest } from "../../core/app-error.js";

export type LotReleaseStatus = {
  id: string;
  status?: string | null;
  stock_status?: string | null;
  is_organic?: boolean | null;
  bio?: boolean | null;
  organic?: boolean | null;
  certification?: string | null;
};

export type DossierCompleteness = {
  hasGenealogy: boolean;
  hasQcDecision: boolean;
  hasCcpIfRequired: boolean;
  hasPackaging: boolean;
  missing: string[];
};

const RELEASED_STOCK = new Set(["VALIDATED", "STOCK_LIBERE", "LIBERE", "RELEASED"]);
const RELEASED_RECEPTION = new Set(["STOCK_LIBERE", "LIBERE"]);

export const isLotReleasedForProduction = (lot: LotReleaseStatus) => {
  const status = String(lot.status || "").toUpperCase();
  const stockStatus = String(lot.stock_status || "").toUpperCase();
  return RELEASED_STOCK.has(status) || RELEASED_RECEPTION.has(stockStatus);
};

export const assertLotsReleasedForProduction = (lots: LotReleaseStatus[], inputLotIds: string[]) => {
  if (!inputLotIds.length) {
    throw badRequest(
      "PRODUCTION_LOTS_REQUIRED",
      "A production order requires at least one released input lot.",
    );
  }

  const byId = new Map(lots.map((lot) => [lot.id, lot]));
  const blocked: string[] = [];

  for (const lotId of inputLotIds) {
    const lot = byId.get(lotId);
    if (!lot || !isLotReleasedForProduction(lot)) {
      blocked.push(lotId);
    }
  }

  if (blocked.length > 0) {
    throw badRequest(
      "PRODUCTION_LOT_NOT_RELEASED",
      "Cannot allocate production to lots that are not QC-released.",
      { blockedLotIds: blocked },
    );
  }
};

export const isOrganicLot = (lot: LotReleaseStatus) => {
  if (lot.is_organic === true || lot.bio === true || lot.organic === true) return true;
  const cert = String(lot.certification || "").toLowerCase();
  return cert.includes("bio") || cert.includes("organic");
};

export const assertNoOrganicConventionalMix = (lots: LotReleaseStatus[]) => {
  if (lots.length < 2) return;

  const flags = lots.map((lot) => isOrganicLot(lot));
  const hasOrganic = flags.some(Boolean);
  const hasConventional = flags.some((flag) => !flag);

  if (hasOrganic && hasConventional) {
    throw badRequest(
      "ORGANIC_CONVENTIONAL_MIX",
      "Organic and conventional lots cannot be mixed in the same operation.",
      { lotIds: lots.map((lot) => lot.id) },
    );
  }
};

export const evaluateShipmentDossier = (input: {
  hasGenealogy?: boolean;
  hasQcDecision?: boolean;
  requiresCcp?: boolean;
  hasCcpCertificate?: boolean;
  hasPackaging?: boolean;
}): DossierCompleteness => {
  const missing: string[] = [];
  if (!input.hasGenealogy) missing.push("genealogy");
  if (!input.hasQcDecision) missing.push("qc_decision");
  if (input.requiresCcp && !input.hasCcpCertificate) missing.push("ccp_certificate");
  if (!input.hasPackaging) missing.push("packaging");

  return {
    hasGenealogy: Boolean(input.hasGenealogy),
    hasQcDecision: Boolean(input.hasQcDecision),
    hasCcpIfRequired: !input.requiresCcp || Boolean(input.hasCcpCertificate),
    hasPackaging: Boolean(input.hasPackaging),
    missing,
  };
};

export const assertShipmentDossierComplete = (dossier: DossierCompleteness) => {
  if (dossier.missing.length > 0) {
    throw badRequest(
      "SHIPMENT_DOSSIER_INCOMPLETE",
      "Shipment cannot close while the export dossier is incomplete.",
      { missing: dossier.missing },
    );
  }
};

export const assertShipmentNotClosableWhenIncomplete = (
  nextStatus: string | null | undefined,
  dossier: DossierCompleteness,
) => {
  const status = String(nextStatus || "").toUpperCase();
  const closing = ["CLOSED", "SHIPPED", "EXPEDIE", "COMPLETED", "CLOTURE"].includes(status);
  if (closing) assertShipmentDossierComplete(dossier);
};
