import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryModel, type TestRow } from "../../test/in-memory-collection.js";
import { signReading } from "./weighbridge-signature.js";
import { WeighbridgeService } from "./weighbridge.service.js";

const store: Record<string, TestRow[]> = {};

vi.mock("../../db/dynamic-model.js", () => ({
  sanitizeDocument: <T>(value: T) => value,
  getCollectionModel: (collection: string) => createInMemoryModel(collection, store),
}));

vi.mock("../../db/defaults.js", () => ({
  prepareInsertDocument: async (collection: string, value: TestRow) => ({
    id: `${collection}-${(store[collection]?.length || 0) + 1}`,
    ...value,
  }),
}));

vi.mock("../realtime/realtime.bus.js", () => ({ publishRealtimeDbChange: vi.fn() }));

const service = new WeighbridgeService();

const reading = (deviceCode: string) => ({
  readingId: "R-1",
  deviceCode,
  capturedAt: new Date().toISOString(),
  weightKg: 1250,
  unit: "kg",
  stable: true,
  direction: "GROSS" as const,
});

const realDevice = { device_code: "WB-01", secret: "real-secret", status: "ACTIVE", protocol: "HTTP_PUSH", id: "d-1" };

describe("weighbridge ingest", () => {
  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    vi.stubEnv("NODE_ENV", "production");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rejects a reading signed with the wrong secret", async () => {
    store.weighbridge_devices = [realDevice];
    const payload = reading("WB-01");
    await expect(service.ingest(payload, signReading(payload, "guessed-secret")))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects a reading with no signature", async () => {
    store.weighbridge_devices = [realDevice];
    await expect(service.ingest(reading("WB-01"))).rejects.toMatchObject({ statusCode: 401 });
  });

  it("does not create the simulator in production", async () => {
    const payload = reading("SIM-01");
    await expect(service.ingest(payload, signReading(payload, "any")))
      .rejects.toMatchObject({ code: "WEIGHBRIDGE_DEVICE_NOT_FOUND" });
    expect(store.weighbridge_devices || []).toHaveLength(0);
  });

  it("refuses a simulator row left in a production database, even with its old secret", async () => {
    store.weighbridge_devices = [{ ...realDevice, device_code: "SIM-01", protocol: "SIMULATOR", secret: "public-secret" }];
    const payload = reading("SIM-01");
    await expect(service.ingest(payload, signReading(payload, "public-secret")))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it("never returns a device secret from the list", async () => {
    store.weighbridge_devices = [realDevice];
    const devices = await service.listDevices();
    expect(devices[0]).not.toHaveProperty("secret");
  });
});
