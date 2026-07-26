import { badRequest } from "../../core/app-error.js";
export const DEFAULT_MASS_BALANCE_TOLERANCE_PCT = 2;
export const massBalanceGateMode = () => {
    const value = String(process.env.TRUST_MASS_BALANCE_GATE || "warn").toLowerCase();
    return value === "off" || value === "enforce" ? value : "warn";
};
export const resolveMassBalanceTolerancePct = (configured) => {
    const fromEnv = Number(process.env.TRUST_MASS_BALANCE_TOLERANCE_PCT);
    if (Number.isFinite(fromEnv) && fromEnv >= 0)
        return fromEnv;
    const fromConfig = Number(configured);
    if (Number.isFinite(fromConfig) && fromConfig >= 0)
        return fromConfig;
    return DEFAULT_MASS_BALANCE_TOLERANCE_PCT;
};
let siteToleranceReader = null;
/**
 * Optional injectable reader so unit tests never hang on an unconnected
 * mongoose SiteSettingsModel. Production wires this once at boot.
 */
export const setMassBalanceToleranceReader = (reader) => {
    siteToleranceReader = reader;
};
/** Site setting `quality.mass_balance_tolerance_pct`, overridable by env. */
export const loadConfiguredMassBalanceTolerancePct = async () => {
    if (!siteToleranceReader)
        return resolveMassBalanceTolerancePct();
    try {
        return resolveMassBalanceTolerancePct(await siteToleranceReader());
    }
    catch {
        return resolveMassBalanceTolerancePct();
    }
};
const toKg = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};
/**
 * Closed mass balance: input ≈ Σ outputs + waste, within a percentage tolerance.
 * Positive variancePct means more was accounted for than came in (overstatement).
 * Negative variancePct means unaccounted loss / shrinkage.
 */
export const computeMassBalance = (input, tolerancePct = DEFAULT_MASS_BALANCE_TOLERANCE_PCT) => {
    const inputKg = toKg(input.inputKg);
    const outputKg = (input.outputsKg || []).reduce((sum, value) => sum + toKg(value), 0);
    const wasteKg = toKg(input.wasteKg);
    const accountedKg = outputKg + wasteKg;
    const varianceKg = Number((accountedKg - inputKg).toFixed(3));
    const variancePct = inputKg > 0
        ? Number(((varianceKg / inputKg) * 100).toFixed(2))
        : accountedKg === 0
            ? 0
            : 100;
    return {
        inputKg,
        outputKg,
        wasteKg,
        accountedKg,
        varianceKg,
        variancePct,
        balanced: Math.abs(variancePct) <= tolerancePct,
        tolerancePct,
    };
};
export const assertMassBalanceClosed = (input, options = {}) => {
    const tolerancePct = Number(options.tolerancePct ?? DEFAULT_MASS_BALANCE_TOLERANCE_PCT);
    const mode = options.mode ?? massBalanceGateMode();
    const result = computeMassBalance(input, Number.isFinite(tolerancePct) ? tolerancePct : DEFAULT_MASS_BALANCE_TOLERANCE_PCT);
    if (result.balanced || mode === "off") {
        return { ...result, action: "ok" };
    }
    if (mode === "warn") {
        return { ...result, action: "warn" };
    }
    const context = options.context ? ` (${options.context})` : "";
    throw badRequest("MASS_BALANCE_UNBALANCED", `Bilan matière hors tolérance${context}: écart ${result.variancePct}% (tolérance ±${result.tolerancePct}%).`, result);
};
