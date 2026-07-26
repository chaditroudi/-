import { Injectable } from "@nestjs/common";

import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import {
  assertLotsReleasedForProduction,
  assertNoOrganicConventionalMix,
  assertShipmentNotClosableWhenIncomplete,
  evaluateShipmentDossier,
  type LotReleaseStatus,
} from "./gate-rules.js";

const loadLotsByIds = async (ids: string[]): Promise<LotReleaseStatus[]> => {
  if (ids.length === 0) return [];

  const stockLots = sanitizeDocument(
    await getCollectionModel("stock_lots").find({ id: { $in: ids } }).lean().exec(),
  ) as LotReleaseStatus[];

  const found = new Set(stockLots.map((lot) => lot.id));
  const missing = ids.filter((id) => !found.has(id));

  if (missing.length === 0) return stockLots;

  const receptionLots = sanitizeDocument(
    await getCollectionModel("reception_lots").find({ id: { $in: missing } }).lean().exec(),
  ) as LotReleaseStatus[];

  return [...stockLots, ...receptionLots];
};

@Injectable()
export class GateRulesService {
  async assertProductionOrderWritable(doc: Record<string, unknown>) {
    const inputLotIds = Array.isArray(doc.input_lot_ids)
      ? doc.input_lot_ids.map((id) => String(id)).filter(Boolean)
      : [];

    const status = String(doc.status || "DRAFT").toUpperCase();
    const requiresReleasedLots = !["DRAFT", "CANCELLED", "CANCELED", "PLANIFIE", "PLANNED"].includes(status);

    if (!requiresReleasedLots) {
      if (inputLotIds.length > 1) {
        const lots = await loadLotsByIds(inputLotIds);
        assertNoOrganicConventionalMix(lots);
      }
      return;
    }

    const lots = await loadLotsByIds(inputLotIds);
    assertLotsReleasedForProduction(lots, inputLotIds);
    assertNoOrganicConventionalMix(lots);
  }

  async assertShipmentWritable(before: Record<string, unknown> | null, next: Record<string, unknown>) {
    const nextStatus = next.status ?? before?.status;
    const enforce =
      next.enforce_dossier === true ||
      before?.enforce_dossier === true ||
      [
        "dossier_genealogy_ok",
        "dossier_qc_ok",
        "dossier_ccp_ok",
        "dossier_packaging_ok",
        "qc_complete",
        "ccp_complete",
        "packaging_complete",
      ].some((key) => key in next || (before && key in before));

    if (!enforce) return;

    const lotIds = Array.isArray(next.lot_ids)
      ? next.lot_ids.map((id) => String(id))
      : Array.isArray(before?.lot_ids)
        ? (before?.lot_ids as unknown[]).map((id) => String(id))
        : [];

    const hasGenealogy = lotIds.length > 0;
    const hasQc = Boolean(next.qc_complete ?? before?.qc_complete ?? next.has_qc ?? before?.has_qc);
    const requiresCcp = Boolean(next.requires_ccp ?? before?.requires_ccp ?? true);
    const hasCcp = Boolean(next.ccp_complete ?? before?.ccp_complete ?? next.has_ccp ?? before?.has_ccp);
    const hasPackaging = Boolean(
      next.packaging_complete ?? before?.packaging_complete ?? next.has_packaging ?? before?.has_packaging,
    );

    const dossier = evaluateShipmentDossier({
      hasGenealogy: hasGenealogy || Boolean(next.dossier_genealogy_ok ?? before?.dossier_genealogy_ok),
      hasQcDecision: hasQc || Boolean(next.dossier_qc_ok ?? before?.dossier_qc_ok),
      requiresCcp,
      hasCcpCertificate: hasCcp || Boolean(next.dossier_ccp_ok ?? before?.dossier_ccp_ok),
      hasPackaging: hasPackaging || Boolean(next.dossier_packaging_ok ?? before?.dossier_packaging_ok),
    });

    assertShipmentNotClosableWhenIncomplete(
      typeof nextStatus === "string" ? nextStatus : null,
      dossier,
    );
  }
}

export const gateRulesService = new GateRulesService();
