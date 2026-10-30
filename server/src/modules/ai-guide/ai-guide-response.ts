/**
 * Validate LLM JSON against MES enums. Anything outside the whitelist is dropped.
 * Deterministic fallback never needs a model.
 */

import type { AiGuideIntent } from "./ai-guide.types.js";
import {
  AI_GUIDE_INTENTS,
  type AiGuideContext,
  type AiGuideLanguage,
  type AiGuideNextAction,
  type AiGuideResponse,
} from "./ai-guide.types.js";
import { isKnownErrorCode } from "./content/errors.js";
import { errorExplanation } from "./content/errors.js";
import { isWhitelistedNavTarget, navTarget, STAGE_ACTIONS } from "./content/navigation.js";
import { AI_GUIDE_PROCEDURES, procedureText } from "./content/procedures.js";
import { screenHelpText } from "./content/screens.js";
import { roleHelpText } from "./content/roles.js";

const FALLBACK: Record<AiGuideLanguage, string> = {
  ar: "تعذّر المساعد الذكي. الإرشاد أدناه مبني على حالة النظام الحالية.",
  fr: "Assistant IA indisponible. Guidage déterministe ci-dessous, d'après l'état actuel.",
  en: "AI assistant unavailable. Deterministic guidance below is from the current system state.",
};

const MUTATION: Record<AiGuideLanguage, string> = {
  ar: "لا أستطيع تنفيذ العملية بنفسي. يمكنني شرحها وفتح الشاشة إن كان دورك يسمح.",
  fr: "Je ne peux pas exécuter l'opération. Je peux l'expliquer et ouvrir l'écran si votre rôle le permet.",
  en: "I cannot perform that operation. I can explain it and open the screen if your role allows.",
};

export const parseModelJson = (raw: string): Record<string, unknown> | null => {
  const text = String(raw || "").trim();
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
};

const asIntent = (value: unknown, fallback: AiGuideIntent): AiGuideIntent =>
  AI_GUIDE_INTENTS.includes(value as AiGuideIntent) ? (value as AiGuideIntent) : fallback;

export const validateNextAction = (
  raw: unknown,
  context: AiGuideContext,
): AiGuideNextAction | null => {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.type !== "NAVIGATE") return null;
  const target = String(row.target || "");
  if (!isWhitelistedNavTarget(target)) return null;
  const allowedTargets = new Set(
    (context.workflow?.allowedActions ?? [])
      .map((stage) => STAGE_ACTIONS[stage]?.tab)
      .filter(Boolean)
      .map((tab) => navTarget(String(tab))),
  );
  if (context.screen) allowedTargets.add(navTarget(context.screen));
  if (allowedTargets.size === 0) return null;
  if (!allowedTargets.has(target)) return null;
  const label = String(row.label || "").trim().slice(0, 80);
  if (!label) return null;
  return { type: "NAVIGATE", target, label };
};

export const validateAiGuideResponse = (
  raw: Record<string, unknown> | null,
  args: {
    intent: AiGuideIntent;
    context: AiGuideContext;
    source: "llm" | "deterministic";
    fallbackUsed: boolean;
  },
): AiGuideResponse | null => {
  if (!raw) return null;
  const message = String(raw.message || "").trim();
  if (!message) return null;
  const intent = asIntent(raw.intent, args.intent);
  const reasonCode = raw.reasonCode != null ? String(raw.reasonCode) : args.context.errorCode;
  const safeReason = reasonCode && (isKnownErrorCode(reasonCode) || reasonCode === args.context.errorCode)
    ? reasonCode
    : args.context.errorCode;
  const nextAction = validateNextAction(raw.nextAction, args.context);
  const references = Array.isArray(raw.references)
    ? raw.references
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const item = row as { type?: string; id?: string };
        if (!item.type || !item.id) return null;
        if (!["PROCEDURE", "SCREEN", "ERROR"].includes(item.type)) return null;
        return { type: item.type as "PROCEDURE" | "SCREEN" | "ERROR", id: String(item.id).slice(0, 80) };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .slice(0, 4)
    : undefined;

  return {
    message: message.slice(0, 1200),
    intent,
    reasonCode: safeReason,
    nextAction,
    references,
    language: args.context.language,
    fallbackUsed: args.fallbackUsed,
    source: args.source,
  };
};

const joinSentences = (parts: Array<string | null | undefined>) =>
  parts.filter((part) => part && String(part).trim()).join(" ");

export const composeDeterministicResponse = (args: {
  intent: AiGuideIntent;
  context: AiGuideContext;
  mutationAttempt?: boolean;
  fallbackPrefix?: boolean;
}): AiGuideResponse => {
  const { intent, context } = args;
  const lang = context.language;
  const stage = context.workflow?.stage;
  const next = context.workflow?.allowedActions[0] ?? null;
  const action = next ? STAGE_ACTIONS[next] : null;
  const nextAction = action && context.workflow?.allowedActions.length
    ? {
        type: "NAVIGATE" as const,
        target: navTarget(action.tab),
        label: action.label[lang],
      }
    : null;
  const safeNav = nextAction && isWhitelistedNavTarget(nextAction.target) ? nextAction : null;

  let message = "";
  if (args.mutationAttempt) {
    message = MUTATION[lang];
  } else if (intent === "WHY_BLOCKED") {
    message = joinSentences([
      errorExplanation(context.errorCode, lang),
      stage ? (lang === "ar" ? `المرحلة الحالية: ${stage}.` : lang === "fr" ? `Étape actuelle : ${stage}.` : `Current stage: ${stage}.`) : null,
      next
        ? null
        : (lang === "ar"
          ? "دورك لا ينفّذ الخطوة التالية. انتظر الفريق المختص."
          : lang === "fr"
            ? "Votre rôle n'exécute pas l'étape suivante. Attendez l'équipe concernée."
            : "Your role does not execute the next step. Wait for the responsible team."),
    ]);
  } else if (intent === "HOW_TO" || intent === "CHECKLIST") {
    message = procedureText(context.procedureId || "packaging", lang)
      || screenHelpText(context.screen || "packaging", null, lang)
      || FALLBACK[lang];
  } else if (intent === "EXPLAIN") {
    message = screenHelpText(context.screen || "", null, lang)
      || roleHelpText(context.roles, lang)
      || FALLBACK[lang];
  } else {
    const stageLine = stage
      ? (lang === "ar" ? `أنت الآن في مرحلة ${stage}.` : lang === "fr" ? `Vous êtes à l'étape ${stage}.` : `You are at stage ${stage}.`)
      : roleHelpText(context.roles, lang);
    const nextLine = next && action
      ? (lang === "ar"
        ? `الخطوة التالية المسموحة لدورك: ${action.label.ar}.`
        : lang === "fr"
          ? `Prochaine action autorisée pour votre rôle : ${action.label.fr}.`
          : `Next action allowed for your role: ${action.label.en}.`)
      : context.workflow?.blockingReason
        ? errorExplanation(context.workflow.blockingReason, lang)
        : (lang === "ar" ? "اختر لوطاً أو افتح شاشتك المعتادة للمتابعة." : lang === "fr" ? "Sélectionnez un lot ou ouvrez votre écran habituel." : "Select a lot or open your usual screen.");
    message = joinSentences([stageLine, nextLine]);
  }

  if (args.fallbackPrefix) {
    message = `${FALLBACK[lang]} ${message}`.trim();
  }

  const references = [];
  if (context.procedureId && AI_GUIDE_PROCEDURES[context.procedureId]) {
    references.push({ type: "PROCEDURE" as const, id: context.procedureId });
  }
  if (context.screen) references.push({ type: "SCREEN" as const, id: context.screen });
  if (context.errorCode) references.push({ type: "ERROR" as const, id: context.errorCode });

  return {
    message: message.slice(0, 1200),
    intent,
    reasonCode: context.errorCode,
    nextAction: intent === "WHY_BLOCKED" && !next ? null : safeNav,
    references: references.slice(0, 4),
    language: lang,
    fallbackUsed: true,
    source: "deterministic",
  };
};
