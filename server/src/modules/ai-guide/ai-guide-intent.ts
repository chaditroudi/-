/**
 * Deterministic intent detection. The LLM is only asked when the question is
 * ambiguous. Obvious shop-floor phrases never spend a model call.
 */

import type { AiGuideIntent, AiGuideMessageInput } from "./ai-guide.types.js";

const MUTATION_RE =
  /\b(release|lib[eéèê]r\w*|ship(?:ment|ped)?|exp[eéè]di\w*|consom\w*|consume|move stock|d[eéè]cr[eéè]ment\w*|valider le qc)|حرّر|حرر|اشحن|استهلك/i;

const NEXT_RE =
  /شنوة نعمل|شنو نعمل|ماذا أفعل|what (should|do) i do|que faire|prochaine [eé]tape|next step|ماذا بعد|توا\s*\?|الآن\s*\?/i;

const BLOCKED_RE =
  /علاش|لماذا|why (am i )?block|pourquoi (bloqu|refus)|مرفوض|refus[eé]|LOT_NOT|INSUFFICIENT|blocked/i;

const HOW_RE =
  /كيفاش|كيف أ|how (do|to)|comment (faire|je)|proc[eé]dure|خطوات/i;

const EXPLAIN_RE =
  /explain|شنوة معناها|ما معنى|qu'est-ce que|c'est quoi|what does .* mean/i;

const CHECKLIST_RE = /checklist|liste des [eé]tapes|قائمة|check-list/i;

const NAV_RE = /ouvrir|open (the )?(qc|reception|packaging)|اذهب إلى|افتح/i;

const PALLET_RE = /pallet|palette|منصّة|منصة|sscc/i;

export const looksLikeMutationRequest = (question: string): boolean => MUTATION_RE.test(question);

export const detectIntent = (input: AiGuideMessageInput): AiGuideIntent => {
  const question = String(input.question || "").trim();
  if (input.element) return "EXPLAIN";
  if (input.reasonCode) return "WHY_BLOCKED";
  if (!question) return "NEXT_STEP";
  if (CHECKLIST_RE.test(question)) return "CHECKLIST";
  if (BLOCKED_RE.test(question)) return "WHY_BLOCKED";
  if (PALLET_RE.test(question) || HOW_RE.test(question)) return "HOW_TO";
  if (EXPLAIN_RE.test(question)) return "EXPLAIN";
  if (NAV_RE.test(question)) return "NAVIGATE";
  if (NEXT_RE.test(question)) return "NEXT_STEP";
  return "GENERAL_HELP";
};

export const procedureHintFromQuestion = (question: string): string | null => {
  const q = question.toLowerCase();
  if (PALLET_RE.test(q)) return "pallet";
  if (/reception|استقبال|réception/.test(q)) return "reception";
  if (/\bqc\b|qualit|جودة/.test(q)) return "qc";
  if (/storage|stockage|تخزين/.test(q)) return "storage";
  if (/triage|فرز/.test(q)) return "triage";
  if (/packag|conditionn|تعليب/.test(q)) return "packaging";
  if (/ship|exp[eé]d|شحن/.test(q)) return "shipment";
  if (/production|إنتاج|انتاج/.test(q)) return "production";
  return null;
};
