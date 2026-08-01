var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
/**
 * Wave C — export order margin vs lot cost basis, with FX → TND.
 */
import { Injectable } from "@nestjs/common";
import mongoose from "mongoose";
import { notFound } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { SiteSettingsModel } from "../../models/site-settings.model.js";
import { computeExportMargin, DEFAULT_FX_TO_TND, } from "./settlement-domain.js";
const ExportOrders = () => getCollectionModel("export_orders");
const StockLots = () => getCollectionModel("stock_lots");
const ReceptionLots = () => getCollectionModel("reception_lots");
const TriageSublots = () => getCollectionModel("triage_sublots");
const readString = (...values) => {
    for (const value of values) {
        const text = String(value ?? "").trim();
        if (text)
            return text;
    }
    return "";
};
const loadFxRates = async () => {
    if (mongoose.connection.readyState !== 1) {
        return { ...DEFAULT_FX_TO_TND };
    }
    try {
        const doc = (await SiteSettingsModel.findOne({ id: "global" })
            .select("costing")
            .lean()
            .exec());
        const costing = doc?.costing || {};
        return {
            EUR: Number(costing.fx_eur_to_tnd) > 0 ? Number(costing.fx_eur_to_tnd) : DEFAULT_FX_TO_TND.EUR,
            USD: Number(costing.fx_usd_to_tnd) > 0 ? Number(costing.fx_usd_to_tnd) : DEFAULT_FX_TO_TND.USD,
            SAR: Number(costing.fx_sar_to_tnd) > 0 ? Number(costing.fx_sar_to_tnd) : DEFAULT_FX_TO_TND.SAR,
            TND: 1,
        };
    }
    catch {
        return { ...DEFAULT_FX_TO_TND };
    }
};
let ExportMarginService = class ExportMarginService {
    async resolveLineCostTndPerKg(line) {
        const lotId = readString(line.lot_id);
        const lotRef = readString(line.lot_ref);
        if (lotId || lotRef) {
            const stock = sanitizeDocument(await StockLots()
                .findOne({
                $or: [
                    ...(lotId ? [{ id: lotId }, { lot_number: lotId }] : []),
                    ...(lotRef ? [{ lot_number: lotRef }, { id: lotRef }] : []),
                ],
            })
                .lean()
                .exec());
            if (stock && Number(stock.cost_tnd_per_kg) > 0) {
                return {
                    costTndPerKg: Number(stock.cost_tnd_per_kg),
                    costSource: "stock_lots.cost_tnd_per_kg",
                    resolvedLotId: String(stock.id),
                };
            }
            const sublot = sanitizeDocument(await TriageSublots()
                .findOne({
                $or: [
                    ...(lotId ? [{ id: lotId }, { lot_number: lotId }] : []),
                    ...(lotRef ? [{ lot_number: lotRef }] : []),
                ],
            })
                .lean()
                .exec());
            if (sublot && Number(sublot.cost_tnd_per_kg) > 0) {
                return {
                    costTndPerKg: Number(sublot.cost_tnd_per_kg),
                    costSource: "triage_sublots.cost_tnd_per_kg",
                    resolvedLotId: String(sublot.id),
                };
            }
            const receptionLot = sanitizeDocument(await ReceptionLots()
                .findOne({
                $or: [
                    ...(lotId ? [{ id: lotId }, { lot_internal: lotId }] : []),
                    ...(lotRef ? [{ lot_internal: lotRef }, { id: lotRef }] : []),
                ],
            })
                .lean()
                .exec());
            if (receptionLot && Number(receptionLot.purchase_cost_tnd_per_kg) > 0) {
                return {
                    costTndPerKg: Number(receptionLot.purchase_cost_tnd_per_kg),
                    costSource: "reception_lots.purchase_cost_tnd_per_kg",
                    resolvedLotId: String(receptionLot.id),
                };
            }
            // Parent of a graded stock lot.
            const parentInternal = readString(stock?.source_lot_internal);
            if (parentInternal) {
                const parent = sanitizeDocument(await ReceptionLots().findOne({ lot_internal: parentInternal }).lean().exec());
                if (parent && Number(parent.purchase_cost_tnd_per_kg) > 0) {
                    return {
                        costTndPerKg: Number(parent.purchase_cost_tnd_per_kg),
                        costSource: "reception_lots.purchase_cost_tnd_per_kg(parent)",
                        resolvedLotId: String(parent.id),
                    };
                }
            }
        }
        return { costTndPerKg: null, costSource: null, resolvedLotId: null };
    }
    async getOrderMargin(orderId) {
        const order = sanitizeDocument(await ExportOrders().findOne({ id: orderId }).lean().exec());
        if (!order)
            throw notFound("EXPORT_ORDER_NOT_FOUND", "Commande export introuvable.");
        const lines = Array.isArray(order.lines) ? order.lines : [];
        const currency = readString(order.currency) || "EUR";
        const revenueInvoice = Number(order.total_amount) > 0
            ? Number(order.total_amount)
            : lines.reduce((sum, line) => sum + Number(line.net_weight_kg || 0) * Number(line.unit_price || 0), 0);
        const fxRates = await loadFxRates();
        const lineDetails = [];
        let costTnd = 0;
        let coveredKg = 0;
        let missingCostKg = 0;
        for (const line of lines) {
            const weightKg = Number(line.net_weight_kg || 0);
            const resolved = await this.resolveLineCostTndPerKg(line);
            const lineCost = resolved.costTndPerKg != null && weightKg > 0
                ? Number((resolved.costTndPerKg * weightKg).toFixed(4))
                : null;
            if (lineCost != null) {
                costTnd += lineCost;
                coveredKg += weightKg;
            }
            else if (weightKg > 0) {
                missingCostKg += weightKg;
            }
            lineDetails.push({
                lot_id: line.lot_id ?? null,
                lot_ref: line.lot_ref ?? null,
                net_weight_kg: weightKg,
                unit_price_invoice: Number(line.unit_price || 0),
                currency: readString(line.currency) || currency,
                cost_tnd_per_kg: resolved.costTndPerKg,
                cost_tnd: lineCost,
                cost_source: resolved.costSource,
                resolved_lot_id: resolved.resolvedLotId,
            });
        }
        const margin = computeExportMargin({
            revenueInvoice,
            currency,
            costTnd,
            fxRatesToTnd: fxRates,
            overrideRate: Number(order.fx_rate_to_tnd) > 0 ? Number(order.fx_rate_to_tnd) : null,
        });
        return {
            order_id: orderId,
            order_ref: order.order_ref ?? null,
            status: order.status ?? null,
            currency: margin.currency,
            fx_rate_to_tnd: margin.fxRateToTnd,
            revenue_invoice: margin.revenueInvoice,
            revenue_tnd: margin.amountTnd,
            cost_tnd: margin.costTnd,
            margin_tnd: margin.marginTnd,
            margin_pct: margin.marginPct,
            covered_kg: Number(coveredKg.toFixed(3)),
            missing_cost_kg: Number(missingCostKg.toFixed(3)),
            lines: lineDetails,
            basis: "lot_cost_vs_invoice_fx",
        };
    }
};
ExportMarginService = __decorate([
    Injectable()
], ExportMarginService);
export { ExportMarginService };
