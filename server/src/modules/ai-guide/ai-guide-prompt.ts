/**
 * Tiny prompt. The model receives this text plus the already-budgeted JSON.
 * No plant dump, no full workflow catalog, no long chat.
 */

import type { AiGuideIntent, AiGuideLanguage } from "./ai-guide.types.js";
import { AI_GUIDE_NAV_TARGETS } from "./content/navigation.js";

const LANG_NAME: Record<AiGuideLanguage, string> = {
  ar: "Arabic",
  fr: "French",
  en: "English",
};

export const buildSystemPrompt = (language: AiGuideLanguage): string =>
  [
    "You are the Date Harvest Hub employee guide.",
    `Reply in ${LANG_NAME[language]} only, 2-6 short sentences, or 3-7 numbered steps for procedures.`,
    "Return JSON only with keys: intent, message, nextAction (optional), reasonCode (optional).",
    "intent must be one of NEXT_STEP, EXPLAIN, HOW_TO, WHY_BLOCKED, CHECKLIST, NAVIGATE, GENERAL_HELP.",
    'nextAction if present: {"type":"NAVIGATE","target":"<whitelist>","label":"<short>"}.',
    `Whitelist: ${Array.from(AI_GUIDE_NAV_TARGETS).join(", ")}.`,
    "Never invent a workflow stage, permission, quantity, or route.",
    "Never claim you can release, ship, consume, or move stock. You only explain and navigate.",
    "If allowedActions is empty, do not tell the user they can execute the next stage.",
  ].join(" ");

export const buildUserPrompt = (args: {
  intent: AiGuideIntent;
  compactJson: string;
}): string =>
  `Intent hint: ${args.intent}\nContext:\n${args.compactJson}`;
