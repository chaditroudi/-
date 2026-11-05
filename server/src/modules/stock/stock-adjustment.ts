import { badRequest, notFound } from "../../core/app-error.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { changeStockLotQuantity } from "./stock-quantity.js";

type StockLotRow = {
  id?: string;
  lot_number?: string | null;
  current_quantity?: number | null;
  status?: string | null;
  product_id?: string | null;
  unit?: string | null;
};

/**
 * Authorized inventory reconciliation through the CAS quantity primitive.
 * Never bypasses stock integrity: delta is applied atomically and audited.
 */
export const applyInventoryAdjustment = async (input: {
  stockLotId: string;
  countedQuantityKg?: number;
  deltaKg?: number;
  reason: string;
  actorId?: string | null;
  requestId?: string | null;
  countPayload?: Record<string, unknown>;
}) => {
  const stockLotId = String(input.stockLotId || "").trim();
  const reason = String(input.reason || "").trim();
  if (!stockLotId) throw badRequest("STOCK_LOT_ID_REQUIRED", "Identifiant de lot de stock requis.");
  if (!reason) throw badRequest("ADJUSTMENT_REASON_REQUIRED", "Le motif d'ajustement est obligatoire.");

  const requestId = String(input.requestId || "").trim();
  if (requestId) {
    const prior = sanitizeDocument(
      await getCollectionModel("stock_movements")
        .findOne({ request_id: requestId, movement_type: { $in: ["AJUSTEMENT", "ADJUSTMENT"] } })
        .lean()
        .exec(),
    ) as Record<string, unknown> | null;
    if (prior?.id) {
      const count = sanitizeDocument(
        await getCollectionModel("inventory_counts").findOne({ request_id: requestId }).lean().exec(),
      );
      return { count, movement: prior, replayed: true };
    }
  }

  const lot = sanitizeDocument(
    await getCollectionModel("stock_lots").findOne({ id: stockLotId }).lean().exec(),
  ) as StockLotRow | null;
  if (!lot) throw notFound("STOCK_LOT_NOT_FOUND", `Lot de stock ${stockLotId} introuvable.`);

  const before = Number(lot.current_quantity ?? 0);
  let delta: number;
  let counted: number;

  const countedRaw = Number(input.countedQuantityKg);
  const deltaRaw = Number(input.deltaKg);
  if (Number.isFinite(countedRaw)) {
    counted = countedRaw;
    if (counted < 0) throw badRequest("COUNTED_QTY_INVALID", "La quantité comptée doit être ≥ 0.");
    delta = Number((counted - before).toFixed(3));
  } else if (Number.isFinite(deltaRaw)) {
    delta = Number(deltaRaw.toFixed(3));
    counted = Number((before + delta).toFixed(3));
    if (counted < -0.001) {
      throw badRequest("ADJUSTMENT_WOULD_GO_NEGATIVE", "L'ajustement rendrait le stock négatif.");
    }
  } else {
    throw badRequest("ADJUSTMENT_QTY_REQUIRED", "counted_quantity ou delta_kg est requis.");
  }

  if (Math.abs(delta) < 0.001) {
    throw badRequest("ADJUSTMENT_NOOP", "Aucun écart à appliquer sur ce lot.");
  }

  const now = new Date().toISOString();
  const change = await changeStockLotQuantity(stockLotId, delta, now);

  const movement = await prepareInsertDocument("stock_movements", {
    movement_type: "AJUSTEMENT",
    lot_id: stockLotId,
    product_id: lot.product_id ?? null,
    quantity: Math.abs(delta),
    unit: lot.unit ?? "kg",
    document_type: "INVENTORY_COUNT",
    document_reference: requestId || `adj:${stockLotId}:${now}`,
    request_id: requestId || null,
    performed_by: input.actorId ?? null,
    notes: reason,
    created_at: now,
    metadata: {
      before_kg: change.before,
      after_kg: change.after,
      delta_kg: delta,
      counted_kg: counted,
    },
  });
  await getCollectionModel("stock_movements").create([movement]);

  const count = await prepareInsertDocument("inventory_counts", {
    ...(input.countPayload || {}),
    stock_lot_id: stockLotId,
    lot_number: lot.lot_number ?? null,
    expected_quantity: change.before,
    counted_quantity: counted,
    delta_kg: delta,
    reason,
    status: "APPLIED",
    request_id: requestId || null,
    movement_id: movement.id,
    performed_by: input.actorId ?? null,
    created_at: now,
    updated_at: now,
  });
  await getCollectionModel("inventory_counts").create([count]);

  return { count: sanitizeDocument(count), movement: sanitizeDocument(movement), change, replayed: false };
};
