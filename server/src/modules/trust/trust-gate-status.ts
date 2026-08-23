/**
 * Trust gate / claim readiness — B0 dashboard for ops.
 */

import { massBalanceGateMode } from "./mass-balance.js";
import { stageGateMode, getSwallowedStageFailureCount } from "./lot-lifecycle.service.js";
import { PLACEHOLDER_GS1_COMPANY_PREFIX, normalizeGs1Prefix } from "../packaging/gs1-sscc.js";

export type GateMode = "off" | "warn" | "enforce";

const readMode = (envKey: string, fallback: GateMode = "warn"): GateMode => {
  const value = String(process.env[envKey] || fallback).toLowerCase();
  return value === "off" || value === "enforce" ? value : "warn";
};

export const getTrustGateStatus = (gs1PrefixRaw?: string | null) => {
  const scan = readMode("TRUST_SCAN_GATE");
  const ccp = readMode("TRUST_CCP_GATE");
  const massBalance = massBalanceGateMode();
  const stage = stageGateMode();
  const gs1 = normalizeGs1Prefix(gs1PrefixRaw);
  const gs1Placeholder = gs1 === PLACEHOLDER_GS1_COMPANY_PREFIX;

  const enforceReady =
    scan === "enforce" &&
    ccp === "enforce" &&
    stage === "enforce" &&
    !gs1Placeholder;

  return {
    wave: "B0",
    gates: {
      scan,
      ccp,
      mass_balance: massBalance,
      stage,
    },
    gs1: {
      company_prefix: gs1,
      placeholder: gs1Placeholder,
    },
    swallowed_stage_failures_process: getSwallowedStageFailureCount(),
    enforce_ready: enforceReady,
    next: enforceReady
      ? "Claims are in enforce mode with a non-placeholder GS1 prefix."
      : "Run a warn-mode shift with zero LOT_LEDGER_STAGE_FAILED, then set TRUST_SCAN_GATE / TRUST_CCP_GATE / TRUST_STAGE_GATE=enforce and replace GS1 prefix.",
  };
};
