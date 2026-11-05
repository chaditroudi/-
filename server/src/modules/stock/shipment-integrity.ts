import { badRequest, notFound } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";

type MovementRow = {
  id?: string;
  shipment_id?: string | null;
  document_reference?: string | null;
  lot_id?: string | null;
  quantity?: number | null;
  movement_type?: string | null;
};

type ShipmentLineRow = {
  id?: string;
  shipment_id?: string | null;
  lot_id?: string | null;
  stock_lot_id?: string | null;
  quantity?: number | null;
  quantity_kg?: number | null;
  allocated_kg?: number | null;
};

const readKg = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Gate 2 shipment close: picks must exist for this shipment, match authorized
 * lines when lines exist, and must not leave required quantities unpicked.
 */
export const assertShipmentReadyToShip = async (shipmentId: string) => {
  const id = String(shipmentId || "").trim();
  if (!id) throw badRequest("SHIPMENT_ID_REQUIRED", "Identifiant d'expédition requis.");

  const shipment = sanitizeDocument(
    await getCollectionModel("shipment_preparations").findOne({ id }).lean().exec(),
  ) as Record<string, unknown> | null;
  if (!shipment) throw notFound("SHIPMENT_NOT_FOUND", `Expédition ${id} introuvable.`);

  const status = String(shipment.status || "").toUpperCase();
  if (status === "CANCELLED" || status === "ANNULE" || status === "ANNULÉ") {
    throw badRequest("SHIPMENT_CANCELLED", "Une expédition annulée ne peut pas être clôturée.", { shipmentId: id });
  }
  if (status === "SHIPPED" || status === "EXPEDIE" || status === "EXPÉDIÉ") {
    return { shipment, picks: [], replayed: true };
  }

  const Movements = getCollectionModel("stock_movements");
  const picks = sanitizeDocument(
    await Movements.find({
      movement_type: { $in: ["EXPEDITION", "SHIPMENT", "SORTIE"] },
      $or: [{ shipment_id: id }, { document_reference: id }],
    }).lean().exec(),
  ) as MovementRow[];

  if (!Array.isArray(picks) || picks.length === 0) {
    throw badRequest(
      "SHIPMENT_PICK_REQUIRED",
      "Une expédition ne peut pas être clôturée sans prélèvement stock (POST /api/stock/expedition).",
      { shipmentId: id },
    );
  }

  for (const pick of picks) {
    const pickShipment = String(pick.shipment_id || pick.document_reference || "");
    if (pickShipment && pickShipment !== id) {
      throw badRequest(
        "SHIPMENT_PICK_MISMATCH",
        "Un mouvement d'expédition ne correspond pas à cette préparation.",
        { shipmentId: id, movementId: pick.id, pickShipment },
      );
    }
  }

  const lines = sanitizeDocument(
    await getCollectionModel("shipment_lines").find({ shipment_id: id }).lean().exec(),
  ) as ShipmentLineRow[];

  if (lines.length > 0) {
    const pickedByLot = new Map<string, number>();
    for (const pick of picks) {
      const lotId = String(pick.lot_id || "");
      if (!lotId) continue;
      pickedByLot.set(lotId, Number(((pickedByLot.get(lotId) || 0) + readKg(pick.quantity)).toFixed(3)));
    }

    for (const line of lines) {
      const lotId = String(line.stock_lot_id || line.lot_id || "");
      const required = readKg(line.quantity_kg ?? line.allocated_kg ?? line.quantity);
      if (!lotId || required <= 0) continue;
      const picked = pickedByLot.get(lotId) || 0;
      if (picked + 0.001 < required) {
        throw badRequest(
          "SHIPMENT_PICK_INCOMPLETE",
          `Prélèvement incomplet pour le lot ${lotId}: ${picked} kg / ${required} kg requis.`,
          { shipmentId: id, lotId, picked, required },
        );
      }
    }
  }

  // Detect duplicate request lines that would overstate picks without matching stock.
  const seenKeys = new Set<string>();
  for (const pick of picks) {
    const key = `${pick.lot_id}:${Number(pick.quantity)}:${pick.id}`;
    if (seenKeys.has(key)) {
      throw badRequest("SHIPMENT_PICK_DUPLICATE", "Prélèvements d'expédition en double détectés.", {
        shipmentId: id,
        movementId: pick.id,
      });
    }
    seenKeys.add(key);
  }

  return { shipment, picks, replayed: false };
};
