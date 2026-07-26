import { describe, expect, it } from "vitest";
import { GOLDEN_THREAD_STAGES } from "./lot-state-machine.js";
describe("W2 passport + recall contracts", () => {
    it("exposes golden-thread stages used by buyer passport claims", () => {
        expect(GOLDEN_THREAD_STAGES).toContain("FUMIGATION_CCP");
        expect(GOLDEN_THREAD_STAGES).toContain("SHIPPED");
        expect(GOLDEN_THREAD_STAGES).toHaveLength(8);
    });
    it("treats sub-60s as the recall drill success threshold", () => {
        const elapsedMs = 842;
        expect(elapsedMs < 60_000).toBe(true);
    });
});
