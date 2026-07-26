import { createHash, timingSafeEqual } from "node:crypto";
import { Injectable } from "@nestjs/common";

import { badRequest, notFound, unauthorized } from "../../core/app-error.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { publishRealtimeDbChange } from "../realtime/realtime.bus.js";
import { signReading } from "./weighbridge-signature.js";

export type WeighbridgeReadingInput = {
  readingId?: string;
  deviceCode?: string;
  capturedAt?: string;
  weightKg?: number;
  unit?: string;
  stable?: boolean;
  direction?: "IN" | "OUT" | "GROSS" | "TARE";
  rawFrame?: string | null;
  signature?: string;
};

const Devices = () => getCollectionModel("weighbridge_devices");
const Readings = () => getCollectionModel("weighbridge_readings");
const simulatorSecret = () =>
  process.env.WEIGHBRIDGE_SIMULATOR_SECRET || "royal-palm-simulator-dev";
const withoutSecret = (value: unknown) => {
  const row = sanitizeDocument(value) as Record<string, unknown>;
  const { secret: _secret, ...safe } = row;
  return safe;
};

const safeEqual = (left: string, right: string) => {
  try {
    const a = Buffer.from(left, "hex");
    const b = Buffer.from(right, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

@Injectable()
export class WeighbridgeService {
  async registerDevice(payload: Record<string, unknown>) {
    const deviceCode = String(payload.device_code || payload.deviceCode || "").trim();
    const secret = String(payload.secret || "").trim();
    if (!deviceCode || !secret) {
      throw badRequest("WEIGHBRIDGE_DEVICE_INVALID", "device_code and secret are required.");
    }
    const now = new Date().toISOString();
    const existing = sanitizeDocument(
      await Devices().findOne({ device_code: deviceCode }).lean().exec(),
    ) as Record<string, unknown> | null;
    if (existing) {
      await Devices().updateOne(
        { device_code: deviceCode },
        { $set: { ...payload, secret, updated_at: now } },
      ).exec();
      return withoutSecret(await Devices().findOne({ device_code: deviceCode }).lean().exec());
    }
    const doc = await prepareInsertDocument("weighbridge_devices", {
      ...payload,
      device_code: deviceCode,
      secret,
      status: payload.status || "ACTIVE",
      protocol: payload.protocol || "HTTP_PUSH",
      unit: payload.unit || "kg",
      calibration_valid_until: payload.calibration_valid_until || "2099-12-31T23:59:59.999Z",
    });
    await Devices().create([doc]);
    return withoutSecret(doc);
  }

  async ensureSimulator() {
    const existing = await Devices().findOne({ device_code: "SIM-01" }).lean().exec();
    if (existing) return sanitizeDocument(existing) as Record<string, unknown>;
    await this.registerDevice({
      device_code: "SIM-01",
      label: "W3 HTTP simulator",
      protocol: "SIMULATOR",
      secret: simulatorSecret(),
      status: "ACTIVE",
      max_capacity_kg: 100_000,
      resolution_kg: 0.001,
      calibration_valid_until: "2099-12-31T23:59:59.999Z",
    });
    return sanitizeDocument(
      await Devices().findOne({ device_code: "SIM-01" }).lean().exec(),
    ) as Record<string, unknown>;
  }

  async ingest(payload: WeighbridgeReadingInput, headerSignature?: string) {
    const readingId = String(payload.readingId || "").trim();
    const deviceCode = String(payload.deviceCode || "").trim();
    const capturedAt = String(payload.capturedAt || "").trim();
    const weightKg = Number(payload.weightKg);
    const unit = String(payload.unit || "kg").toLowerCase();
    const stable = payload.stable === true;
    const direction = String(payload.direction || "GROSS").toUpperCase() as "IN" | "OUT" | "GROSS" | "TARE";
    if (!readingId || !deviceCode || !capturedAt || !Number.isFinite(weightKg) || weightKg < 0) {
      throw badRequest("WEIGHBRIDGE_READING_INVALID", "readingId, deviceCode, capturedAt and a positive weightKg are required.");
    }

    let device = sanitizeDocument(
      await Devices().findOne({ device_code: deviceCode }).lean().exec(),
    ) as Record<string, unknown> | null;
    if (!device && deviceCode === "SIM-01") device = await this.ensureSimulator();
    if (!device) throw notFound("WEIGHBRIDGE_DEVICE_NOT_FOUND", "Unknown weighbridge device.");
    if (String(device.status || "") !== "ACTIVE") throw unauthorized("Weighbridge device is not active.");

    const normalized = { readingId, deviceCode, capturedAt, weightKg, unit, stable, direction };
    const signature = String(headerSignature || payload.signature || "").trim();
    const expected = signReading(normalized, String(device.secret || ""));
    if (!signature || !safeEqual(signature, expected)) throw unauthorized("Invalid weighbridge signature.");

    const capturedMs = new Date(capturedAt).getTime();
    if (!Number.isFinite(capturedMs) || Math.abs(Date.now() - capturedMs) > 24 * 60 * 60 * 1000) {
      throw badRequest("WEIGHBRIDGE_CLOCK_SKEW", "Reading timestamp is outside the accepted 24-hour window.");
    }
    if (!stable) throw badRequest("WEIGHBRIDGE_NOT_STABLE", "Only stable readings can be ingested.");
    if (Number(device.max_capacity_kg || 0) > 0 && weightKg > Number(device.max_capacity_kg)) {
      throw badRequest("WEIGHBRIDGE_OVER_CAPACITY", "Reading exceeds registered device capacity.");
    }

    const readingKey = createHash("sha256").update(`${device.id}:${readingId}`).digest("hex");
    const duplicate = sanitizeDocument(
      await Readings().findOne({ reading_key: readingKey }).lean().exec(),
    ) as Record<string, unknown> | null;
    if (duplicate) return { reading: duplicate, replayed: true };

    const receivedAt = new Date().toISOString();
    const row = await prepareInsertDocument("weighbridge_readings", {
      reading_key: readingKey,
      reading_id: readingId,
      device_id: device.id,
      device_code: deviceCode,
      captured_at: capturedAt,
      received_at: receivedAt,
      clock_skew_ms: Date.now() - capturedMs,
      weight_kg: weightKg,
      unit,
      direction,
      stable,
      raw_frame: payload.rawFrame || null,
      protocol: device.protocol || "HTTP_PUSH",
      signature,
      signature_alg: "HMAC-SHA256",
      signature_verified: true,
      calibration_valid_until: device.calibration_valid_until ?? null,
      consumed: false,
      consumed_by_weighing_id: null,
      lot_id: null,
    });
    try {
      await Readings().create([row]);
    } catch (error) {
      if (Number((error as { code?: unknown })?.code) !== 11000) throw error;
      const existing = sanitizeDocument(
        await Readings().findOne({ reading_key: readingKey }).lean().exec(),
      );
      return { reading: existing, replayed: true };
    }
    await Devices().updateOne(
      { id: device.id },
      { $set: { last_seen_at: receivedAt, updated_at: receivedAt } },
    ).exec();
    publishRealtimeDbChange({
      type: "weighbridge_reading_ingested",
      table: "weighbridge_readings",
      action: "INSERT",
      rowIds: [String(row.id)],
      rows: [sanitizeDocument(row)],
    });
    return { reading: sanitizeDocument(row), replayed: false };
  }

  async listReadings(unconsumedOnly = false) {
    return sanitizeDocument(
      await Readings()
        .find(unconsumedOnly ? { consumed: { $ne: true } } : {})
        .sort({ captured_at: -1 })
        .limit(200)
        .lean()
        .exec(),
    );
  }

  async listDevices() {
    const rows = sanitizeDocument(await Devices().find({}).sort({ device_code: 1 }).lean().exec()) as Array<Record<string, unknown>>;
    return rows.map(({ secret: _secret, ...row }) => row);
  }
}
