import { createHash, timingSafeEqual } from "node:crypto";
import { Injectable } from "@nestjs/common";

import { badRequest, notFound, unauthorized } from "../../core/app-error.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { Phase2Service } from "../phase2/phase2.service.js";
import { StorageService } from "../storage/storage.service.js";
import { signCcpReading, type CcpKind } from "./ccp-signature.js";

export type CcpReadingInput = {
  readingId?: string;
  deviceCode?: string;
  capturedAt?: string;
  kind?: CcpKind;
  cycleId?: string;
  zoneCode?: string;
  concentrationAvgGm3?: number;
  externalLeakPpm?: number;
  doorLocked?: boolean;
  temperatureC?: number;
  humidityPercent?: number;
  signature?: string;
};

const Devices = () => getCollectionModel("ccp_sensor_devices");
const simulatorSecret = () =>
  process.env.CCP_SIMULATOR_SECRET || "royal-palm-ccp-simulator-dev";

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
export class CcpSensorsService {
  constructor(
    private readonly phase2: Phase2Service,
    private readonly storage: StorageService,
  ) {}

  async registerDevice(payload: Record<string, unknown>) {
    const deviceCode = String(payload.device_code || payload.deviceCode || "").trim();
    const secret = String(payload.secret || "").trim();
    const kind = String(payload.kind || "").toUpperCase() as CcpKind;
    if (!deviceCode || !secret || !["FUMIGATION", "COLD"].includes(kind)) {
      throw badRequest("CCP_DEVICE_INVALID", "device_code, secret, and kind (FUMIGATION|COLD) are required.");
    }
    const now = new Date().toISOString();
    const existing = sanitizeDocument(
      await Devices().findOne({ device_code: deviceCode }).lean().exec(),
    ) as Record<string, unknown> | null;
    if (existing) {
      await Devices().updateOne(
        { device_code: deviceCode },
        {
          $set: {
            ...payload,
            device_code: deviceCode,
            secret,
            kind,
            updated_at: now,
          },
        },
      ).exec();
      return withoutSecret(await Devices().findOne({ device_code: deviceCode }).lean().exec());
    }
    const doc = await prepareInsertDocument("ccp_sensor_devices", {
      ...payload,
      device_code: deviceCode,
      secret,
      kind,
      status: payload.status || "ACTIVE",
      protocol: payload.protocol || "HTTP_PUSH",
      zone_code: payload.zone_code || payload.zoneCode || null,
      calibration_valid_until: payload.calibration_valid_until || "2099-12-31T23:59:59.999Z",
    });
    await Devices().create([doc]);
    return withoutSecret(doc);
  }

  async ensureSimulators() {
    const fum = await Devices().findOne({ device_code: "CCP-FUM-SIM-01" }).lean().exec();
    if (!fum) {
      await this.registerDevice({
        device_code: "CCP-FUM-SIM-01",
        label: "Wave A fumigation simulator",
        kind: "FUMIGATION",
        protocol: "SIMULATOR",
        secret: simulatorSecret(),
        status: "ACTIVE",
      });
    }
    const cold = await Devices().findOne({ device_code: "CCP-COLD-SIM-01" }).lean().exec();
    if (!cold) {
      await this.registerDevice({
        device_code: "CCP-COLD-SIM-01",
        label: "Wave A cold-chain simulator",
        kind: "COLD",
        protocol: "SIMULATOR",
        secret: simulatorSecret(),
        status: "ACTIVE",
        zone_code: null,
      });
    }
  }

  async ingest(payload: CcpReadingInput, headerSignature?: string) {
    const readingId = String(payload.readingId || "").trim();
    const deviceCode = String(payload.deviceCode || "").trim();
    const capturedAt = String(payload.capturedAt || "").trim();
    if (!readingId || !deviceCode || !capturedAt) {
      throw badRequest("CCP_READING_INVALID", "readingId, deviceCode, and capturedAt are required.");
    }

    if (deviceCode === "CCP-FUM-SIM-01" || deviceCode === "CCP-COLD-SIM-01") {
      await this.ensureSimulators();
    }

    const device = sanitizeDocument(
      await Devices().findOne({ device_code: deviceCode }).lean().exec(),
    ) as Record<string, unknown> | null;
    if (!device) throw notFound("CCP_DEVICE_NOT_FOUND", "Unknown CCP sensor device.");
    if (String(device.status || "") !== "ACTIVE") throw unauthorized("CCP sensor device is not active.");

    const kind = String(payload.kind || device.kind || "").toUpperCase() as CcpKind;
    if (kind !== "FUMIGATION" && kind !== "COLD") {
      throw badRequest("CCP_KIND_INVALID", "kind must be FUMIGATION or COLD.");
    }
    if (String(device.kind) !== kind) {
      throw badRequest("CCP_KIND_MISMATCH", `Device ${deviceCode} is registered as ${device.kind}.`);
    }

    const cycleId = String(payload.cycleId || "").trim();
    const zoneCode = String(payload.zoneCode || device.zone_code || "").trim().toUpperCase();
    const concentration = Number(payload.concentrationAvgGm3);
    const leak = Number(payload.externalLeakPpm ?? 0);
    const doorLocked = payload.doorLocked !== false;
    const temperatureC = Number(payload.temperatureC);
    const humidityPercent = Number(payload.humidityPercent ?? 0);

    const targetRef = kind === "FUMIGATION" ? cycleId : zoneCode;
    const value = kind === "FUMIGATION" ? concentration : temperatureC;
    const secondary = kind === "FUMIGATION" ? leak : humidityPercent;
    const flag: 0 | 1 = kind === "FUMIGATION" ? (doorLocked ? 1 : 0) : 1;

    if (!targetRef || !Number.isFinite(value)) {
      throw badRequest(
        "CCP_READING_INVALID",
        kind === "FUMIGATION"
          ? "cycleId and concentrationAvgGm3 are required."
          : "zoneCode and temperatureC are required.",
      );
    }

    const normalized = {
      readingId,
      deviceCode,
      capturedAt,
      kind,
      targetRef,
      value,
      secondary: Number.isFinite(secondary) ? secondary : 0,
      flag,
    };
    const signature = String(headerSignature || payload.signature || "").trim();
    const expected = signCcpReading(normalized, String(device.secret || ""));
    if (!signature || !safeEqual(signature, expected)) {
      throw unauthorized("Invalid CCP sensor signature.");
    }

    const capturedMs = new Date(capturedAt).getTime();
    if (!Number.isFinite(capturedMs) || Math.abs(Date.now() - capturedMs) > 24 * 60 * 60 * 1000) {
      throw badRequest("CCP_CLOCK_SKEW", "Reading timestamp is outside the accepted 24-hour window.");
    }

    const readingKey = createHash("sha256").update(`${device.id}:${readingId}`).digest("hex");
    const collection = kind === "FUMIGATION" ? "fumigation_sensor_readings" : "storage_condition_readings";
    const existing = sanitizeDocument(
      await getCollectionModel(collection).findOne({ reading_key: readingKey }).lean().exec(),
    );
    if (existing) return { reading: existing, kind, replayed: true };

    const receivedAt = new Date().toISOString();
    await Devices().updateOne(
      { id: device.id },
      { $set: { last_seen_at: receivedAt, updated_at: receivedAt } },
    ).exec();

    if (kind === "FUMIGATION") {
      const result = await this.phase2.addFumigationSensorReading({
        cycle_id: cycleId,
        read_at: capturedAt,
        concentration_avg_gm3: concentration,
        external_leak_ppm: Number.isFinite(leak) ? leak : 0,
        door_locked: doorLocked,
        created_by: `device:${deviceCode}`,
        source: "DEVICE",
        signature_verified: true,
        reading_key: readingKey,
        device_code: deviceCode,
      });
      return { reading: result.data, kind, replayed: false, notifications: result.notifications };
    }

    const result = await this.storage.recordReading(
      {
        zoneCode,
        temperatureC,
        humidityPercent: Number.isFinite(humidityPercent) ? humidityPercent : null,
        readingAt: capturedAt,
        sensorRef: deviceCode,
        recordedBy: `device:${deviceCode}`,
        source: "DEVICE",
        signature_verified: true,
        reading_key: readingKey,
        device_code: deviceCode,
      },
      null,
    );
    return { reading: (result as { reading?: unknown }).reading || result, kind, replayed: false, coldChain: (result as { coldChain?: unknown }).coldChain };
  }

  async listDevices() {
    const rows = sanitizeDocument(
      await Devices().find({}).sort({ device_code: 1 }).lean().exec(),
    ) as Array<Record<string, unknown>>;
    return rows.map(({ secret: _secret, ...row }) => row);
  }
}
