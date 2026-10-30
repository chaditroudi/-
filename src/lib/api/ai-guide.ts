import { apiRequest } from "@/integrations/mongodb/client";
import { axiosClient } from "@/lib/axiosClient";

export type AiGuideIntent =
  | "NEXT_STEP"
  | "EXPLAIN"
  | "HOW_TO"
  | "WHY_BLOCKED"
  | "CHECKLIST"
  | "NAVIGATE"
  | "GENERAL_HELP";

export interface AiGuideNextAction {
  type: "NAVIGATE";
  target: string;
  label: string;
}

export interface AiGuideReply {
  message: string;
  intent: AiGuideIntent;
  reasonCode?: string | null;
  nextAction?: AiGuideNextAction | null;
  language: string;
  fallbackUsed: boolean;
  source: "llm" | "deterministic";
}

export interface AiGuideAskInput {
  screen?: string | null;
  entityType?: "LOT" | null;
  entityId?: string | null;
  element?: string | null;
  question?: string | null;
  language?: string | null;
  reasonCode?: string | null;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface AiGuideStatus {
  enabled: boolean;
  provider: string;
  model?: string;
  maxContextChars?: number;
  maxHistoryMessages?: number;
}

export const aiGuideApi = {
  status: () => apiRequest<{ data: AiGuideStatus }>("/ai-guide/status"),
  ask: (body: AiGuideAskInput, signal?: AbortSignal) =>
    axiosClient
      .request<{ data: AiGuideReply }>({
        url: "/ai-guide/ask",
        method: "POST",
        data: body,
        timeout: 25_000,
        signal,
      })
      .then((response) => response.data),
};
