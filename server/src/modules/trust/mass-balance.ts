import { badRequest } from "../../core/app-error.js";

export type MassBalanceGateMode = "off" | "warn" | "enforce";

export type MassBalanceInput = {
  inputKg: number;
  outputsKg?: number[];
  wasteKg?: number;
};

export type MassBalanceResult = {
  inputKg: number;
  outputKg: number;
  wasteKg: number;
  accountedKg: number;
  varianceKg: number;
  variancePct: number;
  balanced: boolean;
  tolerancePct: number;
};

export type MassBalanceDecision = MassBalanceResult & {
  action: "ok" | "warn" | "blocked";
};

export const DEFAULT_MASS_BALANCE_TOLERANCE_PCT = 2;

export const massBalanceGateMode = (): MassBalanceGateMode => {
  const value = String(process.env.TRUST_MASS_BALANCE_GATE || "warn").toLowerCase();
  return value === "off" || value === "enforce" ? value : "warn";
};

export const resolveMassBalanceTolerancePct = (configured?: number | null) => {
  const fromEnv = Number(process.env.TRUST_MASS_BALANCE_TOLERANCE_PCT);
  if (Number.isFinite(fromEnv) && fromEnv >= 0) return fromEnv;
  const fromConfig = Number(configured);
  if (Number.isFinite(fromConfig) && fromConfig >= 0) return fromConfig;
  return DEFAULT_MASS_BALANCE_TOLERANCE_PCT;
};

const toKg = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Closed mass balance: input ≈ Σ outputs + waste, within a percentage tolerance.
 * Positive variancePct means more was accounted for than came in (overstatement).
 * Negative variancePct means unaccounted loss / shrinkage.
 */
export const computeMassBalance = (
  input: MassBalanceInput,
  tolerancePct = DEFAULT_MASS_BALANCE_TOLERANCE_PCT,
): MassBalanceResult => {
  const inputKg = toKg(input.inputKg);
  const outputKg = (input.outputsKg || []).reduce((sum, value) => sum + toKg(value), 0);
  const wasteKg = toKg(input.wasteKg);
  const accountedKg = outputKg + wasteKg;
  const varianceKg = Number((accountedKg - inputKg).toFixed(3));
  const variancePct =
    inputKg > 0
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

export const assertMassBalanceClosed = (
  input: MassBalanceInput,
  options: {
    tolerancePct?: number;
    mode?: MassBalanceGateMode;
    context?: string;
  } = {},
): MassBalanceDecision => {
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
  throw badRequest(
    "MASS_BALANCE_UNBALANCED",
    `Bilan matière hors tolérance${context}: écart ${result.variancePct}% (tolérance ±${result.tolerancePct}%).`,
    result,
  );
};
