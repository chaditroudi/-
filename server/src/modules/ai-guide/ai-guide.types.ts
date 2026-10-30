/**
 * AI Employee Guide — shared types.
 *
 * The LLM is an explanation/language layer only. Every authoritative value
 * (role, workflow stage, allowed action, navigation target) is derived on the
 * server from existing MES services and validated against these enums before it
 * ever reaches the employee.
 */

export type AiGuideLanguage = "ar" | "fr" | "en";

export const AI_GUIDE_LANGUAGES: AiGuideLanguage[] = ["ar", "fr", "en"];

export type AiGuideIntent =
  | "NEXT_STEP"
  | "EXPLAIN"
  | "HOW_TO"
  | "WHY_BLOCKED"
  | "CHECKLIST"
  | "NAVIGATE"
  | "GENERAL_HELP";

export const AI_GUIDE_INTENTS: AiGuideIntent[] = [
  "NEXT_STEP",
  "EXPLAIN",
  "HOW_TO",
  "WHY_BLOCKED",
  "CHECKLIST",
  "NAVIGATE",
  "GENERAL_HELP",
];

/** Phase 1 is read-only. No mutation type is accepted from the LLM. */
export type AiGuideActionType = "NAVIGATE";

export interface AiGuideNextAction {
  type: AiGuideActionType;
  /** Must be one of the whitelisted navigation targets. */
  target: string;
  label: string;
}

export type AiGuideReferenceType = "PROCEDURE" | "SCREEN" | "ERROR";

export interface AiGuideReference {
  type: AiGuideReferenceType;
  id: string;
}

/** Contract returned to the employee and validated on the server. */
export interface AiGuideResponse {
  message: string;
  intent: AiGuideIntent;
  confidence?: number;
  reasonCode?: string | null;
  nextAction?: AiGuideNextAction | null;
  references?: AiGuideReference[];
  language: AiGuideLanguage;
  /** True when deterministic guidance was used instead of the LLM. */
  fallbackUsed: boolean;
  source: "llm" | "deterministic";
}

export interface AiGuideHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

/** Request payload sent by the React client. Role is NEVER trusted from here. */
export interface AiGuideMessageInput {
  screen?: string | null;
  entityType?: "LOT" | null;
  entityId?: string | null;
  element?: string | null;
  question?: string | null;
  language?: string | null;
  reasonCode?: string | null;
  history?: AiGuideHistoryMessage[];
}

export interface AiGuideWorkflowContext {
  stage: string | null;
  route: string | null;
  status: string | null;
  percent: number | null;
  allowedActions: string[];
  blockingReason: string | null;
}

/** Compact object handed to the prompt builder / LLM. Nothing else is sent. */
export interface AiGuideContext {
  role: string;
  roles: string[];
  screen: string | null;
  language: AiGuideLanguage;
  workflow: AiGuideWorkflowContext | null;
  entity: { type: "LOT"; id: string } | null;
  procedureId: string | null;
  screenHelpId: string | null;
  errorCode: string | null;
  userQuestion: string;
}

export interface AiGuideGenerationRequest {
  system: string;
  user: string;
  language: AiGuideLanguage;
  maxOutputTokens: number;
  timeoutMs: number;
  model: string;
}

export interface AiGuideGenerationResponse {
  /** Raw text returned by the model. Expected to be JSON, validated later. */
  text: string;
  model: string;
  provider: string;
}

export interface AiGuideProvider {
  readonly name: string;
  isEnabled(): boolean;
  generate(request: AiGuideGenerationRequest): Promise<AiGuideGenerationResponse>;
}

export interface AiGuideMetrics {
  intent: AiGuideIntent;
  provider: string;
  model: string;
  contextChars: number;
  promptChars: number;
  outputChars: number;
  latencyMs: number;
  fallbackUsed: boolean;
}
