/**
 * Replaceable LLM gateway. The rest of the guide talks only to AiGuideProvider.
 * Ollama is the default adapter; "disabled" is a no-op used in tests and when
 * the plant has not configured a model.
 *
 * Generate uses the Ollama stream so a timeout can actually abort. stream:false
 * holds the HTTP response until the full CPU generation finishes, which left
 * the Assistant sheet on "thinking" indefinitely.
 */

import type {
  AiGuideGenerationRequest,
  AiGuideGenerationResponse,
  AiGuideProvider,
} from "./ai-guide.types.js";

export class DisabledAiGuideProvider implements AiGuideProvider {
  readonly name = "disabled";
  isEnabled() {
    return false;
  }
  async generate(): Promise<AiGuideGenerationResponse> {
    throw new Error("AI_GUIDE_DISABLED");
  }
}

const EMBED_MODEL = /embed|bge-/i;

const raceTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("AI_GUIDE_TIMEOUT")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

const readOllamaStream = async (
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): Promise<string> => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const chunk = JSON.parse(trimmed) as { response?: string };
          text += String(chunk.response || "");
        } catch {
          // partial line; wait for the next chunk
        }
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // ignore
    }
  }
  if (signal.aborted) {
    const abortError = new Error("AI_GUIDE_TIMEOUT");
    abortError.name = "AbortError";
    throw abortError;
  }
  return text;
};

export class OllamaAiGuideProvider implements AiGuideProvider {
  readonly name = "ollama";
  private resolvedModel: string | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly enabled: boolean,
  ) {}

  isEnabled() {
    return this.enabled;
  }

  private endpoint(path: string) {
    return `${this.baseUrl.replace(/\/$/, "")}${path}`;
  }

  async resolveModel(requested: string, signal?: AbortSignal): Promise<string> {
    if (this.resolvedModel) return this.resolvedModel;
    try {
      const response = await fetch(this.endpoint("/api/tags"), { signal });
      if (!response.ok) {
        this.resolvedModel = requested;
        return requested;
      }
      const payload = await response.json() as { models?: Array<{ name?: string }> };
      const names = (payload.models || []).map((row) => String(row.name || "")).filter(Boolean);
      const exact = names.find((name) => name === requested || name.startsWith(`${requested}:`));
      if (exact) {
        this.resolvedModel = exact;
        return exact;
      }
      const preferred =
        names.find((name) => name.startsWith("qwen2.5")) ||
        names.find((name) => name.startsWith("llama3")) ||
        names.find((name) => !EMBED_MODEL.test(name));
      this.resolvedModel = preferred || requested;
      return this.resolvedModel;
    } catch {
      this.resolvedModel = requested;
      return requested;
    }
  }

  async generate(request: AiGuideGenerationRequest): Promise<AiGuideGenerationResponse> {
    const controller = new AbortController();
    const run = async () => {
      const model = await this.resolveModel(request.model, controller.signal);
      const response = await fetch(this.endpoint("/api/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          prompt: `${request.system}\n\n${request.user}`,
          stream: true,
          format: "json",
          options: { num_predict: request.maxOutputTokens, temperature: 0.1 },
        }),
      });
      if (!response.ok) {
        throw new Error(`AI_GUIDE_PROVIDER_HTTP_${response.status}`);
      }
      if (!response.body) {
        throw new Error("AI_GUIDE_PROVIDER_EMPTY");
      }
      const text = await readOllamaStream(response.body, controller.signal);
      return {
        text,
        model: String(model),
        provider: this.name,
      };
    };

    try {
      return await raceTimeout(run(), request.timeoutMs);
    } catch (error) {
      controller.abort();
      if (
        (error as { name?: string })?.name === "AbortError"
        || (error as { message?: string })?.message === "AI_GUIDE_TIMEOUT"
      ) {
        throw new Error("AI_GUIDE_TIMEOUT");
      }
      throw error;
    }
  }
}

export const createAiGuideProvider = (input: {
  enabled: boolean;
  provider: string;
  baseUrl: string;
}): AiGuideProvider => {
  if (!input.enabled || input.provider === "disabled" || input.provider === "none") {
    return new DisabledAiGuideProvider();
  }
  if (input.provider === "ollama") {
    return new OllamaAiGuideProvider(input.baseUrl, true);
  }
  return new DisabledAiGuideProvider();
};
