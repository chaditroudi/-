/**
 * Backfill mass_balance_variance_pct on closed Wave B process records that
 * predate the reconcile-on-close path. Does not flip TRUST_MASS_BALANCE_GATE.
 *
 *   npm run backfill:mass-balance
 *   DRY_RUN=1 npm run backfill:mass-balance
 */
import mongoose from "mongoose";

const mongoUri = process.env.MONGODB_URI;
const mongoDbName = process.env.MONGODB_DB_NAME || "date_harvest_hub";
const dryRun = String(process.env.DRY_RUN || "").toLowerCase() === "1"
  || String(process.env.DRY_RUN || "").toLowerCase() === "true";
const tolerancePct = Number(process.env.TRUST_MASS_BALANCE_TOLERANCE_PCT || 2);

if (!mongoUri) {
  console.error("MONGODB_URI is required");
  process.exit(1);
}

const toKg = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const compute = (inputKg, outputsKg, wasteKg = 0) => {
  const input = toKg(inputKg);
  const output = (outputsKg || []).reduce((sum, v) => sum + toKg(v), 0);
  const waste = toKg(wasteKg);
  const accounted = output + waste;
  const varianceKg = Number((accounted - input).toFixed(3));
  const variancePct =
    input > 0 ? Number(((varianceKg / input) * 100).toFixed(2)) : accounted === 0 ? 0 : 100;
  return { variancePct, varianceKg, inputKg: input, accountedKg: accounted };
};

await mongoose.connect(mongoUri, { dbName: mongoDbName });
const db = mongoose.connection.db;

const stats = {
  triage: { scanned: 0, updated: 0 },
  packaging: { scanned: 0, updated: 0 },
  cleaning: { scanned: 0, updated: 0 },
  hydration: { scanned: 0, updated: 0 },
  production: { scanned: 0, updated: 0 },
};

const triage = await db.collection("triage_sessions").find({
  status: "TERMINE",
  $or: [
    { mass_balance_variance_pct: null },
    { mass_balance_variance_pct: { $exists: false } },
  ],
}).toArray();
stats.triage.scanned = triage.length;
for (const row of triage) {
  const balance = compute(row.parent_weight_kg, [
    row.weight_extra_kg,
    row.weight_cat1_kg,
    row.weight_cat2_kg,
    row.weight_reject_kg,
  ]);
  if (!dryRun) {
    await db.collection("triage_sessions").updateOne(
      { _id: row._id },
      { $set: { mass_balance_variance_pct: balance.variancePct, updated_at: new Date().toISOString() } },
    );
  }
  stats.triage.updated += 1;
}

const packaging = await db.collection("packaging_orders").find({
  status: "TERMINE",
  $or: [
    { mass_balance_variance_pct: null },
    { mass_balance_variance_pct: { $exists: false } },
  ],
}).toArray();
stats.packaging.scanned = packaging.length;
for (const row of packaging) {
  const balance = compute(row.source_weight_kg, [row.produced_kg], row.waste_kg);
  if (!dryRun) {
    await db.collection("packaging_orders").updateOne(
      { _id: row._id },
      { $set: { mass_balance_variance_pct: balance.variancePct, updated_at: new Date().toISOString() } },
    );
  }
  stats.packaging.updated += 1;
}

const cleaning = await db.collection("cleaning_cycles").find({
  status: "TERMINE",
  $or: [
    { mass_balance_variance_pct: null },
    { mass_balance_variance_pct: { $exists: false } },
  ],
}).toArray();
stats.cleaning.scanned = cleaning.length;
for (const row of cleaning) {
  const input = toKg(row.weight_in_kg ?? row.input_weight_kg);
  const output = toKg(row.weight_out_kg ?? row.output_weight_kg);
  const waste = toKg(row.waste_weight_kg ?? row.waste_kg);
  if (input <= 0) continue;
  const balance = compute(input, [output], waste);
  if (!dryRun) {
    await db.collection("cleaning_cycles").updateOne(
      { _id: row._id },
      { $set: { mass_balance_variance_pct: balance.variancePct, updated_at: new Date().toISOString() } },
    );
  }
  stats.cleaning.updated += 1;
}

const hydration = await db.collection("hydration_cycles").find({
  status: { $in: ["TERMINE", "NON_CONFORME"] },
  $or: [
    { mass_balance_variance_pct: null },
    { mass_balance_variance_pct: { $exists: false } },
  ],
}).toArray();
stats.hydration.scanned = hydration.length;
for (const row of hydration) {
  const input = toKg(row.weight_in_kg) + toKg(row.steam_injected_kg);
  const output = toKg(row.weight_out_kg);
  const waste = toKg(row.waste_kg);
  if (input <= 0) continue;
  const balance = compute(input, [output], waste);
  if (!dryRun) {
    await db.collection("hydration_cycles").updateOne(
      { _id: row._id },
      { $set: { mass_balance_variance_pct: balance.variancePct, updated_at: new Date().toISOString() } },
    );
  }
  stats.hydration.updated += 1;
}

const production = await db.collection("production_orders").find({
  status: "COMPLETED",
  $or: [
    { mass_balance_variance_pct: null },
    { mass_balance_variance_pct: { $exists: false } },
  ],
}).toArray();
stats.production.scanned = production.length;
for (const row of production) {
  const allocations = await db.collection("production_lot_allocations")
    .find({ production_order_id: row.id })
    .toArray();
  const input = allocations.reduce((sum, a) => sum + toKg(a.allocated_kg), 0);
  if (input <= 0) continue;
  const balance = compute(input, [row.actual_output_kg], row.waste_kg);
  if (!dryRun) {
    await db.collection("production_orders").updateOne(
      { _id: row._id },
      { $set: { mass_balance_variance_pct: balance.variancePct, updated_at: new Date().toISOString() } },
    );
  }
  stats.production.updated += 1;
}

console.log("\nMass-balance variance backfill");
console.log(dryRun ? "  mode: DRY_RUN (no writes)" : "  mode: WRITE");
console.log(`  tolerance reference: ±${tolerancePct}% (informational — gate unchanged)`);
console.log("  note: keep TRUST_MASS_BALANCE_GATE=warn until ops flips to enforce");
for (const [key, value] of Object.entries(stats)) {
  console.log(`  ${key}: scanned=${value.scanned} updated=${value.updated}`);
}

await mongoose.disconnect();
