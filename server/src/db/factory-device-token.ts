import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { factoryFromAccount, requireFactory } from "./factory-context.js";

type DeviceChannel = "weighbridge" | "ccp-sensors";
/** Routing credential only: each reading still requires the device's registered HMAC secret. */
export const issueFactoryDeviceToken = (channel: DeviceChannel, deviceCode: string) =>
  jwt.sign({ purpose: "factory_device_ingest", ...requireFactory(), channel, deviceCode }, env.jwtSecret, { expiresIn: "365d", algorithm: "HS256" });

export const resolveFactoryDeviceToken = (token: string, channel: DeviceChannel) => {
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] }) as any;
    const factory = factoryFromAccount(payload);
    return factory && payload.purpose === "factory_device_ingest" && payload.channel === channel && typeof payload.deviceCode === "string" && payload.deviceCode
      ? { ...factory, deviceCode: payload.deviceCode } : null;
  } catch { return null; }
};
