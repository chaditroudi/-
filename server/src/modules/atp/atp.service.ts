/**
 * Available-to-promise (ATP) — Wave D scaffold.
 * FEFO stock (VALIDATED) + cold/dry free capacity → earliest ship week.
 */

import { Injectable } from "@nestjs/common";

import { badRequest } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";

const StockLots = () => getCollectionModel("stock_lots");
const StorageZones = () => getCollectionModel("storage_zones");
const PackagingPalettes = () => getCollectionModel("packaging_palettes");
const ExportOrders = () => getCollectionModel("export_orders");

const readNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const startOfUtcWeek = (date = new Date()) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
};

const addWeeks = (date: Date, weeks: number) => {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + weeks * 7);
  return next;
};

const isoWeekLabel = (date: Date) => {
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

@Injectable()
export class AtpService {
  /**
   * Promise ship week for qty_kg of a product (or any graded stock when product omitted).
   */
  async promise(input: { productId?: string | null; qtyKg: number; grade?: string | null }) {
    const qtyKg = readNumber(input.qtyKg);
    if (qtyKg <= 0) {
      throw badRequest("QTY_REQUIRED", "qty_kg must be > 0.");
    }

    const query: Record<string, unknown> = {
      status: { $in: ["VALIDATED", "AVAILABLE", "LIBERE", "STOCK_LIBERE"] },
      current_quantity: { $gt: 0 },
    };
    if (input.productId) query.product_id = input.productId;
    if (input.grade) query.grade = input.grade;

    const lots = (sanitizeDocument(
      await StockLots()
        .find(query)
        .sort({ reception_date: 1, created_at: 1 })
        .limit(500)
        .lean()
        .exec(),
    ) as Array<Record<string, unknown>>) || [];

    // Prefer FEFO: earliest reception_date first (already sorted).
    let remaining = qtyKg;
    const allocations: Array<{
      lot_id: string;
      lot_number: string | null;
      qty_kg: number;
      reception_date: string | null;
      cost_tnd_per_kg: number | null;
    }> = [];

    for (const lot of lots) {
      if (remaining <= 0) break;
      const available = readNumber(lot.current_quantity);
      if (available <= 0) continue;
      const take = Math.min(available, remaining);
      allocations.push({
        lot_id: String(lot.id),
        lot_number: lot.lot_number ? String(lot.lot_number) : null,
        qty_kg: Number(take.toFixed(3)),
        reception_date: lot.reception_date ? String(lot.reception_date) : null,
        cost_tnd_per_kg:
          lot.cost_tnd_per_kg != null && Number.isFinite(Number(lot.cost_tnd_per_kg))
            ? Number(lot.cost_tnd_per_kg)
            : null,
      });
      remaining = Number((remaining - take).toFixed(3));
    }

    const coveredKg = Number((qtyKg - Math.max(0, remaining)).toFixed(3));
    const shortfallKg = Number(Math.max(0, remaining).toFixed(3));

    const zones = (sanitizeDocument(
      await StorageZones().find({ is_active: { $ne: false } }).lean().exec(),
    ) as Array<Record<string, unknown>>) || [];

    const freeCapacityKg = zones.reduce((sum, zone) => {
      const cap = readNumber(zone.capacity_kg);
      const load = readNumber(zone.current_load_kg);
      return sum + Math.max(0, cap - load);
    }, 0);

    const sealedPalettes = (sanitizeDocument(
      await PackagingPalettes()
        .find({ status: "SCELLE" })
        .limit(200)
        .lean()
        .exec(),
    ) as Array<Record<string, unknown>>) || [];
    const sealedReadyKg = sealedPalettes.reduce(
      (sum, row) => sum + readNumber(row.net_weight_kg),
      0,
    );

    const week0 = startOfUtcWeek();
    // Heuristic: full coverage → this week; partial → +1 week; none → +2 weeks (need production).
    const weeksOut = shortfallKg <= 0 ? 0 : coveredKg > 0 ? 1 : 2;
    const shipWeekStart = addWeeks(week0, weeksOut);
    const shipWeek = isoWeekLabel(shipWeekStart);

    const confiable =
      shortfallKg <= 0 && freeCapacityKg >= 0
        ? "committed"
        : coveredKg > 0
          ? "partial"
          : "unavailable";

    return {
      wave: "D",
      requested_kg: qtyKg,
      product_id: input.productId || null,
      grade: input.grade || null,
      covered_kg: coveredKg,
      shortfall_kg: shortfallKg,
      sealed_ready_kg: Number(sealedReadyKg.toFixed(3)),
      free_storage_capacity_kg: Number(freeCapacityKg.toFixed(3)),
      ship_week: shipWeek,
      ship_week_start: shipWeekStart.toISOString().slice(0, 10),
      confidence: confiable,
      basis: "fefo_stock + sealed_palettes + zone_free_capacity",
      allocations,
      notes:
        confiable === "committed"
          ? "Stock FEFO couvre la demande — semaine proposée."
          : confiable === "partial"
            ? "Couverture partielle — semaine +1 pour compléter (production / triage)."
            : "Pas de stock validé — semaine indicative +2 (à confirmer atelier).",
    };
  }

  /**
   * Wave D — calcule la promesse ATP pour une commande export et l'inscrit sur
   * la commande (semaine de livraison, confiance, couverture). Rend la promesse
   * "vendable": elle vit sur la commande, plus seulement dans un panneau lecture.
   */
  async promiseForOrder(orderId: string, actorId?: string | null) {
    const id = String(orderId || "").trim();
    if (!id) throw badRequest("ORDER_ID_REQUIRED", "orderId requis.");

    const order = sanitizeDocument(
      await ExportOrders().findOne({ id }).lean().exec(),
    ) as Record<string, unknown> | null;
    if (!order) throw badRequest("ORDER_NOT_FOUND", "Commande export introuvable.");

    const lines = Array.isArray(order.lines) ? (order.lines as Array<Record<string, unknown>>) : [];
    const qtyKg =
      readNumber(order.total_weight_kg) ||
      lines.reduce((sum, line) => sum + readNumber(line.net_weight_kg), 0);
    if (qtyKg <= 0) {
      throw badRequest("ORDER_QTY_REQUIRED", "La commande n'a aucun poids à promettre.");
    }

    // Grade dominant si toutes les lignes partagent le même, sinon indifférencié.
    const grades = Array.from(
      new Set(lines.map((line) => String(line.quality_grade || "").trim()).filter(Boolean)),
    );
    const grade = grades.length === 1 ? grades[0] : null;

    const promise = await this.promise({ qtyKg, grade });

    const now = new Date().toISOString();
    const atpPatch = {
      atp_ship_week: promise.ship_week,
      atp_ship_week_start: promise.ship_week_start,
      atp_confidence: promise.confidence,
      atp_covered_kg: promise.covered_kg,
      atp_shortfall_kg: promise.shortfall_kg,
      atp_requested_kg: promise.requested_kg,
      atp_basis: promise.basis,
      atp_promised_at: now,
      atp_promised_by: actorId || null,
      updated_at: now,
    };

    await ExportOrders().updateOne({ id }, { $set: atpPatch }).exec();

    const updated = sanitizeDocument(await ExportOrders().findOne({ id }).lean().exec());
    return { promise, order: updated };
  }

  async summary() {
    const lots = (sanitizeDocument(
      await StockLots()
        .find({
          status: { $in: ["VALIDATED", "AVAILABLE", "LIBERE", "STOCK_LIBERE"] },
          current_quantity: { $gt: 0 },
        })
        .lean()
        .exec(),
    ) as Array<Record<string, unknown>>) || [];

    const availableKg = lots.reduce((sum, row) => sum + readNumber(row.current_quantity), 0);
    const promise = await this.promise({ qtyKg: Math.max(1000, availableKg || 1000) });

    return {
      wave: "D",
      available_validated_kg: Number(availableKg.toFixed(3)),
      lot_count: lots.length,
      free_storage_capacity_kg: promise.free_storage_capacity_kg,
      sealed_ready_kg: promise.sealed_ready_kg,
      next_ship_week_sample: promise.ship_week,
      basis: promise.basis,
    };
  }
}

export const atpService = new AtpService();
