/**
 * Read-only tools. The LLM never calls Mongo, shell, or HTTP itself.
 * Each helper returns a tiny object, capped, and is invoked only by the
 * context engine with the authenticated user's roles.
 */

import { Injectable } from "@nestjs/common";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { getRequestRoles, isAdmin } from "../../middleware/authorization.js";
import { LotLifecycleService } from "../trust/lot-lifecycle.service.js";
import type { AiGuideConfig } from "./ai-guide.config.js";
import type { AiGuideLanguage } from "./ai-guide.types.js";
import { errorExplanation, isKnownErrorCode } from "./content/errors.js";
import { navTarget, STAGE_ACTIONS } from "./content/navigation.js";
import { AI_GUIDE_PROCEDURES, procedureText } from "./content/procedures.js";
import { screenHelpText } from "./content/screens.js";

const clip = (value: string, max: number) =>
  value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}…`;

@Injectable()
export class AiGuideToolsService {
  constructor(private readonly lifecycle: LotLifecycleService) {}

  getCurrentUserContext(req: { auth?: { user?: { id?: string } } }) {
    const roles = getRequestRoles(req);
    return {
      userId: req.auth?.user?.id ?? null,
      roles,
      admin: isAdmin(req),
    };
  }

  async getLotStatus(lotId: string | null | undefined) {
    if (!lotId) return null;
    try {
      const state = await this.lifecycle.getState(lotId);
      const missing = state.progress?.missing ?? [];
      return {
        id: lotId,
        stage: state.stage ?? null,
        route: state.route ?? null,
        percent: state.progress?.percent ?? null,
        rejected: Boolean(state.progress?.rejected),
        missing,
        nextStage: missing[0] ?? null,
      };
    } catch {
      return null;
    }
  }

  async getRelevantStock(lotId: string | null | undefined) {
    if (!lotId) return null;
    const row = sanitizeDocument(
      await getCollectionModel("stock_lots")
        .findOne({
          $or: [
            { id: lotId },
            { lot_number: lotId },
            { source_lot_internal: lotId },
            { reception_lot_id: lotId },
          ],
        })
        .lean()
        .exec(),
    ) as {
      current_quantity?: number;
      status?: string;
      lot_number?: string;
      unit?: string;
    } | null;
    if (!row) return null;
    return {
      lot_number: row.lot_number ?? lotId,
      current_quantity: Number(row.current_quantity ?? 0),
      status: row.status ?? null,
      unit: row.unit ?? "kg",
    };
  }

  getAllowedTransitions(roles: string[], nextStage: string | null, admin: boolean) {
    if (!nextStage) return [] as string[];
    const action = STAGE_ACTIONS[nextStage];
    if (!action) return [];
    if (admin || action.roles.some((role) => roles.includes(role))) {
      return [nextStage];
    }
    return [];
  }

  getBlockingReason(args: {
    errorCode: string | null;
    nextStage: string | null;
    allowed: string[];
    rejected: boolean;
  }): string | null {
    if (args.errorCode) return args.errorCode;
    if (args.rejected) return "LOT_REJECTED";
    if (args.nextStage && args.allowed.length === 0) {
      if (args.nextStage === "QC_DECIDED") return "WAITING_ON_QUALITY";
      return "ROLE_NOT_PERMITTED";
    }
    return null;
  }

  getProcedure(procedureId: string | null, language: AiGuideLanguage, maxChars: number) {
    if (!procedureId || !AI_GUIDE_PROCEDURES[procedureId]) return null;
    const text = procedureText(procedureId, language);
    return text ? clip(text, maxChars) : null;
  }

  getScreenHelp(screenId: string | null, element: string | null, language: AiGuideLanguage) {
    if (!screenId) return null;
    return screenHelpText(screenId, element, language);
  }

  getErrorExplanation(code: string | null, language: AiGuideLanguage) {
    if (!code) return null;
    if (!isKnownErrorCode(code)) return clip(code, 80);
    return errorExplanation(code, language);
  }

  navigationForStage(stage: string | null, roles: string[], admin: boolean, language: AiGuideLanguage) {
    if (!stage) return null;
    const action = STAGE_ACTIONS[stage];
    if (!action) return null;
    if (!admin && !action.roles.some((role) => roles.includes(role))) return null;
    return {
      type: "NAVIGATE" as const,
      target: navTarget(action.tab),
      label: action.label[language],
    };
  }

  capToolResults<T>(rows: T[], config: AiGuideConfig): T[] {
    return rows.slice(0, config.maxToolResults);
  }
}
