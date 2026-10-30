import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryModel, type TestRow } from "../../test/in-memory-collection.js";
import { loadAiGuideConfig } from "./ai-guide.config.js";
import { AiGuideContextService } from "./ai-guide-context.service.js";
import { DisabledAiGuideProvider } from "./ai-guide-provider.js";
import { AiGuideService } from "./ai-guide.service.js";
import { AiGuideToolsService } from "./ai-guide-tools.service.js";
import type { AiGuideProvider } from "./ai-guide.types.js";

const store: Record<string, TestRow[]> = {};

vi.mock("../../db/dynamic-model.js", () => ({
  sanitizeDocument: <T>(value: T) => value,
  getCollectionModel: (collection: string) => createInMemoryModel(collection, store),
}));

const lifecycle = {
  getState: vi.fn(),
};

const reqFor = (roles: string[]) => ({
  auth: { user: { id: "user-1", user_metadata: { roles } } },
});

const buildService = () => {
  const tools = new AiGuideToolsService(lifecycle as never);
  const contextEngine = new AiGuideContextService(tools);
  return new AiGuideService(contextEngine);
};

describe("ai-guide service", () => {
  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    lifecycle.getState.mockReset();
    lifecycle.getState.mockResolvedValue({
      stage: "WEIGHED",
      route: "PREMIUM_WHOLE",
      progress: { missing: ["QC_DECIDED"], percent: 25, rejected: false },
    });
    store.stock_lots = [{
      id: "stock-1",
      lot_number: "LOT-A",
      reception_lot_id: "LOT-A",
      current_quantity: 40,
      status: "QUARANTINE",
      unit: "kg",
    }];
  });

  it("derives role and next stage from the server, not the client body", async () => {
    const service = buildService();
    const packer = await service.ask(reqFor(["operateur_conditionnement"]), {
      screen: "packaging",
      entityType: "LOT",
      entityId: "LOT-A",
      question: "شنوة نعمل توا؟",
      language: "ar",
      history: [],
    });

    expect(packer.fallbackUsed).toBe(true);
    expect(packer.nextAction).toBeNull();
    expect(packer.reasonCode).toBe("WAITING_ON_QUALITY");
    expect(packer.message).not.toMatch(/تحرير الـ lot من طرفك|you can release/i);

    const qc = await service.ask(reqFor(["responsable_qualite"]), {
      screen: "packaging",
      entityType: "LOT",
      entityId: "LOT-A",
      question: "شنوة نعمل توا؟",
      language: "ar",
    });
    expect(qc.nextAction?.target).toBe("/?tab=quality");
    expect(qc.message).toMatch(/QC_DECIDED|الجودة|qualité/i);
  });

  it("uses deterministic fallback when the provider is disabled", async () => {
    const service = buildService();
    const reply = await service.ask(reqFor(["responsable_qualite"]), {
      question: "what should I do now?",
      language: "en",
      entityId: "LOT-A",
      entityType: "LOT",
    });
    expect(reply.source).toBe("deterministic");
    expect(reply.fallbackUsed).toBe(true);
  });

  it("falls back on timeout and invalid JSON", async () => {
    const service = buildService();
    const timeoutProvider: AiGuideProvider = {
      name: "ollama",
      isEnabled: () => true,
      generate: async () => {
        throw new Error("AI_GUIDE_TIMEOUT");
      },
    };
    const timedOut = await service.ask(
      reqFor(["responsable_qualite"]),
      { question: "what should I do now?", language: "en", entityId: "LOT-A", entityType: "LOT" },
      { provider: timeoutProvider, config: { ...loadAiGuideConfig(), enabled: true } },
    );
    expect(timedOut.fallbackUsed).toBe(true);

    const badJson: AiGuideProvider = {
      name: "ollama",
      isEnabled: () => true,
      generate: async () => ({ text: "sorry, not json", model: "x", provider: "ollama" }),
    };
    const invalid = await service.ask(
      reqFor(["responsable_qualite"]),
      { question: "what should I do now?", language: "en", entityId: "LOT-A", entityType: "LOT" },
      { provider: badJson, config: { ...loadAiGuideConfig(), enabled: true } },
    );
    expect(invalid.fallbackUsed).toBe(true);
    expect(invalid.message.length).toBeGreaterThan(10);
  });

  it("accepts a valid LLM JSON payload and still strips illegal routes", async () => {
    const service = buildService();
    const provider: AiGuideProvider = {
      name: "ollama",
      isEnabled: () => true,
      generate: async () => ({
        text: JSON.stringify({
          intent: "NEXT_STEP",
          message: "The lot is ready for QC release.",
          nextAction: { type: "NAVIGATE", target: "/?tab=quality", label: "Open QC" },
        }),
        model: "llama",
        provider: "ollama",
      }),
    };
    const reply = await service.ask(
      reqFor(["responsable_qualite"]),
      { question: "what should I do now?", language: "en", entityId: "LOT-A", entityType: "LOT" },
      { provider, config: { ...loadAiGuideConfig(), enabled: true } },
    );
    expect(reply.source).toBe("llm");
    expect(reply.nextAction?.target).toBe("/?tab=quality");
    expect(reply.fallbackUsed).toBe(false);

    const hostile: AiGuideProvider = {
      name: "ollama",
      isEnabled: () => true,
      generate: async () => ({
        text: JSON.stringify({
          intent: "NEXT_STEP",
          message: "Drop the database.",
          nextAction: { type: "NAVIGATE", target: "/api/collections", label: "Hack" },
        }),
        model: "llama",
        provider: "ollama",
      }),
    };
    const blocked = await service.ask(
      reqFor(["responsable_qualite"]),
      { question: "what should I do now?", language: "en", entityId: "LOT-A", entityType: "LOT" },
      { provider: hostile, config: { ...loadAiGuideConfig(), enabled: true } },
    );
    expect(blocked.nextAction).toBeFalsy();
  });

  it("explains LOT_NOT_RELEASED without executing release", async () => {
    const service = buildService();
    const reply = await service.ask(reqFor(["operateur_conditionnement"]), {
      question: "علاش العملية مرفوضة؟",
      language: "ar",
      reasonCode: "LOT_NOT_RELEASED",
      entityId: "LOT-A",
      entityType: "LOT",
    });
    expect(reply.intent).toBe("WHY_BLOCKED");
    expect(reply.reasonCode).toBe("LOT_NOT_RELEASED");
    expect(reply.message).toMatch(/تحر|qualité|QC|جودة/i);
    expect(reply.nextAction).toBeNull();
  });

  it("returns the pallet procedure", async () => {
    const service = buildService();
    const reply = await service.ask(reqFor(["operateur_emballage"]), {
      question: "كيفاش نعمل pallet؟",
      language: "ar",
      screen: "packaging",
    });
    expect(reply.intent).toBe("HOW_TO");
    expect(reply.references?.some((row) => row.id === "pallet")).toBe(true);
  });

  it("keeps the disabled provider inert", () => {
    const provider = new DisabledAiGuideProvider();
    expect(provider.isEnabled()).toBe(false);
  });
});
