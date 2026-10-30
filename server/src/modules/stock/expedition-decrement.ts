import { badRequest } from "../../core/app-error.js";

/** Same released statuses as packaging consumption. Quarantine and rejection stay blocked. */
export const EXPEDITION_RELEASED_STATUSES = new Set([
  "RELEASED",
  "VALIDATED",
  "STOCK_LIBERE",
  "LIBERE",
]);

export type ExpeditionLine = {
  lot_id?: string | null;
  quantity?: unknown;
  product_id?: string | null;
  scan_token?: string | null;
};

export type ExpeditionLot = {
  id?: string | null;
  lot_number?: string | null;
  status?: string | null;
  current_quantity?: unknown;
  product_id?: string | null;
};

const readQuantity = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

/**
 * Validates a pick before any write.
 * Returns the total kilograms to remove per lot, so two lines for one lot
 * cannot each be checked against the original quantity.
 */
export const planExpeditionDecrement = (lines: ExpeditionLine[], lots: ExpeditionLot[]) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw badRequest("EXPEDITION_LINES_REQUIRED", "Une expédition exige au moins une ligne de prélèvement.");
  }

  const byId = new Map(
    lots
      .map((lot) => [String(lot.id || ""), lot] as const)
      .filter(([id]) => Boolean(id)),
  );
  const totals = new Map<string, number>();

  for (const line of lines) {
    const lotId = String(line.lot_id || "").trim();
    if (!lotId) {
      throw badRequest("EXPEDITION_LOT_REQUIRED", "Chaque ligne d'expédition doit citer un lot.");
    }

    const quantity = readQuantity(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw badRequest(
        "EXPEDITION_QUANTITY_INVALID",
        "La quantité expédiée doit être supérieure à 0.",
        { lotId, quantity: line.quantity },
      );
    }

    const lot = byId.get(lotId);
    if (!lot) {
      throw badRequest(
        "EXPEDITION_LOT_NOT_FOUND",
        `Le lot ${lotId} est introuvable. L'expédition n'est pas enregistrée.`,
        { lotId },
      );
    }

    const status = String(lot.status || "").toUpperCase();
    if (!EXPEDITION_RELEASED_STATUSES.has(status)) {
      throw badRequest(
        "LOT_NOT_CONSUMABLE",
        `Le lot ${lot.lot_number || lotId} n'est pas libéré pour l'expédition (statut: ${status || "inconnu"}).`,
        { lotId, status },
      );
    }

    totals.set(lotId, Number(((totals.get(lotId) || 0) + quantity).toFixed(3)));
  }

  for (const [lotId, quantity] of totals) {
    const lot = byId.get(lotId);
    const available = readQuantity(lot?.current_quantity);
    if (!Number.isFinite(available) || quantity > available + 0.001) {
      throw badRequest(
        "INSUFFICIENT_STOCK",
        `Poids demandé (${quantity} kg) supérieur au stock disponible (${Number.isFinite(available) ? available : 0} kg) sur ${lot?.lot_number || lotId}.`,
        { lotId, quantity, available: Number.isFinite(available) ? available : 0 },
      );
    }
  }

  return totals;
};
