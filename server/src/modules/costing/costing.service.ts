/**
 * Lot cost view + period summary: purchase snapshot + grade split + standard absorption.
 */
import { Injectable } from "@nestjs/common";

import { notFound } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { lotLifecycleService } from "../trust/lot-lifecycle.service.js";
import { loadCostingRates } from "./costing-rates.js";

const ReceptionLots = () => getCollectionModel("reception_lots");
const TriageSessions = () => getCollectionModel("triage_sessions");
const TriageSublots = () => getCollectionModel("triage_sublots");
const PackagingOrders = () => getCollectionModel("packaging_orders");
const ProductionOrders = () => getCollectionModel("production_orders");

type Period = "week" | "month" | "quarter";

const periodStart = (period: Period): Date => {
  const now = new Date();
  if (period === "week") {
    const day = now.getUTCDay() || 7;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - (day - 1));
    return start;
  }
  if (period === "quarter") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

@Injectable()
export class CostingService {
  async getLotCost(lotIdOrNumber: string) {
    const key = String(lotIdOrNumber || "").trim();
    if (!key) throw notFound("LOT_NOT_FOUND", "Lot introuvable.");

    let lot = sanitizeDocument(
      await ReceptionLots().findOne({ id: key }).lean().exec(),
    ) as Record<string, unknown> | null;

    if (!lot) {
      lot = sanitizeDocument(
        await ReceptionLots().findOne({ lot_internal: key }).lean().exec(),
      ) as Record<string, unknown> | null;
    }

    if (!lot && !key.includes("/")) {
      const resolved = await lotLifecycleService.resolveReceptionLotId({ lotNumber: key });
      if (resolved) {
        lot = sanitizeDocument(
          await ReceptionLots().findOne({ id: resolved }).lean().exec(),
        ) as Record<string, unknown> | null;
      }
    }

    if (!lot) throw notFound("LOT_NOT_FOUND", "Lot introuvable.");

    const lotId = String(lot.id);
    const lotNumber = String(lot.lot_internal || "");
    const receptionId = String(lot.reception_id || "");

    const sessionQuery: Record<string, unknown>[] = [];
    if (lotNumber) sessionQuery.push({ parent_lot_number: lotNumber });
    if (receptionId) sessionQuery.push({ parent_reception_id: receptionId });

    const session = sessionQuery.length
      ? (sanitizeDocument(
          await TriageSessions()
            .findOne({ status: "TERMINE", $or: sessionQuery })
            .sort({ ended_at: -1, updated_at: -1 })
            .lean()
            .exec(),
        ) as Record<string, unknown> | null)
      : null;

    const sublots = session?.id
      ? ((sanitizeDocument(
          await TriageSublots().find({ session_id: session.id }).lean().exec(),
        ) as Array<Record<string, unknown>>) || [])
      : [];

    const grades = sublots.map((row) => ({
      grade: row.grade,
      lot_number: row.lot_number,
      weight_kg: Number(row.weight_kg || 0),
      destination: row.destination ?? null,
      cost_tnd: row.cost_tnd ?? null,
      cost_tnd_per_kg: row.cost_tnd_per_kg ?? null,
    }));

    const rates = await loadCostingRates();

    return {
      lot: {
        id: lotId,
        lot_internal: lot.lot_internal ?? null,
        reception_id: lot.reception_id ?? null,
        quantity: Number(lot.quantity || 0),
        purchase_cost_tnd_per_kg: lot.purchase_cost_tnd_per_kg ?? null,
        purchase_cost_tnd: lot.purchase_cost_tnd ?? null,
        cost_source: lot.cost_source ?? null,
      },
      rates: {
        labour_rate_tnd_per_hour: rates.labourRateTndPerHour,
        energy_tariff_tnd_per_kwh: rates.energyTariffTndPerKwh,
        overhead_tnd_per_kg: rates.overheadTndPerKg,
        target_cost_tnd_per_kg: rates.targetCostTndPerKg,
        basis: "standard" as const,
      },
      triage: session
        ? {
            session_id: session.id,
            session_number: session.session_number ?? null,
            input_cost_tnd: session.input_cost_tnd ?? null,
            material_cost_tnd: session.material_cost_tnd ?? null,
            labour_cost_tnd: session.labour_cost_tnd ?? null,
            overhead_cost_tnd: session.overhead_cost_tnd ?? null,
            cost_basis: session.cost_basis ?? null,
            mass_balance_variance_pct: session.mass_balance_variance_pct ?? null,
            parent_weight_kg: Number(session.parent_weight_kg || 0),
            grades,
          }
        : null,
    };
  }

  /**
   * Period roll-up from persisted triage + packaging + production costs.
   * Labour / energy / overhead use standard absorption rates (settings), not meters.
   */
  async getSummary(periodRaw?: string) {
    const period = (["week", "month", "quarter"].includes(String(periodRaw || ""))
      ? periodRaw
      : "month") as Period;
    const start = periodStart(period);
    const startIso = start.toISOString();
    const rates = await loadCostingRates();

    const triageSessions = (sanitizeDocument(
      await TriageSessions()
        .find({
          status: "TERMINE",
          $or: [
            { ended_at: { $gte: startIso } },
            { updated_at: { $gte: startIso } },
          ],
        })
        .lean()
        .exec(),
    ) as Array<Record<string, unknown>>) || [];

    const packagingOrders = (sanitizeDocument(
      await PackagingOrders()
        .find({
          status: "TERMINE",
          $or: [
            { ended_at: { $gte: startIso } },
            { updated_at: { $gte: startIso } },
          ],
        })
        .lean()
        .exec(),
    ) as Array<Record<string, unknown>>) || [];

    const productionOrders = (sanitizeDocument(
      await ProductionOrders()
        .find({
          status: "COMPLETED",
          $or: [
            { actual_end_at: { $gte: startIso } },
            { updated_at: { $gte: startIso } },
          ],
        })
        .lean()
        .exec(),
    ) as Array<Record<string, unknown>>) || [];

    const receptionLots = (sanitizeDocument(
      await ReceptionLots()
        .find({
          purchase_cost_tnd: { $ne: null },
          $or: [
            { created_at: { $gte: startIso } },
            { updated_at: { $gte: startIso } },
          ],
        })
        .lean()
        .exec(),
    ) as Array<Record<string, unknown>>) || [];

    const sum = (rows: Array<Record<string, unknown>>, key: string) =>
      rows.reduce((acc, row) => acc + Number(row[key] ?? 0), 0);

    const triageMaterial = sum(triageSessions, "material_cost_tnd") || sum(triageSessions, "input_cost_tnd");
    const triageLabour = sum(triageSessions, "labour_cost_tnd");
    const triageOverhead = sum(triageSessions, "overhead_cost_tnd");
    const triageKg = sum(triageSessions, "parent_weight_kg");

    const pkgMaterial =
      sum(packagingOrders, "material_cost_tnd") + sum(packagingOrders, "packaging_cost_tnd");
    const pkgLabour = sum(packagingOrders, "labour_cost_tnd");
    const pkgOverhead = sum(packagingOrders, "overhead_cost_tnd");
    const pkgKg = sum(packagingOrders, "produced_kg");
    const pkgWasteKg = sum(packagingOrders, "waste_kg");

    const purchaseMaterial = sum(receptionLots, "purchase_cost_tnd");
    const materialCost = purchaseMaterial > 0 ? purchaseMaterial : triageMaterial + pkgMaterial;
    const labourCost = triageLabour + pkgLabour;
    const overheadCost = triageOverhead + pkgOverhead;

    // Energy is absorbed into standard rates at process close when kWh is known;
    // period panel exposes residual via rate × estimated kWh when energy_cost persisted is 0.
    const energyCost =
      sum(triageSessions, "energy_cost_tnd") + sum(packagingOrders, "energy_cost_tnd");

    const producedKg =
      pkgKg > 0
        ? pkgKg
        : productionOrders.reduce((acc, row) => acc + Number(row.actual_output_kg ?? 0), 0) ||
          triageKg;

    const lossCost = packagingOrders.reduce((acc, row) => {
      const waste = Number(row.waste_kg ?? 0);
      const perKg = Number(row.cost_tnd_per_kg ?? 0);
      return acc + waste * perKg;
    }, 0);

    const totalCost = materialCost + labourCost + energyCost + overheadCost + lossCost;
    const costPerKg = producedKg > 0 ? totalCost / producedKg : 0;
    const targetCostPerKg = rates.targetCostTndPerKg;

    const breakdown = [
      { category: "materials" as const, label: "Matières premières", amount: materialCost },
      { category: "labor" as const, label: "Main-d'œuvre (standard)", amount: labourCost },
      { category: "energy" as const, label: "Énergie (standard)", amount: energyCost },
      { category: "overhead" as const, label: "Frais généraux (standard)", amount: overheadCost },
      { category: "losses" as const, label: "Pertes", amount: lossCost },
      { category: "maintenance" as const, label: "Maintenance", amount: 0 },
    ].map((row) => ({
      ...row,
      percentage: totalCost > 0 ? Number(((row.amount / totalCost) * 100).toFixed(2)) : 0,
      trend: 0,
    }));

    return {
      period,
      basis: "standard" as const,
      rates: {
        labour_rate_tnd_per_hour: rates.labourRateTndPerHour,
        energy_tariff_tnd_per_kwh: rates.energyTariffTndPerKwh,
        overhead_tnd_per_kg: rates.overheadTndPerKg,
        target_cost_tnd_per_kg: rates.targetCostTndPerKg,
      },
      totals: {
        material_cost_tnd: Number(materialCost.toFixed(2)),
        labour_cost_tnd: Number(labourCost.toFixed(2)),
        energy_cost_tnd: Number(energyCost.toFixed(2)),
        overhead_cost_tnd: Number(overheadCost.toFixed(2)),
        loss_cost_tnd: Number(lossCost.toFixed(2)),
        maintenance_cost_tnd: 0,
        total_cost_tnd: Number(totalCost.toFixed(2)),
        produced_kg: Number(producedKg.toFixed(3)),
        waste_kg: Number(pkgWasteKg.toFixed(3)),
        cost_tnd_per_kg: Number(costPerKg.toFixed(4)),
        target_cost_tnd_per_kg: targetCostPerKg,
        cost_variance_pct:
          targetCostPerKg > 0
            ? Number((((costPerKg - targetCostPerKg) / targetCostPerKg) * 100).toFixed(2))
            : 0,
      },
      sources: {
        triage_sessions: triageSessions.length,
        packaging_orders: packagingOrders.length,
        production_orders: productionOrders.length,
        reception_lots_with_purchase_cost: receptionLots.length,
      },
      breakdown,
      kpis: {
        costPerKg: Number(costPerKg.toFixed(4)),
        targetCostPerKg,
        costVariancePercent:
          targetCostPerKg > 0
            ? Number((((costPerKg - targetCostPerKg) / targetCostPerKg) * 100).toFixed(2))
            : 0,
        laborCostPerTon: producedKg > 0 ? Number(((labourCost / producedKg) * 1000).toFixed(2)) : 0,
        energyCostPerTon: producedKg > 0 ? Number(((energyCost / producedKg) * 1000).toFixed(2)) : 0,
        materialCostPerTon:
          producedKg > 0 ? Number(((materialCost / producedKg) * 1000).toFixed(2)) : 0,
        overheadCostPerTon:
          producedKg > 0 ? Number(((overheadCost / producedKg) * 1000).toFixed(2)) : 0,
        lossValue: Number(lossCost.toFixed(2)),
        lossPercentOfRevenue: 0,
        maintenanceCost: 0,
        downtimeImpact: 0,
      },
    };
  }
}
