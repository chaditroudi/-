// Attach Gate 3 factory membership to seeded @test.local actors (and optional admin).
import mongoose from "mongoose";
import { assertSafeDbTarget } from "./lib/db-target-guard.mjs";

const mongoUri = process.env.MONGODB_URI;
const mongoDbName = process.env.MONGODB_DB_NAME || "date_harvest_hub";
assertSafeDbTarget({ uri: mongoUri, dbName: mongoDbName });

const TENANT_ID = String(process.env.TEST_ACTOR_TENANT_ID || process.env.INITIAL_ADMIN_TENANT_ID || "demo-company").trim();
const FACTORY_ID = String(process.env.TEST_ACTOR_FACTORY_ID || process.env.INITIAL_ADMIN_FACTORY_ID || "demo-site").trim();
if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(TENANT_ID) || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(FACTORY_ID)) {
  throw new Error("Invalid TEST_ACTOR_TENANT_ID / TEST_ACTOR_FACTORY_ID");
}

await mongoose.connect(mongoUri, { dbName: mongoDbName });
const now = new Date().toISOString();
const actors = await mongoose.connection.collection("auth_users").updateMany(
  { email: /@test\.local$/i },
  { $set: { tenant_id: TENANT_ID, factory_id: FACTORY_ID, updated_at: now } },
);

const adminEmail = String(process.env.INITIAL_ADMIN_EMAIL || "").trim().toLowerCase();
let admin = { matchedCount: 0, modifiedCount: 0 };
if (adminEmail) {
  admin = await mongoose.connection.collection("auth_users").updateOne(
    { email: adminEmail },
    { $set: { tenant_id: TENANT_ID, factory_id: FACTORY_ID, updated_at: now } },
  );
}

const sample = await mongoose.connection.collection("auth_users").findOne({ email: "directeur.usine@test.local" });
console.log(JSON.stringify({
  factory: { tenant_id: TENANT_ID, factory_id: FACTORY_ID },
  actors: { matched: actors.matchedCount, modified: actors.modifiedCount },
  admin: { email: adminEmail || null, matched: admin.matchedCount, modified: admin.modifiedCount },
  sample: { email: sample?.email, tenant_id: sample?.tenant_id, factory_id: sample?.factory_id },
}, null, 2));

await mongoose.disconnect();
