import { describe, expect, it } from "vitest";

import { AppError } from "../../core/app-error.js";
import { buildLotEventRecord } from "./lot-ledger.js";
import {
  assertCanRecordStage,
  GOLDEN_THREAD_STAGES,
  goldenThreadProgress,
  isGoldenThreadComplete,
  STAGE_EVENT,
  stageFromChain,
} from "./lot-state-machine.js";

const eventFor = (stage: keyof typeof STAGE_EVENT, sequence: number, prevHash: string | null = null) =>
  buildLotEventRecord(
    {
      lotId: "LOT-GT-1",
      eventType: STAGE_EVENT[stage],
      collection: "test",
      action: "GATE",
      actorId: "tester",
      payload: { stage },
      prevHash,
      at: `2026-07-26T${String(10 + sequence).padStart(2, "0")}:00:00.000Z`,
    },
    sequence,
  );

describe("W1 golden-thread state machine", () => {
  it("lists the Deglet Nour premium whole stages", () => {
    expect(GOLDEN_THREAD_STAGES).toEqual([
      "SUPPLIER_INTAKE",
      "WEIGHED",
      "QC_DECIDED",
      "COLD_STORE",
      "FUMIGATION_CCP",
      "TRIAGE",
      "PACKED",
      "SHIPPED",
    ]);
  });

  it("derives current stage and progress from the chain", () => {
    const intake = eventFor("SUPPLIER_INTAKE", 1);
    const weighed = eventFor("WEIGHED", 2, intake.hash);
    const qc = eventFor("QC_DECIDED", 3, weighed.hash);

    expect(stageFromChain([intake, weighed, qc])).toBe("QC_DECIDED");
    expect(goldenThreadProgress([intake, weighed, qc])).toMatchObject({
      current: "QC_DECIDED",
      percent: 38,
      rejected: false,
    });
  });

  it("enforces CCP before triage/pack on PREMIUM_WHOLE route", () => {
    const intake = eventFor("SUPPLIER_INTAKE", 1);
    const qc = eventFor("QC_DECIDED", 2, intake.hash);

    expect(assertCanRecordStage([intake, qc], "FUMIGATION_CCP")).toBe("ok");
    expect(() => assertCanRecordStage([intake, qc], "TRIAGE", "PREMIUM_WHOLE")).toThrow(AppError);
    expect(assertCanRecordStage([intake, qc], "TRIAGE", "GENERIC")).toBe("ok");
  });

  it("is idempotent when a stage is already recorded", () => {
    const intake = eventFor("SUPPLIER_INTAKE", 1);
    expect(assertCanRecordStage([intake], "SUPPLIER_INTAKE")).toBe("already");
  });

  it("marks golden thread complete only at SHIPPED", () => {
    let prev: string | null = null;
    const events = GOLDEN_THREAD_STAGES.map((stage, index) => {
      const event = eventFor(stage, index + 1, prev);
      prev = event.hash;
      return event;
    });

    expect(isGoldenThreadComplete(events.slice(0, -1))).toBe(false);
    expect(isGoldenThreadComplete(events)).toBe(true);
  });
});
