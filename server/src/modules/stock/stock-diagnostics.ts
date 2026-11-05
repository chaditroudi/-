import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";

export type StockIntegrityFinding = {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
};

/**
 * Read-only Gate 2 diagnostics. Reports discrepancies without mutating production data.
 */
export const runStockIntegrityDiagnostics = async () => {
  const findings: StockIntegrityFinding[] = [];
  const StockLots = getCollectionModel("stock_lots");
  const Movements = getCollectionModel("stock_movements");
  const TriageSessions = getCollectionModel("triage_sessions");
  const PackagingPalettes = getCollectionModel("packaging_palettes");

  const lots = sanitizeDocument(await StockLots.find({}).lean().exec()) as Array<Record<string, unknown>>;
  const movements = sanitizeDocument(
    await Movements.find({}).lean().exec(),
  ) as Array<Record<string, unknown>>;

  for (const lot of lots) {
    const qty = Number(lot.current_quantity ?? 0);
    const status = String(lot.status || "").toUpperCase();
    const id = String(lot.id || "");

    if (qty < -0.001) {
      findings.push({
        code: "NEGATIVE_STOCK_QTY",
        severity: "error",
        message: `Lot ${lot.lot_number || id} a une quantité négative (${qty}).`,
        entityType: "stock_lots",
        entityId: id,
        details: { quantity: qty, status },
      });
    }

    if ((status === "QUARANTINE" || status === "HOLD") && qty > 0.001) {
      const linked = Boolean(lot.reception_lot_id || lot.source_stage || lot.production_order_id || lot.packaging_palette_id);
      if (!linked) {
        findings.push({
          code: "ORPHAN_QUARANTINE_QTY",
          severity: "error",
          message: `Lot quarantaine/orphelin avec quantité ${qty} kg.`,
          entityType: "stock_lots",
          entityId: id,
        });
      }
    }

    if (status === "CONSUMED" && qty > 0.001) {
      findings.push({
        code: "CONSUMED_WITH_QTY",
        severity: "warning",
        message: `Lot CONSUMED conserve ${qty} kg.`,
        entityType: "stock_lots",
        entityId: id,
      });
    }
  }

  // Duplicate finished-goods lots for the same sealed palette.
  const byPalette = new Map<string, string[]>();
  for (const lot of lots) {
    const paletteId = String(lot.packaging_palette_id || "");
    if (!paletteId || String(lot.source_stage || "") !== "PACKAGING") continue;
    const list = byPalette.get(paletteId) || [];
    list.push(String(lot.id));
    byPalette.set(paletteId, list);
  }
  for (const [paletteId, ids] of byPalette) {
    if (ids.length > 1) {
      findings.push({
        code: "DUPLICATE_PALETTE_STOCK",
        severity: "error",
        message: `Plusieurs lots PF pour la palette ${paletteId}.`,
        entityType: "packaging_palettes",
        entityId: paletteId,
        details: { stockLotIds: ids },
      });
    }
  }

  const sealed = sanitizeDocument(
    await PackagingPalettes.find({ status: "SCELLE" }).lean().exec(),
  ) as Array<Record<string, unknown>>;
  for (const palette of sealed) {
    const id = String(palette.id || "");
    const lotNumber = String(palette.sscc || palette.palette_number || "");
    const fg = lots.find(
      (lot) =>
        String(lot.packaging_palette_id || "") === id ||
        (String(lot.source_stage || "") === "PACKAGING" && String(lot.lot_number || "") === lotNumber),
    );
    if (!fg) {
      findings.push({
        code: "SEALED_WITHOUT_STOCK",
        severity: "error",
        message: `Palette SCELLE ${palette.palette_number || id} sans lot PF.`,
        entityType: "packaging_palettes",
        entityId: id,
      });
    }
  }

  const closedTriage = sanitizeDocument(
    await TriageSessions.find({ status: "TERMINE" }).lean().exec(),
  ) as Array<Record<string, unknown>>;
  for (const session of closedTriage) {
    const sessionId = String(session.id || "");
    const parentWeight = Number(session.parent_weight_kg ?? 0);
    if (parentWeight <= 0) continue;
    const consumeMovements = movements.filter(
      (row) =>
        String(row.document_type || "") === "TRIAGE_CLOSE" &&
        String(row.movement_type || "") === "CONSOMMATION" &&
        (String(row.document_reference || "") === String(session.session_number || sessionId) ||
          String(row.request_id || "") === `triage:${sessionId}:consume`),
    );
    if (consumeMovements.length === 0) {
      findings.push({
        code: "TRIAGE_PARENT_NOT_CONSUMED",
        severity: "warning",
        message: `Session triage ${session.session_number || sessionId} sans consommation parent enregistrée.`,
        entityType: "triage_sessions",
        entityId: sessionId,
        details: { parent_weight_kg: parentWeight },
      });
    }
  }

  const receptionRefs = new Map<string, string[]>();
  for (const lot of lots) {
    const receptionLotId = String(lot.reception_lot_id || "");
    if (!receptionLotId) continue;
    const list = receptionRefs.get(receptionLotId) || [];
    list.push(String(lot.id));
    receptionRefs.set(receptionLotId, list);
  }
  for (const [receptionLotId, ids] of receptionRefs) {
    if (ids.length > 1) {
      findings.push({
        code: "MULTI_STOCK_PER_RECEPTION_LOT",
        severity: "info",
        message: `Plusieurs projections stock pour reception_lot ${receptionLotId} (lot splitting possible).`,
        entityType: "reception_lots",
        entityId: receptionLotId,
        details: { stockLotIds: ids },
      });
    }
  }

  const errors = findings.filter((row) => row.severity === "error").length;
  const warnings = findings.filter((row) => row.severity === "warning").length;

  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    summary: {
      stockLots: lots.length,
      movements: movements.length,
      findings: findings.length,
      errors,
      warnings,
    },
    findings,
  };
};
