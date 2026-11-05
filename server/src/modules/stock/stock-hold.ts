import { badRequest, notFound } from "../../core/app-error.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { buildGenealogyFromDossier } from "../phase2/genealogy-builder.js";
import { buildLotTraceabilityDossier } from "../phase2/traceability-dossier.js";

type StockLotRow = {
  id?: string;
  lot_number?: string | null;
  status?: string | null;
  reception_lot_id?: string | null;
  source_lot_internal?: string | null;
  source_reception_id?: string | null;
  packaging_palette_id?: string | null;
  production_order_id?: string | null;
  hold_previous_status?: string | null;
  hold_root_id?: string | null;
};

const HOLD_STATUSES = new Set(["HOLD", "BLOCKED", "QUARANTINE"]);
const RELEASE_STATUSES = new Set(["VALIDATED", "RELEASED", "STOCK_LIBERE", "LIBERE"]);

const readLotLookup = (lot: StockLotRow) =>
  String(lot.reception_lot_id || lot.source_lot_internal || lot.lot_number || lot.id || "").trim();

const collectLinkedStockLotIds = async (root: StockLotRow): Promise<string[]> => {
  const ids = new Set<string>([String(root.id)]);
  const lookup = readLotLookup(root);
  if (!lookup) return [...ids];

  try {
    const dossier = await buildLotTraceabilityDossier(lookup);
    const genealogy = buildGenealogyFromDossier(dossier as Record<string, unknown>);
    const relatedNumbers = new Set<string>();
    for (const node of genealogy.nodes) {
      if (node.label) relatedNumbers.add(String(node.label));
      if (node.id) relatedNumbers.add(String(node.id));
    }

    const candidates = sanitizeDocument(
      await getCollectionModel("stock_lots")
        .find({
          $or: [
            { lot_number: { $in: [...relatedNumbers] } },
            { reception_lot_id: { $in: [...relatedNumbers] } },
            { source_lot_internal: { $in: [...relatedNumbers] } },
            { packaging_palette_id: { $in: [...relatedNumbers] } },
            { production_order_id: { $in: [...relatedNumbers] } },
          ],
        })
        .lean()
        .exec(),
    ) as StockLotRow[];

    for (const candidate of candidates) {
      if (candidate.id) ids.add(String(candidate.id));
    }
  } catch {
    // Genealogy may be incomplete for WIP/PF lots; root hold still applies.
  }

  return [...ids];
};

const writeHoldAudit = async (input: {
  action: string;
  stockLotId: string;
  reason: string;
  actorId?: string | null;
  relatedIds: string[];
  requestId?: string | null;
}) => {
  const audit = await prepareInsertDocument("system_audit_logs", {
    action: input.action,
    entity_type: "stock_lot",
    entity_id: input.stockLotId,
    actor_id: input.actorId ?? null,
    summary: `${input.action} — ${input.reason}`,
    metadata: {
      related_stock_lot_ids: input.relatedIds,
      request_id: input.requestId || null,
      reason: input.reason,
    },
    created_at: new Date().toISOString(),
  });
  await getCollectionModel("system_audit_logs").create([audit]);
  return audit;
};

export const applyQualityHold = async (input: {
  stockLotId: string;
  reason: string;
  actorId?: string | null;
  propagateGenealogy?: boolean;
  requestId?: string | null;
}) => {
  const stockLotId = String(input.stockLotId || "").trim();
  const reason = String(input.reason || "").trim();
  if (!stockLotId) throw badRequest("STOCK_LOT_ID_REQUIRED", "Identifiant de lot de stock requis.");
  if (!reason) throw badRequest("HOLD_REASON_REQUIRED", "Le motif de blocage qualité est obligatoire.");

  const root = sanitizeDocument(
    await getCollectionModel("stock_lots").findOne({ id: stockLotId }).lean().exec(),
  ) as StockLotRow | null;
  if (!root) throw notFound("STOCK_LOT_NOT_FOUND", `Lot de stock ${stockLotId} introuvable.`);

  const targetIds = input.propagateGenealogy === false
    ? [stockLotId]
    : await collectLinkedStockLotIds(root);

  const now = new Date().toISOString();
  const updated: string[] = [];
  for (const id of targetIds) {
    const lot = sanitizeDocument(
      await getCollectionModel("stock_lots").findOne({ id }).lean().exec(),
    ) as StockLotRow | null;
    if (!lot) continue;
    const status = String(lot.status || "").toUpperCase();
    if (status === "CONSUMED" || HOLD_STATUSES.has(status)) continue;
    const result = await getCollectionModel("stock_lots")
      .updateOne(
        { id, status: lot.status },
        { $set: { status: "HOLD", hold_previous_status: lot.status, hold_root_id: stockLotId, hold_reason: reason, held_at: now, held_by: input.actorId ?? null, updated_at: now } },
      )
      .exec();
    if (Number(result.modifiedCount || 0) === 1) updated.push(id);
  }

  await writeHoldAudit({
    action: "STOCK_QUALITY_HOLD",
    stockLotId,
    reason,
    actorId: input.actorId,
    relatedIds: updated,
    requestId: input.requestId,
  });

  return { rootId: stockLotId, heldIds: updated, propagate: input.propagateGenealogy !== false };
};

export const releaseQualityHold = async (input: {
  stockLotId: string;
  reason: string;
  actorId?: string | null;
  propagateGenealogy?: boolean;
  requestId?: string | null;
}) => {
  const stockLotId = String(input.stockLotId || "").trim();
  const reason = String(input.reason || "").trim();
  if (!stockLotId) throw badRequest("STOCK_LOT_ID_REQUIRED", "Identifiant de lot de stock requis.");
  if (!reason) throw badRequest("RELEASE_REASON_REQUIRED", "Le motif de levée de blocage est obligatoire.");

  const root = sanitizeDocument(
    await getCollectionModel("stock_lots").findOne({ id: stockLotId }).lean().exec(),
  ) as StockLotRow | null;
  if (!root) throw notFound("STOCK_LOT_NOT_FOUND", `Lot de stock ${stockLotId} introuvable.`);

  // A warehouse hold is distinct from a QC release. Legacy/unproven holds stay closed.
  if (String(root.status).toUpperCase() !== "HOLD" || !RELEASE_STATUSES.has(String(root.hold_previous_status).toUpperCase())) {
    throw badRequest("QUALITY_RELEASE_DOMAIN_ONLY", "Ce lot nécessite une décision QC ou une preuve de blocage qualité préalable.");
  }

  const targetIds = input.propagateGenealogy === false
    ? [stockLotId]
    : await collectLinkedStockLotIds(root);

  const now = new Date().toISOString();
  const updated: string[] = [];
  for (const id of targetIds) {
    const lot = sanitizeDocument(
      await getCollectionModel("stock_lots").findOne({ id }).lean().exec(),
    ) as StockLotRow | null;
    if (!lot) continue;
    const status = String(lot.status || "").toUpperCase();
    if (status !== "HOLD" || lot.hold_root_id !== stockLotId || !RELEASE_STATUSES.has(String(lot.hold_previous_status).toUpperCase())) continue;
    if (lot.reception_lot_id) {
      const receptionLot = await getCollectionModel("reception_lots").findOne({ id: lot.reception_lot_id }).lean().exec();
      if (receptionLot?.stock_status !== "STOCK_LIBERE") {
        if (id === stockLotId) throw badRequest("QUALITY_RELEASE_DOMAIN_ONLY", "Une décision QC valide est requise pour ce lot.");
        continue;
      }
    }
    const result = await getCollectionModel("stock_lots")
      .updateOne(
        { id, status: "HOLD", hold_root_id: stockLotId, hold_previous_status: lot.hold_previous_status },
        {
          $set: {
            status: lot.hold_previous_status,
            hold_previous_status: null,
            hold_root_id: null,
            hold_reason: null,
            released_at: now,
            released_by: input.actorId ?? null,
            release_reason: reason,
            updated_at: now,
          },
        },
      )
      .exec();
    if (Number(result.modifiedCount || 0) === 1) updated.push(id);
  }

  await writeHoldAudit({
    action: "STOCK_QUALITY_RELEASE",
    stockLotId,
    reason,
    actorId: input.actorId,
    relatedIds: updated,
    requestId: input.requestId,
  });

  return { rootId: stockLotId, releasedIds: updated, propagate: input.propagateGenealogy !== false };
};
