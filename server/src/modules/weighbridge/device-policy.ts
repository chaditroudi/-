import { unauthorized } from "../../core/app-error.js";

const isProduction = () => process.env.NODE_ENV === "production";

/** Simulators exist only outside production, and only with a locally chosen secret. */
export const simulatorSecret = (envName: string) => {
  if (isProduction()) return null;
  return process.env[envName]?.trim() || null;
};

/** A simulator row can outlive its creation, and its old secret is public. */
export const assertDeviceAllowed = (device: Record<string, unknown>) => {
  if (isProduction() && device.protocol === "SIMULATOR") {
    throw unauthorized("Simulator devices are not accepted in production.");
  }
};
