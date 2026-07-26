import { createHmac } from "node:crypto";

export type CanonicalReadingInput = {
  readingId: string;
  deviceCode: string;
  capturedAt: string;
  weightKg: number;
  unit: string;
  stable: boolean;
  direction: "IN" | "OUT" | "GROSS" | "TARE";
};

export const canonicalReading = (input: CanonicalReadingInput) => [
  input.deviceCode,
  input.readingId,
  input.capturedAt,
  Number(input.weightKg).toFixed(3),
  input.unit,
  input.stable ? "1" : "0",
  input.direction,
].join(":");

export const signReading = (input: CanonicalReadingInput, secret: string) =>
  createHmac("sha256", secret).update(canonicalReading(input)).digest("hex");
