/**
 * Read-only comparison of QC, reception and stock records. It issues find()
 * only and changes no lot. It ignores MONGODB_URI, so .env cannot aim it.
 *
 *   AUDIT_MONGODB_URI=<snapshot uri> AUDIT_DB_NAME=<snapshot db> AUDIT_REPORT=report.json \
 *     node scripts/audit-lot-reconciliation.mjs
 *
 * A remote target also needs --i-know and --confirm-db=<database name>. Use a
 * sanitized staging snapshot and a read-only database user; Atlas needs the
 * owner's explicit approval first.
 */
import { writeFileSync } from "node:fs";

import mongoose from "mongoose";

import { assertSafeDbTarget, describeHosts } from "./lib/db-target-guard.mjs";
import { reconcileLots } from "./lib/lot-reconciliation.mjs";

const uri = process.env.AUDIT_MONGODB_URI;
const dbName = process.env.AUDIT_DB_NAME;
if (!dbName) throw new Error("AUDIT_DB_NAME is required; this audit has no default target.");
assertSafeDbTarget({ uri, dbName });

const projection = {
  receptionLots: ["id", "reception_id", "lot_internal", "stock_status", "release_pin_verified"],
  stockLots: ["id", "lot_number", "reception_lot_id", "status", "current_quantity", "initial_quantity"],
  inspections: ["id", "reception_id", "reception_lot_id", "decision"],
  checkResults: ["inspection_id", "check_code", "severity", "result"],
  batches: ["reception_id", "qc_decision"],
};
const collections = {
  receptionLots: "reception_lots",
  stockLots: "stock_lots",
  inspections: "qc_inspections",
  checkResults: "qc_check_results",
  batches: "batches",
};

await mongoose.connect(uri, { dbName, readPreference: "secondaryPreferred", autoIndex: false, autoCreate: false });
const read = (key) => mongoose.connection.db.collection(collections[key])
  .find({}, { projection: { _id: 0, ...Object.fromEntries(projection[key].map((field) => [field, 1])) } })
  .toArray();

const input = Object.fromEntries(await Promise.all(Object.keys(collections).map(async (key) => [key, await read(key)])));
await mongoose.disconnect();

const report = { target: { hosts: describeHosts(uri), database: dbName }, ...reconcileLots(input) };
console.log(JSON.stringify({ target: report.target, totals: report.totals, by_code: report.by_code }, null, 2));
if (process.env.AUDIT_REPORT) writeFileSync(process.env.AUDIT_REPORT, JSON.stringify(report, null, 2));
