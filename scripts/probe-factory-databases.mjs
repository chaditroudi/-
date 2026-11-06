/** Read-only. Prints database names and a few counts. Never prints the connection string. */
import { createHash } from "node:crypto";
import mongoose from "mongoose";

const control = process.env.MONGODB_DB_NAME;
if (!process.env.MONGODB_URI || !control) throw new Error("MONGODB_URI and MONGODB_DB_NAME are required.");

const digest = (tenant, factory) =>
  createHash("sha256").update(JSON.stringify([control, tenant, factory])).digest("hex");

await mongoose.connect(process.env.MONGODB_URI, {
  dbName: control,
  serverSelectionTimeoutMS: 15000,
  autoIndex: false,
  autoCreate: false,
});

const listed = await mongoose.connection.db.admin().listDatabases();
const names = listed.databases.map((row) => row.name).sort();
console.log("DATABASES");
for (const row of listed.databases) console.log(`${row.name}\t${row.sizeOnDisk}`);

const factories = await mongoose.connection.db.collection("auth_users").aggregate([
  { $match: { tenant_id: { $type: "string" }, factory_id: { $type: "string" } } },
  { $group: { _id: { tenant_id: "$tenant_id", factory_id: "$factory_id" }, accounts: { $sum: 1 } } },
]).toArray();
console.log("FACTORIES");
for (const row of factories) {
  const hex = digest(row._id.tenant_id, row._id.factory_id);
  const legacy = `dhh_f_${hex.slice(0, 40)}`;
  const current = `dhh_f_${hex.slice(0, 32)}`;
  console.log([
    row._id.tenant_id,
    row._id.factory_id,
    `accounts=${row.accounts}`,
    `legacyBytes=${Buffer.byteLength(legacy)}`,
    `legacyExists=${names.includes(legacy)}`,
    `currentBytes=${Buffer.byteLength(current)}`,
    `currentExists=${names.includes(current)}`,
    legacy,
    current,
  ].join("\t"));
}

for (const collection of ["stock_lots", "receptions_v2", "factory_database_registry"]) {
  const count = await mongoose.connection.db.collection(collection).estimatedDocumentCount();
  console.log(`CONTROL ${collection} ${count}`);
}
await mongoose.disconnect();
