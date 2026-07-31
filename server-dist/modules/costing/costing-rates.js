/**
 * Load Wave B costing rates from site settings.
 * These are standard costs (not meter/timesheet actuals).
 */
import mongoose from "mongoose";
import { SiteSettingsModel } from "../../models/site-settings.model.js";
export const DEFAULT_COSTING_RATES = {
    labourRateTndPerHour: 8,
    energyTariffTndPerKwh: 0.4,
    overheadTndPerKg: 0.15,
    targetCostTndPerKg: 3,
};
export const loadCostingRates = async () => {
    // Unit tests run without a live mongoose connection — never hang waiting.
    if (mongoose.connection.readyState !== 1) {
        return { ...DEFAULT_COSTING_RATES };
    }
    try {
        const doc = (await SiteSettingsModel.findOne({ id: "global" })
            .select("costing")
            .lean()
            .exec());
        const costing = doc?.costing || {};
        const num = (value, fallback) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
        };
        return {
            labourRateTndPerHour: num(costing.labour_rate_tnd_per_hour, DEFAULT_COSTING_RATES.labourRateTndPerHour),
            energyTariffTndPerKwh: num(costing.energy_tariff_tnd_per_kwh, DEFAULT_COSTING_RATES.energyTariffTndPerKwh),
            overheadTndPerKg: num(costing.overhead_tnd_per_kg, DEFAULT_COSTING_RATES.overheadTndPerKg),
            targetCostTndPerKg: num(costing.target_cost_tnd_per_kg, DEFAULT_COSTING_RATES.targetCostTndPerKg),
        };
    }
    catch {
        return { ...DEFAULT_COSTING_RATES };
    }
};
