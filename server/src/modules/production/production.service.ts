import { Injectable } from "@nestjs/common";
import { badRequest, notFound } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { prepareInsertDocument } from "../../db/defaults.js";

const Orders = () => getCollectionModel("production_orders");
const Steps = () => getCollectionModel("production_steps");
const Allocations = () => getCollectionModel("production_lot_allocations");
const OutputLots = () => getCollectionModel("production_output_lots");
const StepDefs = () => getCollectionModel("production_step_definitions");
const ReceptionLots = () => getCollectionModel("reception_lots");
const Alerts = () => getCollectionModel("alerts");

type OrderStatus = "DRAFT" | "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["PLANNED", "CANCELLED"],
  PLANNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class ProductionService {
  // ── Create order with step auto-generation ───────────────────────────────

  async createOrder(body: Record<string, unknown>, actor: string | null) {
    const productionType = String(body.production_type || "STANDARD");
    const doc = await prepareInsertDocument("production_orders", {
      ...body,
      status: "DRAFT",
      created_by: actor,
    });

    const order = sanitizeDocument(
      (await Orders().insertOne(doc as any), await Orders().findOne({ id: doc.id }).lean().exec()),
    ) as Record<string, unknown>;

    // Auto-generate steps from step definitions matching production type
    const defs = sanitizeDocument(
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
    ) as Array<Record<string, unknown>>;

    if (defs.length > 0) {
      const stepDocs = await Promise.all(
        defs.map((def) =>
          prepareInsertDocument("production_steps", {
            production_order_id: doc.id,
            step_definition_id: def.id,
            name: def.name,
            sequence_order: def.sequence_order,
            is_mandatory: def.is_mandatory ?? true,
            status: "PENDING",
          }),
        ),
      );
      if (stepDocs.length > 0) {
        await Steps().insertMany(stepDocs as any[]);
      }
    }

    return order;
  }

  // ── Start order: validate lots STOCK_LIBERE, set IN_PROGRESS ─────────────

  async startOrder(orderId: string, actor: string | null) {
    const order = sanitizeDocument(
      await Orders().findOne({ id: orderId }).lean().exec(),
    ) as Record<string, unknown> | null;
    if (!order) throw notFound("ORDER_NOT_FOUND", `Ordre ${orderId} introuvable`);

    const status = order.status as OrderStatus;
    if (!ALLOWED_TRANSITIONS[status]?.includes("IN_PROGRESS")) {
      throw badRequest("INVALID_TRANSITION", `Impossible de démarrer un ordre en statut ${status}`);
    }

    // RG-P01: all allocated lots must be STOCK_LIBERE
    const allocations = sanitizeDocument(
      await Allocations().find({ production_order_id: orderId }).lean().exec(),
    ) as Array<Record<string, unknown>>;

    if (allocations.length === 0) {
      throw badRequest("NO_LOTS_ALLOCATED", "Aucun lot n'est alloué à cet ordre avant démarrage");
    }

    const lotIds = allocations.map((a) => a.lot_id as string).filter(Boolean);
    const lots = sanitizeDocument(
      await ReceptionLots().find({ id: { $in: lotIds } }).lean().exec(),
    ) as Array<Record<string, unknown>>;

    const notLibered = lots.filter((l) => l.stock_status !== "STOCK_LIBERE");
    if (notLibered.length > 0) {
      const ids = notLibered.map((l) => l.lot_internal ?? l.id).join(", ");
      throw badRequest("LOT_NOT_LIBERE", `Lots non libérés : ${ids}`);
    }

    const now = new Date().toISOString();
    await Orders().updateOne({ id: orderId }, { $set: { status: "IN_PROGRESS", actual_start_at: now, updated_at: now } });

    // Mark allocated lots as EN_PRODUCTION
    if (lotIds.length > 0) {
      await ReceptionLots().updateMany(
        { id: { $in: lotIds } },
        { $set: { stock_status: "EN_PRODUCTION", updated_at: now } },
      );
    }

    return sanitizeDocument(await Orders().findOne({ id: orderId }).lean().exec()) as Record<string, unknown>;
  }

  // ── Complete order: validate mandatory steps, calculate yield ─────────────

  async completeOrder(orderId: string, body: Record<string, unknown>, actor: string | null) {
    const order = sanitizeDocument(
      await Orders().findOne({ id: orderId }).lean().exec(),
    ) as Record<string, unknown> | null;
    if (!order) throw notFound("ORDER_NOT_FOUND", `Ordre ${orderId} introuvable`);

    if (order.status !== "IN_PROGRESS") {
      throw badRequest("INVALID_TRANSITION", `Ordre doit être IN_PROGRESS pour être complété (état actuel: ${order.status})`);
    }

    // RG-P05: all mandatory steps must be COMPLETED
    const steps = sanitizeDocument(
      await Steps().find({ production_order_id: orderId }).lean().exec(),
    ) as Array<Record<string, unknown>>;

    const blockedSteps = steps.filter(
      (s) => s.is_mandatory && s.status !== "COMPLETED" && s.status !== "SKIPPED",
    );
    if (blockedSteps.length > 0) {
      const names = blockedSteps.map((s) => s.name ?? s.id).join(", ");
      throw badRequest("MANDATORY_STEPS_INCOMPLETE", `Étapes obligatoires non terminées : ${names}`);
    }

    // RG-P07: calculate yield
    const allocations = sanitizeDocument(
      await Allocations().find({ production_order_id: orderId }).lean().exec(),
    ) as Array<Record<string, unknown>>;
    const totalInputKg = allocations.reduce((sum, a) => sum + Number(a.allocated_kg ?? 0), 0);

    const actualOutputKg = Number(body.actual_output_kg ?? order.actual_output_kg ?? 0);
    const yieldPct =
      totalInputKg > 0 ? Math.round((actualOutputKg / totalInputKg) * 100 * 10) / 10 : null;

    const now = new Date().toISOString();
    await Orders().updateOne(
      { id: orderId },
      {
        $set: {
          status: "COMPLETED",
          actual_end_at: now,
          actual_output_kg: actualOutputKg,
          actual_yield_pct: yieldPct,
          notes: body.notes ?? order.notes,
          updated_at: now,
        },
      },
    );

    return sanitizeDocument(await Orders().findOne({ id: orderId }).lean().exec()) as Record<string, unknown>;
  }

  // ── Cancel order ──────────────────────────────────────────────────────────

  async cancelOrder(orderId: string, reason: string, actor: string | null) {
    const order = sanitizeDocument(
      await Orders().findOne({ id: orderId }).lean().exec(),
    ) as Record<string, unknown> | null;
    if (!order) throw notFound("ORDER_NOT_FOUND", `Ordre ${orderId} introuvable`);

    const status = order.status as OrderStatus;
    if (!ALLOWED_TRANSITIONS[status]?.includes("CANCELLED")) {
      throw badRequest("INVALID_TRANSITION", `Impossible d'annuler un ordre en statut ${status}`);
    }

    const now = new Date().toISOString();
    // Release lots back to STOCK_LIBERE if order was IN_PROGRESS
    if (status === "IN_PROGRESS") {
      const allocations = sanitizeDocument(
        await Allocations().find({ production_order_id: orderId }).lean().exec(),
      ) as Array<Record<string, unknown>>;
      const lotIds = allocations.map((a) => a.lot_id as string).filter(Boolean);
      if (lotIds.length > 0) {
        await ReceptionLots().updateMany(
          { id: { $in: lotIds } },
          { $set: { stock_status: "STOCK_LIBERE", updated_at: now } },
        );
      }
    }

    await Orders().updateOne(
      { id: orderId },
      { $set: { status: "CANCELLED", cancel_reason: reason, updated_at: now } },
    );

    return sanitizeDocument(await Orders().findOne({ id: orderId }).lean().exec()) as Record<string, unknown>;
  }

  // ── Allocate a lot to an order ────────────────────────────────────────────

  async allocateLot(orderId: string, body: Record<string, unknown>, actor: string | null) {
    const order = sanitizeDocument(
      await Orders().findOne({ id: orderId }).lean().exec(),
    ) as Record<string, unknown> | null;
    if (!order) throw notFound("ORDER_NOT_FOUND", `Ordre ${orderId} introuvable`);

    if (!["DRAFT", "PLANNED"].includes(order.status as string)) {
      throw badRequest("ALLOCATION_NOT_ALLOWED", `Impossible d'allouer un lot en statut ${order.status}`);
    }

    const lotId = String(body.lot_id ?? "");
    const lot = sanitizeDocument(
      await ReceptionLots().findOne({ id: lotId }).lean().exec(),
    ) as Record<string, unknown> | null;
    if (!lot) throw notFound("LOT_NOT_FOUND", `Lot ${lotId} introuvable`);

    // RG-P08: lot must be STOCK_LIBERE
    if (lot.stock_status !== "STOCK_LIBERE") {
      throw badRequest("LOT_NOT_LIBERE", `Le lot ${lot.lot_internal ?? lotId} n'est pas en statut STOCK_LIBERE (actuel: ${lot.stock_status})`);
    }

    // Check not already allocated to another active order
    const existingAlloc = sanitizeDocument(
      await Allocations().findOne({ lot_id: lotId }).lean().exec(),
    ) as Record<string, unknown> | null;
    if (existingAlloc && existingAlloc.production_order_id !== orderId) {
      const existingOrder = sanitizeDocument(
        await Orders()
          .findOne({ id: existingAlloc.production_order_id as string })
          .lean()
          .exec(),
      ) as Record<string, unknown> | null;
      if (existingOrder && !["COMPLETED", "CANCELLED"].includes(existingOrder.status as string)) {
        throw badRequest(
          "LOT_ALREADY_ALLOCATED",
          `Lot déjà alloué à l'ordre ${existingOrder.order_number}`,
        );
      }
    }

    const doc = await prepareInsertDocument("production_lot_allocations", {
      production_order_id: orderId,
      lot_id: lotId,
      allocated_kg: Number(body.allocated_kg ?? lot.quantity ?? 0),
      allocated_by: actor,
    });

    await Allocations().insertOne(doc as any);
    return sanitizeDocument(await Allocations().findOne({ id: doc.id }).lean().exec()) as Record<string, unknown>;
  }

  // ── Summary KPIs ──────────────────────────────────────────────────────────

  async getSummary() {
    const today = new Date().toISOString().slice(0, 10);
    const orders = sanitizeDocument(
      await Orders().find({}).lean().exec(),
    ) as Array<Record<string, unknown>>;

    const draft = orders.filter((o) => o.status === "DRAFT").length;
    const planned = orders.filter((o) => o.status === "PLANNED").length;
    const inProgress = orders.filter((o) => o.status === "IN_PROGRESS").length;
    const completedToday = orders.filter(
      (o) => o.status === "COMPLETED" && String(o.actual_end_at ?? "").startsWith(today),
    ).length;

    const completedAll = orders.filter((o) => o.status === "COMPLETED" && o.actual_yield_pct != null);
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
