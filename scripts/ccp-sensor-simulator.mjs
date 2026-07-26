/**
 * Wave A CCP sensor HMAC simulator (fumigation or cold).
 *
 *   npm run ccp:sim -- fum <cycleId> [concentration]
 *   npm run ccp:sim -- cold <zoneCode> [temperatureC]
 */
import { createHmac, randomUUID } from "node:crypto";

const apiBase = (process.env.API_URL || `http://127.0.0.1:${process.env.PORT || 4000}/api`).replace(/\/$/, "");
const secret = process.env.CCP_SIMULATOR_SECRET || "royal-palm-ccp-simulator-dev";

const canonical = (row) =>
  [
    row.deviceCode,
    row.readingId,
    row.capturedAt,
    row.kind,
    row.targetRef,
    Number(row.value).toFixed(3),
    Number(row.secondary).toFixed(3),
    String(row.flag),
  ].join(":");

const push = async (body, targetRef, value, secondary, flag) => {
  const signature = createHmac("sha256", secret)
    .update(
      canonical({
        deviceCode: body.deviceCode,
        readingId: body.readingId,
        capturedAt: body.capturedAt,
        kind: body.kind,
        targetRef,
        value,
        secondary,
        flag,
      }),
    )
    .digest("hex");
  const response = await fetch(`${apiBase}/ccp-sensors/readings`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ccp-signature": signature,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
};

const main = async () => {
  const mode = String(process.argv[2] || "fum").toLowerCase();
  if (mode === "fum" || mode === "fumigation") {
    const cycleId = String(process.argv[3] || "").trim();
    if (!cycleId) {
      console.error("Usage: npm run ccp:sim -- fum <cycleId> [concentration]");
      process.exit(1);
    }
    const concentration = Number(process.argv[4] || 1.1);
    const body = {
      readingId: randomUUID(),
      deviceCode: "CCP-FUM-SIM-01",
      capturedAt: new Date().toISOString(),
      kind: "FUMIGATION",
      cycleId,
      concentrationAvgGm3: concentration,
      externalLeakPpm: 0,
      doorLocked: true,
    };
    const result = await push(body, cycleId, concentration, 0, 1);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (mode === "cold") {
    const zoneCode = String(process.argv[3] || "").trim().toUpperCase();
    if (!zoneCode) {
      console.error("Usage: npm run ccp:sim -- cold <zoneCode> [temperatureC]");
      process.exit(1);
    }
    const temperatureC = Number(process.argv[4] || 4);
    const humidityPercent = Number(process.argv[5] || 55);
    const body = {
      readingId: randomUUID(),
      deviceCode: "CCP-COLD-SIM-01",
      capturedAt: new Date().toISOString(),
      kind: "COLD",
      zoneCode,
      temperatureC,
      humidityPercent,
    };
    const result = await push(body, zoneCode, temperatureC, humidityPercent, 1);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.error("Usage: npm run ccp:sim -- fum <cycleId> | cold <zoneCode>");
  process.exit(1);
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
