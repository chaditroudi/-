import { describe, expect, it } from "vitest";

import { detectIntent, looksLikeMutationRequest, procedureHintFromQuestion } from "./ai-guide-intent.js";

describe("ai-guide intent", () => {
  it("maps what-now phrases to NEXT_STEP in ar/fr/en", () => {
    expect(detectIntent({ question: "شنوة نعمل توا؟" })).toBe("NEXT_STEP");
    expect(detectIntent({ question: "what should I do now?" })).toBe("NEXT_STEP");
    expect(detectIntent({ question: "que faire maintenant ?" })).toBe("NEXT_STEP");
  });

  it("maps blocked phrases and error codes to WHY_BLOCKED", () => {
    expect(detectIntent({ question: "علاش العملية مرفوضة؟" })).toBe("WHY_BLOCKED");
    expect(detectIntent({ reasonCode: "LOT_NOT_RELEASED" })).toBe("WHY_BLOCKED");
  });

  it("maps how-to and pallet questions to HOW_TO", () => {
    expect(detectIntent({ question: "كيفاش نعمل pallet؟" })).toBe("HOW_TO");
    expect(procedureHintFromQuestion("كيفاش نعمل palette")).toBe("pallet");
  });

  it("maps explain-this to EXPLAIN when an element is sent", () => {
    expect(detectIntent({ element: "available_quantity", question: "What does this mean?" })).toBe("EXPLAIN");
  });

  it("maps checklist phrasing", () => {
    expect(detectIntent({ question: "checklist conditionnement" })).toBe("CHECKLIST");
  });

  it("detects mutation requests so they are never executed", () => {
    expect(looksLikeMutationRequest("Release this lot for me")).toBe(true);
    expect(looksLikeMutationRequest("Libère ce lot pour moi")).toBe(true);
    expect(looksLikeMutationRequest("شنوة نعمل توا؟")).toBe(false);
  });
});
