import { badRequest, conflict, notFound } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";

type StockLotRow = {
  id?: string;
  lot_number?: string | null;
  current_quantity?: number | null;
  status?: string | null;
  [key: string]: unknown;
};

export type StockQuantityChange = {
  lot: StockLotRow;
  before: number;
  after: number;
};

const StockLots = () => getCollectionModel("stock_lots");

/**
 * Atomic compare-and-set on stock_lots.current_quantity.
 * Concurrent consumers cannot both spend the same kilos.
 * Never persists a negative quantity.
 */
export const changeStockLotQuantity = async (
  stockLotId: string,
  deltaKg: number,
  now: string,
  options: { maxAttempts?: number; requireReleased?: boolean } = {},
): Promise<StockQuantityChange> => {
  const maxAttempts = options.maxAttempts ?? 5;
  const id = String(stockLotId || "").trim();
  if (!id) throw badRequest("STOCK_LOT_ID_REQUIRED", "Identifiant de lot de stock requis.");

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const lot = sanitizeDocument(await StockLots().findOne({ id }).lean().exec()) as StockLotRow | null;
    if (!lot) throw notFound("STOCK_LOT_NOT_FOUND", `Lot de stock ${id} introuvable.`);
    if (options.requireReleased && !['VALIDATED', 'RELEASED', 'STOCK_LIBERE', 'LIBERE'].includes(String(lot.status).toUpperCase())) {
      throw badRequest('LOT_NOT_CONSUMABLE', 'Le lot source est bloqué ou non libéré.');
    }

    const before = Number(lot.current_quantity ?? 0);
    if (!Number.isFinite(before)) {
      throw badRequest("STOCK_QTY_INVALID", `Quantité invalide sur le lot ${String(lot.lot_number ?? id)}.`);
    }

    const afterRaw = Number((before + deltaKg).toFixed(3));
    if (afterRaw < -0.001) {
      throw badRequest(
        "INSUFFICIENT_STOCK",
        `Stock disponible insuffisant sur ${String(lot.lot_number ?? id)} (${before} kg, besoin ${-deltaKg} kg).`,
        { availableKg: before, requestedKg: -deltaKg, lotId: id },
      );
    }

    const after = Math.max(0, afterRaw);
    const status =
      after <= 0
        ? "CONSUMED"
        : lot.status === "CONSUMED"
          ? "VALIDATED"
          : lot.status;

    const result = await StockLots()
      .updateOne(
        { id, current_quantity: lot.current_quantity ?? null, ...(lot.status !== undefined ? { status: lot.status } : {}) },
        { $set: { current_quantity: after, status, updated_at: now } },
      )
      .exec();

    if (Number(result.modifiedCount || 0) === 1) {
      return { lot, before, after };
    }
  }

  throw conflict(
    "STOCK_LOT_CONCURRENT_UPDATE",
    "Le stock du lot change en ce moment : réessayez.",
    { lotId: id, deltaKg },
  );
};

/** Consume a positive kg amount (delta is negative). */
export const consumeStockLotKg = async (
  stockLotId: string,
  consumeKg: number,
  now: string,
): Promise<StockQuantityChange> => {
  const qty = Number(consumeKg);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw badRequest("STOCK_CONSUME_QTY_INVALID", "La quantité à consommer doit être > 0.");
  }
  return changeStockLotQuantity(stockLotId, -qty, now, { requireReleased: true });
};

/** Restore / credit a positive kg amount. */
export const creditStockLotKg = async (
  stockLotId: string,
  creditKg: number,
  now: string,
): Promise<StockQuantityChange> => {
  const qty = Number(creditKg);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw badRequest("STOCK_CREDIT_QTY_INVALID", "La quantité à créditer doit être > 0.");
  }
  return changeStockLotQuantity(stockLotId, qty, now);
};
