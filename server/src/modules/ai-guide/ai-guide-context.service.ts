/**
 * Context engine. Collects a *small* object for the prompt. Role, workflow and
 * allowed actions are derived on the server. Frontend-supplied role is ignored.
 */

import { Injectable } from "@nestjs/common";
import type { AiGuideConfig } from "./ai-guide.config.js";
import { estimateTokens } from "./ai-guide.config.js";
import { procedureHintFromQuestion } from "./ai-guide-intent.js";
import { AiGuideToolsService } from "./ai-guide-tools.service.js";
import {
  AI_GUIDE_LANGUAGES,
  type AiGuideContext,
  type AiGuideHistoryMessage,
  type AiGuideLanguage,
  type AiGuideMessageInput,
} from "./ai-guide.types.js";
import { PROCEDURE_BY_SCREEN } from "./content/procedures.js";
import { roleHelpText } from "./content/roles.js";

const SCREEN_ALIASES: Record<string, string> = {
  "stock-dashboard": "storage",
  "stock-lots": "storage",
  "stock-products": "storage",
  "stock-movements": "storage",
  live: "home",
  scan: "scan",
};

export const normalizeScreen = (screen: string | null | undefined): string | null => {
  if (!screen) return null;
  const key = String(screen).trim().toLowerCase();
  return SCREEN_ALIASES[key] || key;
};

export const normalizeLanguage = (
  value: string | null | undefined,
  fallback: AiGuideLanguage,
): AiGuideLanguage => {
  const lang = String(value || "").slice(0, 2).toLowerCase();
  return (AI_GUIDE_LANGUAGES as string[]).includes(lang) ? (lang as AiGuideLanguage) : fallback;
};

export const boundHistory = (
  history: AiGuideHistoryMessage[] | undefined,
  maxMessages: number,
): AiGuideHistoryMessage[] => {
  const rows = Array.isArray(history) ? history : [];
  return rows
    .slice(-Math.max(0, maxMessages))
    .map((row) => ({
      role: row.role === "assistant" ? "assistant" : "user",
      content: String(row.content || "").slice(0, 280),
    }));
};

export const applyContextBudget = (
  payload: Record<string, unknown>,
  maxChars: number,
): { json: string; chars: number; tokens: number } => {
  let json = JSON.stringify(payload);
  if (json.length > maxChars && payload.history) {
    const copy = { ...payload, history: [] };
    json = JSON.stringify(copy);
  }
  if (json.length > maxChars && typeof payload.procedure === "string") {
    const copy = { ...payload, procedure: String(payload.procedure).slice(0, 240) };
    json = JSON.stringify(copy);
  }
  if (json.length > maxChars) {
    json = JSON.stringify({
      role: payload.role,
      screen: payload.screen,
      language: payload.language,
      workflow: payload.workflow,
      entity: payload.entity,
      errorCode: payload.errorCode,
      userQuestion: payload.userQuestion,
    });
  }
  if (json.length > maxChars) {
    json = json.slice(0, maxChars);
  }
  return { json, chars: json.length, tokens: estimateTokens(json.length) };
};

@Injectable()
export class AiGuideContextService {
  constructor(private readonly tools: AiGuideToolsService) {}

  async build(
    req: { auth?: { user?: { id?: string } } },
    input: AiGuideMessageInput,
    config: AiGuideConfig,
  ): Promise<{
    context: AiGuideContext;
    compact: Record<string, unknown>;
    budget: { json: string; chars: number; tokens: number };
    history: AiGuideHistoryMessage[];
  }> {
    const user = this.tools.getCurrentUserContext(req);
    const language = normalizeLanguage(input.language, config.defaultLanguage);
    const screen = normalizeScreen(input.screen);
    const entityId = input.entityType === "LOT" || input.entityId
      ? String(input.entityId || "").trim() || null
      : null;
    const question = String(input.question || "").trim().slice(0, 400);
    const errorCode = String(input.reasonCode || "").trim() || null;

    const lot = await this.tools.getLotStatus(entityId);
    const stock = await this.tools.getRelevantStock(entityId);
    const allowed = this.tools.getAllowedTransitions(user.roles, lot?.nextStage ?? null, user.admin);
    const blockingReason = this.tools.getBlockingReason({
      errorCode,
      nextStage: lot?.nextStage ?? null,
      allowed,
      rejected: Boolean(lot?.rejected),
    });

    const procedureId =
      procedureHintFromQuestion(question)
      || (screen ? PROCEDURE_BY_SCREEN[screen] ?? null : null);

    const context: AiGuideContext = {
      role: user.roles[0] || "authenticated",
      roles: user.roles,
      screen,
      language,
      workflow: lot
        ? {
            stage: lot.stage,
            route: lot.route,
            status: stock?.status ?? lot.stage,
            percent: lot.percent,
            allowedActions: allowed,
            blockingReason,
          }
        : screen
          ? {
              stage: null,
              route: null,
              status: null,
              percent: null,
              allowedActions: [],
              blockingReason: errorCode,
            }
          : null,
      entity: entityId ? { type: "LOT", id: entityId } : null,
      procedureId,
      screenHelpId: screen,
      errorCode: blockingReason || errorCode,
      userQuestion: question,
    };

    const procedure = this.tools.getProcedure(procedureId, language, config.maxProcedureChars);
    const screenHelp = this.tools.getScreenHelp(screen, input.element ?? null, language);
    const errorText = this.tools.getErrorExplanation(context.errorCode, language);
    const roleHelp = roleHelpText(user.roles, language);
    const history = boundHistory(input.history, config.maxHistoryMessages);

    const compact: Record<string, unknown> = {
      role: context.role,
      screen: context.screen,
      language: context.language,
      workflow: context.workflow
        ? {
            stage: context.workflow.stage,
            status: context.workflow.status,
            allowedActions: context.workflow.allowedActions,
            blockingReason: context.workflow.blockingReason,
          }
        : null,
      entity: context.entity,
      errorCode: context.errorCode,
      procedureId: context.procedureId,
      procedure,
      screenHelp,
      errorText,
      roleHelp,
      stock: stock
        ? { quantity: stock.current_quantity, unit: stock.unit, status: stock.status }
        : null,
      userQuestion: context.userQuestion,
      history,
    };

    return {
      context,
      compact,
      budget: applyContextBudget(compact, config.maxContextChars),
      history,
    };
  }
}
