import { describe, expect, it } from "vitest";

import { applyContextBudget, boundHistory, normalizeLanguage, normalizeScreen } from "./ai-guide-context.service.js";
import {
  composeDeterministicResponse,
  parseModelJson,
  validateAiGuideResponse,
  validateNextAction,
} from "./ai-guide-response.js";
import type { AiGuideContext } from "./ai-guide.types.js";

const context = (over: Partial<AiGuideContext> = {}): AiGuideContext => ({
  role: "operateur_conditionnement",
  roles: ["operateur_conditionnement"],
  screen: "packaging",
  language: "ar",
  workflow: {
    stage: "TRIAGE",
    route: "PREMIUM_WHOLE",
    status: "RELEASED",
    percent: 70,
    allowedActions: ["PACKED"],
    blockingReason: null,
  },
  entity: { type: "LOT", id: "LOT-A" },
  procedureId: "pallet",
  screenHelpId: "packaging",
  errorCode: null,
  userQuestion: "شنوة نعمل توا؟",
  ...over,
});

describe("ai-guide context budget", () => {
  it("drops history then procedure when over budget", () => {
    const first = applyContextBudget(
      { userQuestion: "x", history: [{ role: "user", content: "old".repeat(80) }], procedure: "step".repeat(200), workflow: { stage: "QC_DECIDED" } },
      180,
    );
    expect(first.chars).toBeLessThanOrEqual(180);
    expect(first.json).toContain("QC_DECIDED");
    expect(JSON.parse(first.json).history || []).toEqual([]);
  });

  it("keeps only the last history messages", () => {
    const history = boundHistory(
      [
        { role: "user", content: "1" },
        { role: "assistant", content: "2" },
        { role: "user", content: "3" },
        { role: "assistant", content: "4" },
        { role: "user", content: "5" },
      ],
      4,
    );
    expect(history).toHaveLength(4);
    expect(history[0].content).toBe("2");
  });

  it("normalizes screen aliases and language", () => {
    expect(normalizeScreen("stock-dashboard")).toBe("storage");
    expect(normalizeLanguage("AR-TN", "fr")).toBe("ar");
    expect(normalizeLanguage("xx", "fr")).toBe("fr");
  });
});

describe("ai-guide response validation", () => {
  it("rejects invented navigation targets", () => {
    expect(validateNextAction({ type: "NAVIGATE", target: "/admin/wipe", label: "wipe" }, context())).toBeNull();
    expect(validateNextAction({ type: "NAVIGATE", target: "/?tab=packaging", label: "Open packaging" }, context())).toMatchObject({
      target: "/?tab=packaging",
    });
  });

  it("rejects mutation action types from the model", () => {
    expect(validateNextAction({ type: "RELEASE", target: "/?tab=quality", label: "Release" }, context())).toBeNull();
  });

  it("falls back when JSON is invalid", () => {
    expect(parseModelJson("not json")).toBeNull();
    expect(validateAiGuideResponse(null, { intent: "NEXT_STEP", context: context(), source: "llm", fallbackUsed: false })).toBeNull();
  });

  it("composes Arabic next-step guidance from workflow state", () => {
    const reply = composeDeterministicResponse({ intent: "NEXT_STEP", context: context() });
    expect(reply.fallbackUsed).toBe(true);
    expect(reply.message).toMatch(/TRIAGE|التعليب|PACKED/);
    expect(reply.nextAction?.target).toBe("/?tab=packaging");
  });

  it("does not offer an executable QC action to a packer", () => {
    const reply = composeDeterministicResponse({
      intent: "WHY_BLOCKED",
      context: context({
        workflow: {
          stage: "WEIGHED",
          route: "PREMIUM_WHOLE",
          status: "WEIGHED",
          percent: 20,
          allowedActions: [],
          blockingReason: "WAITING_ON_QUALITY",
        },
        errorCode: "WAITING_ON_QUALITY",
      }),
    });
    expect(reply.nextAction).toBeNull();
    expect(reply.message).toMatch(/جودة|qualité|quality|دورك/i);
  });

  it("returns the pallet procedure for HOW_TO", () => {
    const reply = composeDeterministicResponse({ intent: "HOW_TO", context: context() });
    expect(reply.references?.some((row) => row.id === "pallet")).toBe(true);
    expect(reply.message).toMatch(/منصّة|palette|SSCC/i);
  });

  it("answers in French and English from the same state", () => {
    const fr = composeDeterministicResponse({ intent: "NEXT_STEP", context: context({ language: "fr" }) });
    const en = composeDeterministicResponse({ intent: "NEXT_STEP", context: context({ language: "en" }) });
    expect(fr.message).toMatch(/étape|conditionnement/i);
    expect(en.message).toMatch(/stage|packaging/i);
  });

  it("explains that mutations are not performed", () => {
    const reply = composeDeterministicResponse({
      intent: "NAVIGATE",
      context: context(),
      mutationAttempt: true,
    });
    expect(reply.message).toMatch(/لا أستطيع|Je ne peux pas|I cannot/);
  });
});
