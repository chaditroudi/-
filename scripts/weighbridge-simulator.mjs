import { createHmac, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const apiBase = (process.env.API_URL || "http://localhost:3001/api").replace(/\/$/, "");
const secret = process.env.WEIGHBRIDGE_SIMULATOR_SECRET || "royal-palm-simulator-dev";
const spoolPath = path.resolve(process.cwd(), ".w3-weighbridge-spool.json");

const readSpool = async () => {
  if (!existsSync(spoolPath)) return [];
  try {
    return JSON.parse(await readFile(spoolPath, "utf8"));
  } catch {
    return [];
  }
};

const writeSpool = (rows) => writeFile(spoolPath, JSON.stringify(rows, null, 2));
const canonical = (row) => [
  row.deviceCode,
  row.readingId,
  row.capturedAt,
  Number(row.weightKg).toFixed(3),
  row.unit,
  row.stable ? "1" : "0",
  row.direction,
].join(":");

const push = async (row) => {
  const signature = createHmac("sha256", secret).update(canonical(row)).digest("hex");
  const response = await fetch(`${apiBase}/weighbridge/readings`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-weighbridge-signature": signature,
    },
    body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json();
};

const flush = async () => {
  const pending = await readSpool();
  const failed = [];
  for (const row of pending) {
    try {
      await push(row);
      console.log(`Flushed ${row.readingId}`);
    } catch (error) {
      failed.push(row);
      console.error(`Still queued ${row.readingId}: ${error.message}`);
    }
  }
  await writeSpool(failed);
};

const main = async () => {
  await flush();
  const weightKg = Number(process.argv[2] || process.env.WEIGHT_KG || 1500);
  const direction = String(process.argv[3] || process.env.WEIGHT_DIRECTION || "GROSS").toUpperCase();
  const row = {
    readingId: randomUUID(),
    deviceCode: "SIM-01",
    capturedAt: new Date().toISOString(),
    weightKg,
    unit: "kg",
    stable: true,
    direction,
    rawFrame: `SIM,${weightKg.toFixed(3)},kg,STABLE`,
  };
  try {
    const response = await push(row);
    console.log(JSON.stringify(response, null, 2));
  } catch (error) {
    const pending = await readSpool();
    pending.push(row);
    await writeSpool(pending);
    console.error(`API unavailable; reading spooled: ${error.message}`);
    process.exitCode = 1;
  }
};

await main();
