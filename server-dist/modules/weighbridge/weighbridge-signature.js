import { createHmac } from "node:crypto";
export const canonicalReading = (input) => [
    input.deviceCode,
    input.readingId,
    input.capturedAt,
    Number(input.weightKg).toFixed(3),
    input.unit,
    input.stable ? "1" : "0",
    input.direction,
].join(":");
export const signReading = (input, secret) => createHmac("sha256", secret).update(canonicalReading(input)).digest("hex");
