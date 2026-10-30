/**
 * Orchestrator. Context engine → intent → optional LLM phrasing → validation.
 * On any provider failure the deterministic fallback answers from MES state.
 */

import { Injectable } from "@nestjs/common";
import { loadAiGuideConfig, estimateTokens, type AiGuideConfig } from "./ai-guide.config.js";
import { AiGuideContextService } from "./ai-guide-context.service.js";
import { detectIntent, looksLikeMutationRequest } from "./ai-guide-intent.js";
import { buildSystemPrompt, buildUserPrompt } from "./ai-guide-prompt.js";
import { createAiGuideProvider } from "./ai-guide-provider.js";
import {
  composeDeterministicResponse,
  parseModelJson,
  validateAiGuideResponse,
} from "./ai-guide-response.js";
import type {
  AiGuideMessageInput,
  AiGuideMetrics,
  AiGuideProvider,
  AiGuideResponse,
} from "./ai-guide.types.js";

const logMetrics = (metrics: AiGuideMetrics) => {
  console.info("[AI_GUIDE_REQUEST]", {
    intent: metrics.intent,
    provider: metrics.provider,
    model: metrics.model,
    AI_GUIDE_INPUT_TOKENS: estimateTokens(metrics.promptChars),
    AI_GUIDE_OUTPUT_TOKENS: estimateTokens(metrics.outputChars),
    AI_GUIDE_LATENCY: metrics.latencyMs,
    AI_GUIDE_FALLBACK: metrics.fallbackUsed,
    contextChars: metrics.contextChars,
  });
};

@Injectable()
export class AiGuideService {
  private liveProvider: AiGuideProvider | null = null;

  constructor(private readonly contextEngine: AiGuideContextService) {}

  private providerFor(config: AiGuideConfig, override?: AiGuideProvider) {
    if (override) return override;
    if (!this.liveProvider) this.liveProvider = createAiGuideProvider(config);
    return this.liveProvider;
  }

  async ask(
    req: { auth?: { user?: { id?: string } } },
    input: AiGuideMessageInput,
    overrides: { config?: AiGuideConfig; provider?: AiGuideProvider } = {},
  ): Promise<AiGuideResponse> {
    const started = Date.now();
    const config = overrides.config ?? loadAiGuideConfig();
    const provider = this.providerFor(config, overrides.provider);
    const built = await this.contextEngine.build(req, input, config);
    const intent = detectIntent(input);
    const mutationAttempt = looksLikeMutationRequest(String(input.question || ""));

    const fallback = () =>
      composeDeterministicResponse({
        intent,
        context: built.context,
        mutationAttempt,
        fallbackPrefix: true,
      });

    const finish = (response: AiGuideResponse, extra: Partial<AiGuideMetrics> = {}) => {
      logMetrics({
        intent: response.intent,
        provider: extra.provider || provider.name,
        model: extra.model || config.model,
        contextChars: built.budget.chars,
        promptChars: extra.promptChars || built.budget.chars,
        outputChars: extra.outputChars || response.message.length,
        latencyMs: Date.now() - started,
        fallbackUsed: response.fallbackUsed,
      });
      return response;
    };

    if (mutationAttempt || !provider.isEnabled()) {
      const response = composeDeterministicResponse({
        intent: mutationAttempt ? "NAVIGATE" : intent,
        context: built.context,
        mutationAttempt,
        fallbackPrefix: !provider.isEnabled(),
      });
      return finish(response);
    }

    const system = buildSystemPrompt(built.context.language);
    const user = buildUserPrompt({ intent, compactJson: built.budget.json });
    try {
      const generated = await provider.generate({
        system,
        user,
        language: built.context.language,
        maxOutputTokens: config.maxOutputTokens,
        timeoutMs: config.timeoutMs,
        model: config.model,
      });
      const parsed = parseModelJson(generated.text);
      const validated = validateAiGuideResponse(parsed, {
        intent,
        context: built.context,
        source: "llm",
        fallbackUsed: false,
      });
      if (!validated) {
        return finish(fallback(), {
          provider: generated.provider,
          model: generated.model,
          promptChars: system.length + user.length,
          outputChars: generated.text.length,
        });
      }
      return finish(validated, {
        provider: generated.provider,
        model: generated.model,
        promptChars: system.length + user.length,
        outputChars: generated.text.length,
      });
    } catch {
      return finish(fallback(), { provider: provider.name });
    }
  }

  status() {
    const config = loadAiGuideConfig();
    const provider = this.providerFor(config);
    return {
      enabled: provider.isEnabled(),
      provider: provider.name,
      model: config.model,
      maxContextChars: config.maxContextChars,
      maxHistoryMessages: config.maxHistoryMessages,
    };
  }
}
