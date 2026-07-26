import { createHmac } from "node:crypto";

export type CcpKind = "FUMIGATION" | "COLD";

export type CanonicalCcpReadingInput = {
  readingId: string;
  deviceCode: string;
  capturedAt: string;
  kind: CcpKind;
  /** Fumigation chamber cycle id, or cold zone code. */
  targetRef: string;
  /** Canonical numeric payload (concentration or temperature). */
  value: number;
  /** Secondary metric (leak ppm or humidity). */
  secondary: number;
  /** Door locked (1/0) for fumigation; 1 for cold. */
  flag: 0 | 1;
};

export const canonicalCcpReading = (input: CanonicalCcpReadingInput) =>
  [
    input.deviceCode,
    input.readingId,
    input.capturedAt,
    input.kind,
    input.targetRef,
    Number(input.value).toFixed(3),
    Number(input.secondary).toFixed(3),
    String(input.flag),
  ].join(":");

export const signCcpReading = (input: CanonicalCcpReadingInput, secret: string) =>
  createHmac("sha256", secret).update(canonicalCcpReading(input)).digest("hex");
