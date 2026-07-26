import { badRequest } from "../../core/app-error.js";
import { stagesAchieved } from "./lot-state-machine.js";
export const SHIPMENT_CLOSING_STATUSES = new Set([
    "CLOSED",
    "SHIPPED",
    "EXPEDIE",
    "COMPLETED",
    "CLOTURE",
    "LIVRE",
    "DELIVERED",
]);
const RELEASED_STOCK = new Set(["VALIDATED", "STOCK_LIBERE", "LIBERE", "RELEASED"]);
const RELEASED_RECEPTION = new Set(["STOCK_LIBERE", "LIBERE"]);
export const isLotReleasedForProduction = (lot) => {
    const status = String(lot.status || "").toUpperCase();
    const stockStatus = String(lot.stock_status || "").toUpperCase();
    return RELEASED_STOCK.has(status) || RELEASED_RECEPTION.has(stockStatus);
};
export const assertLotsReleasedForProduction = (lots, inputLotIds) => {
    if (!inputLotIds.length) {
        throw badRequest("PRODUCTION_LOTS_REQUIRED", "A production order requires at least one released input lot.");
    }
    const byId = new Map(lots.map((lot) => [lot.id, lot]));
    const blocked = [];
    for (const lotId of inputLotIds) {
        const lot = byId.get(lotId);
        if (!lot || !isLotReleasedForProduction(lot)) {
            blocked.push(lotId);
        }
    }
    if (blocked.length > 0) {
        throw badRequest("PRODUCTION_LOT_NOT_RELEASED", "Cannot allocate production to lots that are not QC-released.", { blockedLotIds: blocked });
    }
};
export const isOrganicLot = (lot) => {
    if (lot.is_organic === true || lot.bio === true || lot.organic === true)
        return true;
    const cert = String(lot.certification || "").toLowerCase();
    return cert.includes("bio") || cert.includes("organic");
};
export const assertNoOrganicConventionalMix = (lots) => {
    if (lots.length < 2)
        return;
    const flags = lots.map((lot) => isOrganicLot(lot));
    const hasOrganic = flags.some(Boolean);
    const hasConventional = flags.some((flag) => !flag);
    if (hasOrganic && hasConventional) {
        throw badRequest("ORGANIC_CONVENTIONAL_MIX", "Organic and conventional lots cannot be mixed in the same operation.", { lotIds: lots.map((lot) => lot.id) });
    }
};
export const evaluateShipmentDossier = (input) => {
    const missing = [];
    if (!input.hasGenealogy)
        missing.push("genealogy");
    if (!input.hasQcDecision)
        missing.push("qc_decision");
    if (input.requiresCcp && !input.hasCcpCertificate)
        missing.push("ccp_certificate");
    if (!input.hasPackaging)
        missing.push("packaging");
    return {
        hasGenealogy: Boolean(input.hasGenealogy),
        hasQcDecision: Boolean(input.hasQcDecision),
        hasCcpIfRequired: !input.requiresCcp || Boolean(input.hasCcpCertificate),
        hasPackaging: Boolean(input.hasPackaging),
        missing,
    };
};
/**
 * Build export-dossier completeness from the hash-chained lot ledger — never from
 * client-supplied booleans. Used when closing a shipment or bon d'expédition.
 */
export const evaluateShipmentDossierFromChain = (events, options = {}) => {
    const types = new Set(events.map((event) => event.event_type));
    const achieved = stagesAchieved(events);
    const requiresCcp = options.requiresCcp !== false;
    return evaluateShipmentDossier({
        hasGenealogy: types.has("LOT_CREATED") || achieved.has("SUPPLIER_INTAKE"),
        hasQcDecision: types.has("QC_DECIDED") || achieved.has("QC_DECIDED"),
        requiresCcp,
        hasCcpCertificate: types.has("CCP_COMPLETED") ||
            types.has("CCP_SENSOR_ATTESTED") ||
            achieved.has("FUMIGATION_CCP"),
        hasPackaging: types.has("PACKAGED") || achieved.has("PACKED"),
    });
};
export const assertShipmentDossierComplete = (dossier) => {
    if (dossier.missing.length > 0) {
        throw badRequest("SHIPMENT_DOSSIER_INCOMPLETE", "Shipment cannot close while the export dossier is incomplete.", { missing: dossier.missing });
    }
};
export const isShipmentClosingStatus = (nextStatus) => SHIPMENT_CLOSING_STATUSES.has(String(nextStatus || "").toUpperCase());
export const assertShipmentNotClosableWhenIncomplete = (nextStatus, dossier) => {
    if (isShipmentClosingStatus(nextStatus))
        assertShipmentDossierComplete(dossier);
};
