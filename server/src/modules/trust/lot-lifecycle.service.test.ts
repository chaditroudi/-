import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryModel, type TestRow } from "../../test/in-memory-collection.js";
import { buildLotEventRecord } from "./lot-ledger.js";
import {
  getSwallowedStageFailureCount,
  lotLifecycleService,
  resetSwallowedStageFailureCount,
} from "./lot-lifecycle.service.js";

const store: Record<string, TestRow[]> = {};
const emitted: TestRow[] = [];

vi.mock("../../db/dynamic-model.js", () => ({
  sanitizeDocument: <T>(value: T) => value,
  getCollectionModel: (collection: string) => createInMemoryModel(collection, store),
}));

vi.mock("../../db/defaults.js", () => ({
  prepareInsertDocument: vi.fn(async (_collection: string, value: TestRow) => ({
    id: `lot_events-id-${(store.lot_events?.length || 0) + 1}`,
    created_at: "2026-07-26T12:00:00.000Z",
    updated_at: "2026-07-26T12:00:00.000Z",
    ...value,
  })),
}));

vi.mock("../notifications/notification-emitter.js", () => ({
  emitNotification: vi.fn(async (input: TestRow) => {
    emitted.push(input);
    return input;
  }),
}));

describe("lotLifecycleService.recordStageSafe", () => {
  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    emitted.splice(0, emitted.length);
    resetSwallowedStageFailureCount();
  });

  it("records a successful stage without emitting a ledger failure alert", async () => {
    const result = await lotLifecycleService.recordStageSafe({
      lotId: "lot-1",
      toStage: "SUPPLIER_INTAKE",
      collection: "reception_lots",
      actorId: "user-1",
      route: "PREMIUM_WHOLE",
    });

    expect(result.skipped).toBe(false);
    expect(store.lot_events).toHaveLength(1);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].notificationType).toBe("LOT_SUPPLIER_INTAKE");
    expect(getSwallowedStageFailureCount()).toBe(0);
  });

  it("emits a warn notification and increments the counter when a stage is swallowed", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Cold store requires QC_DECIDED — empty chain must fail the FSM.
    const result = await lotLifecycleService.recordStageSafe({
      lotId: "lot-missing-qc",
      toStage: "COLD_STORE",
      collection: "storage_location_movements",
      actorId: "user-1",
      route: "PREMIUM_WHOLE",
    });

    expect(result.skipped).toBe(true);
    expect(result.event).toBeNull();
    expect(getSwallowedStageFailureCount()).toBe(1);

    const alert = emitted.find((row) => row.notificationType === "LOT_LEDGER_STAGE_FAILED");
    expect(alert).toMatchObject({
      category: "traceability",
      space: "alerts",
      severity: "warning",
      entityId: "lot-missing-qc",
      metadata: expect.objectContaining({
        stage: "COLD_STORE",
        code: "LOT_QC_REQUIRED",
        dual_run: true,
        swallowed_count: 1,
      }),
    });
    expect(String(alert?.title || "")).toContain("COLD_STORE");

    const events = store.lot_events || [];
    expect(events.some((row) => row.event_type === "GATE_BLOCKED")).toBe(true);
    expect(events.find((row) => row.event_type === "GATE_BLOCKED")?.payload).toMatchObject({
      attempted_stage: "COLD_STORE",
      code: "LOT_QC_REQUIRED",
    });

    consoleSpy.mockRestore();
  });

  it("still surfaces a miss when the lot already has intake but lacks QC", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const intake = buildLotEventRecord(
      {
        lotId: "lot-2",
        eventType: "LOT_CREATED",
        collection: "reception_lots",
        action: "GATE",
        actorId: "user-1",
        payload: { stage: "SUPPLIER_INTAKE", route: "PREMIUM_WHOLE" },
        prevHash: null,
      },
      1,
    );
    store.lot_events = [intake as unknown as TestRow];

    await lotLifecycleService.recordStageSafe({
      lotId: "lot-2",
      toStage: "PACKED",
      collection: "packaging_palettes",
      actorId: "user-1",
      route: "PREMIUM_WHOLE",
    });

    expect(getSwallowedStageFailureCount()).toBe(1);
    const alert = emitted.find((row) => row.notificationType === "LOT_LEDGER_STAGE_FAILED");
    expect(alert?.metadata).toMatchObject({
      stage: "PACKED",
      code: "LOT_TRIAGE_REQUIRED",
    });

    consoleSpy.mockRestore();
  });

  it("appends SHIPPED when packing is already on the chain", async () => {
    const lotId = "lot-ship";
    let prev: string | null = null;
    const stages = ["SUPPLIER_INTAKE", "QC_DECIDED", "FUMIGATION_CCP", "TRIAGE", "PACKED"] as const;
    const seeded = stages.map((stage, index) => {
      const event = buildLotEventRecord(
        {
          lotId,
          eventType: (
            {
              SUPPLIER_INTAKE: "LOT_CREATED",
              QC_DECIDED: "QC_DECIDED",
              FUMIGATION_CCP: "CCP_COMPLETED",
              TRIAGE: "TRANSFORMED",
              PACKED: "PACKAGED",
            } as const
          )[stage],
          collection: "test",
          action: "GATE",
          actorId: "user-1",
          payload: { stage, route: "PREMIUM_WHOLE" },
          prevHash: prev,
        },
        index + 1,
      );
      prev = event.hash;
      return event;
    });
    store.lot_events = seeded as unknown as TestRow[];

    const result = await lotLifecycleService.recordStageSafe({
      lotId,
      toStage: "SHIPPED",
      collection: "bon_expeditions",
      actorId: "user-1",
      route: "PREMIUM_WHOLE",
    });

    expect(result.skipped).toBe(false);
    const events = store.lot_events || [];
    expect(events.some((row) => row.event_type === "SHIPPED")).toBe(true);
  });
});
