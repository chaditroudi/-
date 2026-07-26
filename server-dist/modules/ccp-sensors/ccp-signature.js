import { createHmac } from "node:crypto";
export const canonicalCcpReading = (input) => [
    input.deviceCode,
    input.readingId,
    input.capturedAt,
    input.kind,
    input.targetRef,
    Number(input.value).toFixed(3),
    Number(input.secondary).toFixed(3),
    String(input.flag),
].join(":");
export const signCcpReading = (input, secret) => createHmac("sha256", secret).update(canonicalCcpReading(input)).digest("hex");
