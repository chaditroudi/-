/**
 * AI Guide configuration. Everything is environment-driven so the feature can be
 * turned off, pointed at any provider, and budgeted without a code change.
 * Defaults keep the feature safe: disabled, no network, bounded context.
 */

import { AI_GUIDE_LANGUAGES, type AiGuideLanguage } from "./ai-guide.types.js";

const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toBool = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
};

export interface AiGuideConfig {
  enabled: boolean;
  provider: string;
  model: string;
  baseUrl: string;
  maxOutputTokens: number;
  timeoutMs: number;
  maxContextChars: number;
  maxHistoryMessages: number;
  maxProcedureChars: number;
  maxToolResults: number;
  defaultLanguage: AiGuideLanguage;
}

const isTestRuntime = () =>
  process.env.VITEST === "true" || process.env.NODE_ENV === "test";

export const loadAiGuideConfig = (): AiGuideConfig => {
  const rawLang = String(process.env.AI_GUIDE_DEFAULT_LANGUAGE || "fr").toLowerCase();
  const defaultLanguage = (AI_GUIDE_LANGUAGES as string[]).includes(rawLang)
    ? (rawLang as AiGuideLanguage)
    : "fr";
  const testing = isTestRuntime();

  return {
    enabled: testing ? false : toBool(process.env.AI_GUIDE_ENABLED, false),
    provider: testing
      ? "disabled"
      : String(process.env.AI_GUIDE_PROVIDER || "disabled").trim().toLowerCase(),
    model: String(process.env.AI_GUIDE_MODEL || "qwen2.5:7b").trim(),
    baseUrl: String(process.env.AI_GUIDE_BASE_URL || "http://127.0.0.1:11434").trim(),
    maxOutputTokens: toNumber(process.env.AI_GUIDE_MAX_OUTPUT_TOKENS, 160),
    timeoutMs: toNumber(process.env.AI_GUIDE_TIMEOUT_MS, 20_000),
    maxContextChars: toNumber(process.env.AI_GUIDE_MAX_CONTEXT_CHARS, 2000),
    maxHistoryMessages: toNumber(process.env.AI_GUIDE_MAX_HISTORY_MESSAGES, 4),
    maxProcedureChars: toNumber(process.env.AI_GUIDE_MAX_PROCEDURE_CHARS, 900),
    maxToolResults: toNumber(process.env.AI_GUIDE_MAX_TOOL_RESULTS, 6),
    defaultLanguage,
  };
};

/** Rough token estimate. Kept deliberately simple; ~4 chars per token. */
export const estimateTokens = (chars: number) => Math.ceil(chars / 4);
