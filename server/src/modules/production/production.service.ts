import { Injectable } from "@nestjs/common";
import { badRequest, conflict, notFound } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import {
  assertMassBalanceClosed,
  loadConfiguredMassBalanceTolerancePct,
} from "../trust/mass-balance.js";
import { lotLifecycleService } from "../trust/lot-lifecycle.service.js";
import { changeStockLotQuantity } from "../stock/stock-quantity.js";

const Orders = () => getCollectionModel("production_orders");
const Steps = () => getCollectionModel("production_steps");
const Allocations = () => getCollectionModel("production_lot_allocations");
const StepDefs = () => getCollectionModel("production_step_definitions");
const OutputLots = () => getCollectionModel("production_output_lots");
const ReceptionLots = () => getCollectionModel("reception_lots");
const Receptions = () => getCollectionModel("receptions_v2");
const StockLots = () => getCollectionModel("stock_lots");
const StockMovements = () => getCollectionModel("stock_movements");

type Row = Record<string, unknown>;

/** Stored vocabulary, shared with production_order_statuses and analytics. */
type OrderStatus = "draft" | "planned" | "in_progress" | "completed" | "cancelled";

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ["planned", "cancelled"],
  planned: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/** Older rows were written in upper case by this service; read either. */
const statusOf = (row: Row | null | undefined) => String(row?.status || "draft").toLowerCase() as OrderStatus;
const ACTIVE_STATUSES: OrderStatus[] = ["draft", "planned", "in_progress"];
const DONE_STEP_STATUSES = new Set(["completed", "skipped"]);

/** Fields only the lifecycle endpoints write; a descriptive PATCH must not change them. */
export const PRODUCTION_LIFECYCLE_FIELDS = [
  "id", "_id", "order_number", "status", "created_by", "created_at",
  "actual_start_at", "actual_end_at", "actual_output_kg", "waste_kg", "actual_yield_pct",
  "mass_balance_variance_pct", "cancel_reason",
];

const readOrder = async (orderId: string) => {
  const order = sanitizeDocument(await Orders().findOne({ id: orderId }).lean().exec()) as Row | null;
  if (!order) throw notFound("ORDER_NOT_FOUND", `Ordre ${orderId} introuvable`);
  return order;
};

const assertTransition = (order: Row, next: OrderStatus, verb: string) => {
  const current = statusOf(order);
  if (!ALLOWED_TRANSITIONS[current]?.includes(next)) {
    throw badRequest("INVALID_TRANSITION", `Impossible de ${verb} un ordre en statut ${current}.`);
  }
  return current;
};

/** Allocations still part of the order (a removed allocation is kept with removed_at). */
const activeAllocations = async (orderId: string) =>
  (sanitizeDocument(
    await Allocations().find({ production_order_id: orderId }).lean().exec(),
  ) as Row[]).filter((allocation) => !allocation.removed_at);

/**
 * Raw-material availability is the stock projection of the reception lot
 * (stock_lots.current_quantity), like packaging, expeditions and ATP. The
 * reception lot keeps the received quantity as history.
 */
/** A held row speaks for the whole lot; used-up rows say nothing about its quality. */
const findStockLot = async (receptionLotId: string) => {
  const rows = sanitizeDocument(
    await StockLots().find({ reception_lot_id: receptionLotId }).lean().exec(),
  ) as Row[];
  const active = rows.filter((row) => row.status !== "CONSUMED");
  return active.find((row) => row.status !== "VALIDATED") ?? active[0] ?? rows[0] ?? null;
};

/** Lot details shown with an allocation or an available lot (reception number, supplier, bio). */
const describeReceptionLots = async (lotIds: string[]) => {
  if (lotIds.length === 0) return new Map<string, Row>();
  const lots = sanitizeDocument(await ReceptionLots().find({ id: { $in: lotIds } }).lean().exec()) as Row[];
  const receptionIds = Array.from(new Set(lots.map((lot) => String(lot.reception_id || "")).filter(Boolean)));
  const receptions = receptionIds.length > 0
    ? sanitizeDocument(await Receptions().find({ id: { $in: receptionIds } }).lean().exec()) as Row[]
    : [];
  const receptionById = new Map(receptions.map((reception) => [String(reception.id), reception]));
  return new Map(lots.map((lot) => {
    const reception = receptionById.get(String(lot.reception_id || ""));
    return [String(lot.id), {
      id: lot.id,
      reception_id: lot.reception_id ?? null,
      lot_internal: lot.lot_internal ?? null,
      lot_supplier: lot.lot_supplier ?? "",
      stock_status: lot.stock_status ?? null,
      quantity: Number(lot.quantity ?? 0),
      unit: lot.unit ?? "kg",
      variety: lot.variety ?? reception?.variety ?? null,
      bio_declared: reception?.bio_declared ?? null,
      reception_number: reception?.reception_number ?? null,
      supplier_name: reception?.supplier_name_snapshot ?? null,
    } as Row];
  }));
};

@Injectable()
export class ProductionService {
  // ── Create order with step auto-generation ───────────────────────────────

  async createOrder(body: Record<string, unknown>, actor: string | null) {
    const productionType = String(body.production_type || "STANDARD");
    const descriptive = Object.fromEntries(
      Object.entries(body).filter(([key]) => !PRODUCTION_LIFECYCLE_FIELDS.includes(key)),
    );
    // The order number is issued by the server sequence, never by the client.
    const doc = await prepareInsertDocument("production_orders", {
      ...descriptive,
      status: "draft",
      created_by: actor,
    });

    await Orders().insertOne(doc as any);
    const order = sanitizeDocument(await Orders().findOne({ id: doc.id }).lean().exec()) as Row;

    // Auto-generate steps from step definitions matching production type
    const defs = (sanitizeDocument(
      await StepDefs()
        .find({
          $or: [
            { production_type: productionType },
            { production_type: { $exists: false } },
            { is_universal: true },
          ],
        })
        .sort({ sequence_order: 1 })
        .lean()
        .exec(),
    ) as Row[]).filter((def) => def.is_active !== false);

    if (defs.length > 0) {
      const stepDocs = await Promise.all(
        defs.map((def) =>
          prepareInsertDocument("production_steps", {
            production_order_id: doc.id,
            step_definition_id: def.id,
            name: def.name,
            sequence_order: def.sequence_order,
            is_mandatory: def.is_mandatory ?? true,
            status: "pending",
            input_quantity: body.target_quantity ?? null,
            output_quantity: null,
            waste_quantity: 0,
          }),
        ),
      );
      await Steps().insertMany(stepDocs as any[]);
    }

    return order;
  }

  // ── Plan order ───────────────────────────────────────────────────────────

  async planOrder(orderId: string) {
    const order = await readOrder(orderId);
    assertTransition(order, "planned", "planifier");
    const now = new Date().toISOString();
    await Orders().updateOne({ id: orderId }, { $set: { status: "planned", updated_at: now } }).exec();
    return readOrder(orderId);
  }

  // ── Start order: validate lots STOCK_LIBERE, consume stock, set in_progress ──

  async startOrder(orderId: string, actor: string | null) {
    const order = await readOrder(orderId);
    assertTransition(order, "in_progress", "démarrer");

    // RG-P01: all allocated lots must be STOCK_LIBERE
    const allocations = await activeAllocations(orderId);
    if (allocations.length === 0) {
      throw badRequest("NO_LOTS_ALLOCATED", "Aucun lot n'est alloué à cet ordre : allouez au moins un lot libéré avant le démarrage.");
    }

    const lotIds = allocations.map((a) => a.lot_id as string).filter(Boolean);
    const lots = sanitizeDocument(
      await ReceptionLots().find({ id: { $in: lotIds } }).lean().exec(),
    ) as Row[];

    const notLibered = lots.filter((l) => l.stock_status !== "STOCK_LIBERE");
    if (notLibered.length > 0) {
      const ids = notLibered.map((l) => l.lot_internal ?? l.id).join(", ");
      throw badRequest("LOT_NOT_LIBERE", `Lots non libérés : ${ids}`);
    }

    const now = new Date().toISOString();
    const orderNumber = String(order.order_number || orderId);

    // Validate every allocation against the stock projection before consuming anything.
    const plan: Array<{ allocation: Row; stockLot: Row; allocatedKg: number; label: string }> = [];
    for (const allocation of allocations.filter((entry) => !entry.consumed_at)) {
      const lotId = String(allocation.lot_id || "");
      const lot = lots.find((entry) => String(entry.id) === lotId);
      const label = String(lot?.lot_internal ?? lotId);
      const allocatedKg = Number(allocation.allocated_kg ?? 0);
      if (allocatedKg <= 0) {
        throw badRequest("ALLOCATED_KG_REQUIRED", `allocated_kg doit être > 0 pour le lot ${label}.`);
      }
      const stockLot = await findStockLot(lotId);
      if (!stockLot || stockLot.status !== "VALIDATED") {
        throw badRequest("LOT_NOT_LIBERE", `Le lot ${label} n'est pas disponible en stock (statut stock : ${stockLot?.status ?? "absent"}).`);
      }
      const availableKg = Number(stockLot.current_quantity ?? 0);
      if (allocatedKg > availableKg + 0.001) {
        throw badRequest(
          "INSUFFICIENT_STOCK",
          `Poids alloué (${allocatedKg} kg) supérieur au stock disponible (${availableKg} kg) sur ${label}.`,
          { allocatedKg, availableKg, lotId },
        );
      }
      plan.push({ allocation, stockLot, allocatedKg, label });
    }

    // Each allocation is claimed once: a double « Démarrer » or a retry never consumes twice.
    for (const { allocation, stockLot, allocatedKg, label } of plan) {
      const claimed = await Allocations()
        .updateOne(
          { id: allocation.id, consumed_at: null },
          { $set: { consumed_at: now, consumed_kg: allocatedKg, updated_at: now } },
        )
        .exec();
      if (Number(claimed.modifiedCount || 0) !== 1) continue;
      try {
        await changeStockLotQuantity(String(stockLot.id), -allocatedKg, now);
      } catch (error) {
        await Allocations()
          .updateOne({ id: allocation.id }, { $set: { consumed_at: null, consumed_kg: null, updated_at: now } })
          .exec();
        throw error;
      }
      const movement = await prepareInsertDocument("stock_movements", {
        movement_type: "CONSOMMATION",
        lot_id: stockLot.id,
        product_id: stockLot.product_id ?? null,
        quantity: allocatedKg,
        unit: stockLot.unit ?? "kg",
        document_type: "PRODUCTION_ORDER",
        document_reference: orderNumber,
        request_id: `production:${String(allocation.id)}:consume`,
        performed_by: actor,
        notes: `Consommation ${allocatedKg} kg du lot ${label} par l'OF ${orderNumber}`,
        created_at: now,
      });
      await StockMovements().create([movement]);
    }

    await Orders().updateOne({ id: orderId }, { $set: { status: "in_progress", actual_start_at: now, updated_at: now } });
    return readOrder(orderId);
  }

  // ── Complete order: validate mandatory steps, calculate yield ─────────────

  async completeOrder(orderId: string, body: Record<string, unknown>, actor: string | null) {
    const order = await readOrder(orderId);
    if (statusOf(order) === "completed") {
      return order;
    }
    if (statusOf(order) !== "in_progress") {
      throw badRequest("INVALID_TRANSITION", `L'ordre doit être en cours pour être terminé (état actuel : ${statusOf(order)}).`);
    }

    // RG-P05: all mandatory steps must be completed or skipped
    const steps = sanitizeDocument(
      await Steps().find({ production_order_id: orderId }).lean().exec(),
    ) as Row[];

    const blockedSteps = steps.filter(
      (s) => s.is_mandatory !== false && !DONE_STEP_STATUSES.has(String(s.status || "").toLowerCase()),
    );
    if (blockedSteps.length > 0) {
      const names = blockedSteps.map((s) => s.name ?? s.id).join(", ");
      throw badRequest("MANDATORY_STEPS_INCOMPLETE", `Étapes obligatoires non terminées : ${names}`);
    }

    // RG-P07: calculate yield + Wave B closed mass balance
    const allocations = await activeAllocations(orderId);
    const totalInputKg = allocations.reduce((sum, a) => sum + Number(a.consumed_kg ?? a.allocated_kg ?? 0), 0);

    // Output and waste come from what operators recorded (output lots, step waste) unless given explicitly.
    const outputLots = sanitizeDocument(
      await OutputLots().find({ production_order_id: orderId }).lean().exec(),
    ) as Row[];
    const recordedOutputKg = outputLots.reduce((sum, lot) => sum + Number(lot.quantity ?? 0), 0);
    const recordedWasteKg = steps.reduce((sum, step) => sum + Number(step.waste_quantity ?? 0), 0);
    const actualOutputKg = Number(body.actual_output_kg ?? recordedOutputKg);
    const wasteKg = Number(body.waste_kg ?? recordedWasteKg);
    // Gate 2: manufacturing completion enforces closed mass balance at the domain boundary.
    const balance = assertMassBalanceClosed(
      { inputKg: totalInputKg, outputsKg: [actualOutputKg], wasteKg },
      {
        tolerancePct: await loadConfiguredMassBalanceTolerancePct(),
        mode: "enforce",
        context: `OF production ${orderId}`,
      },
    );

    const yieldPct =
      totalInputKg > 0 ? Math.round((actualOutputKg / totalInputKg) * 100 * 10) / 10 : null;

    const now = new Date().toISOString();
    const orderNumber = String(order.order_number || orderId);
    const claimed = await Orders()
      .updateOne(
        { id: orderId, status: { $in: ["in_progress", "IN_PROGRESS"] } },
        {
          $set: {
            status: "completed",
            actual_end_at: now,
            actual_output_kg: actualOutputKg,
            waste_kg: wasteKg,
            actual_yield_pct: yieldPct,
            mass_balance_variance_pct: balance.variancePct,
            notes: body.notes ?? order.notes,
            updated_at: now,
          },
        },
      )
      .exec();
    if (Number(claimed.modifiedCount || 0) !== 1) {
      const current = await readOrder(orderId);
      if (statusOf(current) === "completed") return current;
      throw badRequest("INVALID_TRANSITION", `L'ordre doit être en cours pour être terminé (état actuel : ${statusOf(current)}).`);
    }

    // Linked output stock — one lot per completed OF; retries must not mint a second lot.
    if (actualOutputKg > 0.001) {
      const existingOutput = sanitizeDocument(
        await StockLots()
          .findOne({
            source_stage: "PRODUCTION",
            production_order_id: orderId,
          })
          .lean()
          .exec(),
      ) as Row | null;
      if (!existingOutput) {
        const outputLotNumber =
          String(body.output_lot_number || "").trim() || `${orderNumber}-OUT`;
        const parentReceptionLotId = String(allocations[0]?.lot_id || "") || null;
        const outputLot = await prepareInsertDocument("stock_lots", {
          lot_number: outputLotNumber,
          product_id: order.product_id ?? null,
          source_stage: "PRODUCTION",
          production_order_id: orderId,
          source_lot_internal: parentReceptionLotId,
          reception_lot_id: null,
          initial_quantity: actualOutputKg,
          current_quantity: actualOutputKg,
          unit: "kg",
          status: "VALIDATED",
          category: "WIP",
          reception_date: now.slice(0, 10),
          created_by: actor,
          created_at: now,
          updated_at: now,
        });
        await StockLots().create([outputLot]);
        const movement = await prepareInsertDocument("stock_movements", {
          movement_type: "RECEPTION",
          lot_id: outputLot.id,
          product_id: order.product_id ?? null,
          quantity: actualOutputKg,
          unit: "kg",
          document_type: "PRODUCTION_COMPLETE",
          document_reference: orderNumber,
          request_id: `production:${orderId}:output`,
          performed_by: actor,
          notes: `Sortie production ${actualOutputKg} kg — OF ${orderNumber}`,
          created_at: now,
        });
        await StockMovements().create([movement]);
      }
    }

    for (const allocation of allocations) {
      const lotId = String(allocation.lot_id || "");
      if (!lotId) continue;
      await lotLifecycleService.recordMassBalanceSafe({
        lotId,
        collection: "production_orders",
        actorId: actor,
        balance,
        context: `OF production ${orderNumber}`,
      });
    }

    return readOrder(orderId);
  }

  // ── Cancel order ──────────────────────────────────────────────────────────

  async cancelOrder(orderId: string, reason: string, actor: string | null) {
    const order = await readOrder(orderId);
    const status = assertTransition(order, "cancelled", "annuler");
    if (!reason.trim()) throw badRequest("CANCEL_REASON_REQUIRED", "Le motif d'annulation est obligatoire.");

    const now = new Date().toISOString();
    // An in-progress OF gives back what it consumed, with a traced return movement.
    if (status === "in_progress") {
      for (const allocation of await activeAllocations(orderId)) {
        const lotId = String(allocation.lot_id || "");
        const consumedKg = Number(allocation.consumed_kg ?? 0);
        if (!lotId || !allocation.consumed_at || consumedKg <= 0) continue;
        const stockLot = await findStockLot(lotId);
        if (!stockLot) {
          throw notFound("STOCK_LOT_NOT_FOUND", `Lot de stock introuvable pour le lot ${lotId} : restitution impossible.`);
        }
        const released = await Allocations()
          .updateOne(
            { id: allocation.id, consumed_kg: allocation.consumed_kg },
            { $set: { consumed_at: null, consumed_kg: null, updated_at: now } },
          )
          .exec();
        if (Number(released.modifiedCount || 0) !== 1) continue;
        await changeStockLotQuantity(String(stockLot.id), consumedKg, now);
        const movement = await prepareInsertDocument("stock_movements", {
          movement_type: "RETOUR",
          lot_id: stockLot.id,
          product_id: stockLot.product_id ?? null,
          quantity: consumedKg,
          unit: stockLot.unit ?? "kg",
          document_type: "PRODUCTION_ORDER_CANCEL",
          document_reference: String(order.order_number || orderId),
          request_id: `production:${String(allocation.id)}:return:${now}`,
          performed_by: actor,
          notes: `Retour ${consumedKg} kg après annulation de l'OF ${String(order.order_number || orderId)} : ${reason}`,
          created_at: now,
        });
        await StockMovements().create([movement]);
      }
    }

    await Orders().updateOne(
      { id: orderId },
      { $set: { status: "cancelled", cancel_reason: reason, actual_end_at: now, updated_at: now } },
    );

    return readOrder(orderId);
  }

  // ── Allocate a lot to an order ────────────────────────────────────────────

  async allocateLot(orderId: string, body: Record<string, unknown>, actor: string | null) {
    const order = await readOrder(orderId);
    if (!["draft", "planned"].includes(statusOf(order))) {
      throw badRequest("ALLOCATION_NOT_ALLOWED", `Impossible d'allouer un lot à un ordre ${statusOf(order)}.`);
    }

    const lotId = String(body.lot_id ?? "");
    const lot = sanitizeDocument(
      await ReceptionLots().findOne({ id: lotId }).lean().exec(),
    ) as Row | null;
    if (!lot) throw notFound("LOT_NOT_FOUND", `Lot ${lotId} introuvable`);

    // RG-P08: lot must be STOCK_LIBERE
    if (lot.stock_status !== "STOCK_LIBERE") {
      throw badRequest("LOT_NOT_LIBERE", `Le lot ${lot.lot_internal ?? lotId} n'est pas en statut STOCK_LIBERE (actuel: ${lot.stock_status})`);
    }
    const stockLot = await findStockLot(lotId);
    if (!stockLot || stockLot.status !== "VALIDATED") {
      throw badRequest(
        "LOT_NOT_LIBERE",
        `Le lot ${lot.lot_internal ?? lotId} n'est pas disponible en stock (statut stock : ${stockLot?.status ?? "absent"}).`,
      );
    }

    // One active order per lot: an unfinished reservation elsewhere blocks this one.
    const reservations = (sanitizeDocument(
      await Allocations().find({ lot_id: lotId }).lean().exec(),
    ) as Row[]).filter((allocation) => !allocation.removed_at);
    if (reservations.some((allocation) => allocation.production_order_id === orderId)) {
      throw badRequest("LOT_ALREADY_ALLOCATED", `Le lot ${lot.lot_internal ?? lotId} est déjà alloué à cet ordre.`);
    }
    for (const reservation of reservations) {
      const otherOrder = sanitizeDocument(
        await Orders().findOne({ id: reservation.production_order_id as string }).lean().exec(),
      ) as Row | null;
      if (otherOrder && ACTIVE_STATUSES.includes(statusOf(otherOrder)) && !reservation.consumed_at) {
        throw badRequest("LOT_ALREADY_ALLOCATED", `Lot déjà alloué à l'ordre ${String(otherOrder.order_number ?? otherOrder.id)}`);
      }
    }

    const availableKg = Number(stockLot.current_quantity ?? 0);
    const allocatedKg = Number(body.allocated_kg ?? availableKg);
    if (!Number.isFinite(allocatedKg) || allocatedKg <= 0) {
      throw badRequest("ALLOCATED_KG_REQUIRED", "allocated_kg doit être > 0.");
    }
    if (allocatedKg > availableKg + 0.001) {
      throw badRequest(
        "INSUFFICIENT_STOCK",
        `Poids alloué (${allocatedKg} kg) supérieur au stock disponible (${availableKg} kg).`,
      );
    }

    const doc = await prepareInsertDocument("production_lot_allocations", {
      production_order_id: orderId,
      lot_id: lotId,
      allocated_kg: allocatedKg,
      unit: stockLot.unit ?? lot.unit ?? "kg",
      allocated_by: actor,
      allocated_at: new Date().toISOString(),
      consumed_kg: null,
      consumed_at: null,
      removed_at: null,
    });

    await Allocations().insertOne(doc as any);
    const [allocation] = await this.listAllocations(orderId).then((rows) => rows.filter((row) => row.id === doc.id));
    return allocation;
  }

  /** Withdraws a planned allocation. The row stays (removed_at) because allocations are regulated history. */
  async removeAllocation(allocationId: string, actor: string | null) {
    const allocation = sanitizeDocument(await Allocations().findOne({ id: allocationId }).lean().exec()) as Row | null;
    if (!allocation || allocation.removed_at) throw notFound("ALLOCATION_NOT_FOUND", "Allocation introuvable.");
    if (allocation.consumed_at) {
      throw conflict("ALLOCATION_CONSUMED", "Ce lot a déjà été consommé : annulez l'ordre pour restituer le stock.");
    }
    const order = await readOrder(String(allocation.production_order_id));
    if (!["draft", "planned"].includes(statusOf(order))) {
      throw badRequest("ALLOCATION_NOT_ALLOWED", `Impossible de retirer un lot d'un ordre ${statusOf(order)}.`);
    }
    const now = new Date().toISOString();
    await Allocations()
      .updateOne({ id: allocationId, consumed_at: null }, { $set: { removed_at: now, removed_by: actor, updated_at: now } })
      .exec();
    return { id: allocationId, production_order_id: allocation.production_order_id };
  }

  async listAllocations(orderId: string) {
    const allocations = await activeAllocations(orderId);
    const lots = await describeReceptionLots(allocations.map((allocation) => String(allocation.lot_id || "")));
    return allocations
      .sort((a, b) => String(a.allocated_at ?? a.created_at ?? "").localeCompare(String(b.allocated_at ?? b.created_at ?? "")))
      .map((allocation): Row => ({ ...allocation, lot: lots.get(String(allocation.lot_id || "")) ?? null }));
  }

  /**
   * Released lots with stock left to allocate. Lots reserved by another active
   * order are left out, so the list only offers what allocateLot accepts.
   */
  async listAvailableLots(forOrderId?: string | null) {
    const stockLots = (sanitizeDocument(
      await StockLots().find({ status: "VALIDATED" }).lean().exec(),
    ) as Row[]).filter((stockLot) => stockLot.reception_lot_id && Number(stockLot.current_quantity ?? 0) > 0);
    const lotIds = stockLots.map((stockLot) => String(stockLot.reception_lot_id));
    const lots = await describeReceptionLots(lotIds);

    const reservations = lotIds.length > 0
      ? (sanitizeDocument(await Allocations().find({ lot_id: { $in: lotIds } }).lean().exec()) as Row[])
        .filter((allocation) => !allocation.removed_at && !allocation.consumed_at && allocation.production_order_id !== forOrderId)
      : [];
    const reservedOrderIds = Array.from(new Set(reservations.map((allocation) => String(allocation.production_order_id))));
    const activeOrderIds = new Set(
      reservedOrderIds.length > 0
        ? (sanitizeDocument(await Orders().find({ id: { $in: reservedOrderIds } }).lean().exec()) as Row[])
          .filter((order) => ACTIVE_STATUSES.includes(statusOf(order)))
          .map((order) => String(order.id))
        : [],
    );
    const reservedLotIds = new Set(
      reservations
        .filter((allocation) => activeOrderIds.has(String(allocation.production_order_id)))
        .map((allocation) => String(allocation.lot_id)),
    );

    return stockLots
      .map((stockLot): Row | null => {
        const lot = lots.get(String(stockLot.reception_lot_id));
        if (!lot || lot.stock_status !== "STOCK_LIBERE" || reservedLotIds.has(String(lot.id))) return null;
        return { ...lot, available_kg: Number(stockLot.current_quantity ?? 0), stock_lot_id: stockLot.id };
      })
      .filter((lot): lot is Row => lot !== null)
      .sort((a, b) => String(a.lot_internal ?? "").localeCompare(String(b.lot_internal ?? "")));
  }

  // ── Summary KPIs ──────────────────────────────────────────────────────────

  async getSummary() {
    const today = new Date().toISOString().slice(0, 10);
    const orders = sanitizeDocument(
      await Orders().find({}).lean().exec(),
    ) as Row[];

    const draft = orders.filter((o) => statusOf(o) === "draft").length;
    const planned = orders.filter((o) => statusOf(o) === "planned").length;
    const inProgress = orders.filter((o) => statusOf(o) === "in_progress").length;
    const completedToday = orders.filter(
      (o) => statusOf(o) === "completed" && String(o.actual_end_at ?? "").startsWith(today),
    ).length;

    const completedAll = orders.filter((o) => statusOf(o) === "completed" && o.actual_yield_pct != null);
    const avgYield =
      completedAll.length > 0
        ? Math.round(
            completedAll.reduce((s, o) => s + Number(o.actual_yield_pct ?? 0), 0) /
              completedAll.length *
              10,
          ) / 10
        : null;

    return { draft, planned, inProgress, completedToday, avgYieldPct: avgYield };
  }
}
