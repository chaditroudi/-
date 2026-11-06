/**
 * Copies operational collections from the control database into the Atlas-safe
 * factory database. The control database is only read. A failed copy drops the
 * new factory database it just created; it never drops or renames an existing one.
 *
 * Requires a backup directory produced by scripts/backup-db.mjs for the same database.
 *
 *   node --env-file=.env scripts/adopt-factory-database.mjs --i-know --confirm-db=<name> --backup=<dir>
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BSON, MongoClient } from "mongodb";
import { assertSafeDbTarget } from "./lib/db-target-guard.mjs";
import { factoryDatabaseName, legacyFactoryDatabaseName } from "../server-dist/db/factory-database-name.js";

const STAYS_IN_CONTROL = new Set([
  "auth_users",
  "auth_security_events",
  "sessions",
  "refresh_tokens",
  "factory_database_registry",
  "factory_migrations",
]);

const option = (argv, key) => argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3);

const digest = async (collection) => {
  const hash = createHash("sha256");
  let count = 0;
  for await (const row of collection.find({}).sort({ _id: 1 })) {
    hash.update(BSON.EJSON.stringify(row, { relaxed: false }));
    hash.update("\n");
    count += 1;
  }
  return { count, sha256: hash.digest("hex") };
};

const argv = process.argv.slice(2);
const controlDatabase = process.env.MONGODB_DB_NAME;
const backupDir = option(argv, "backup");
if (!controlDatabase || !backupDir) throw new Error("--backup and MONGODB_DB_NAME are required.");
assertSafeDbTarget({ uri: process.env.MONGODB_URI, dbName: controlDatabase, argv });

const manifest = JSON.parse(readFileSync(path.join(backupDir, "manifest.json"), "utf8"));
if (manifest.database !== controlDatabase) {
  throw new Error("The backup is not for this control database. Refusing to copy.");
}

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
let createdTarget = null;
try {
  const names = (await client.db().admin().listDatabases({ nameOnly: true })).databases.map((row) => row.name);
  const control = client.db(controlDatabase);
  const factories = await control.collection("auth_users").aggregate([
    { $match: { tenant_id: { $type: "string" }, factory_id: { $type: "string" } } },
    { $group: { _id: { tenant_id: "$tenant_id", factory_id: "$factory_id" } } },
  ]).toArray();
  if (factories.length !== 1) throw new Error(`Expected one factory in auth_users, found ${factories.length}.`);
  const factory = factories[0]._id;
  const targetName = factoryDatabaseName(controlDatabase, factory);
  const legacyName = legacyFactoryDatabaseName(controlDatabase, factory);
  if (names.includes(legacyName)) throw new Error("The long factory database already exists. It must be kept; this copy will not run.");
  if (Buffer.byteLength(targetName) > 38) throw new Error("Target name is still too long for this cluster.");

  const existing = await control.collection("factory_database_registry").findOne({
    control_database: controlDatabase,
    tenant_id: factory.tenant_id,
    factory_id: factory.factory_id,
  });
  if (existing) throw new Error(`Factory is already mapped to ${existing.database_name}.`);

  const target = client.db(targetName);
  const targetCollections = await target.listCollections({}, { nameOnly: true }).toArray();
  if (targetCollections.length > 0) throw new Error("Target factory database is not empty. Refusing to mix data into it.");
  createdTarget = targetName;

  const entries = (await control.listCollections({}, { nameOnly: true }).toArray())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith("system.") && !STAYS_IN_CONTROL.has(name))
    .sort();
  const copied = [];
  for (const name of entries) {
    const source = control.collection(name);
    const before = await digest(source);
    if (before.count === 0) continue;
    const destination = target.collection(name);
    let batch = [];
    for await (const row of source.find({}).sort({ _id: 1 })) {
      batch.push(row);
      if (batch.length >= 500) {
        await destination.insertMany(batch, { ordered: true });
        batch = [];
      }
    }
    if (batch.length) await destination.insertMany(batch, { ordered: true });
    const after = await digest(destination);
    if (after.count !== before.count || after.sha256 !== before.sha256) {
      throw new Error(`Verification failed for ${name}. Source was not changed.`);
    }
    copied.push({ name, count: after.count, sha256: after.sha256 });
  }

  await control.collection("factory_database_registry").insertOne({
    control_database: controlDatabase,
    tenant_id: factory.tenant_id,
    factory_id: factory.factory_id,
    database_name: targetName,
    reason: "copied-from-control",
    backup_dir: backupDir,
    created_at: new Date().toISOString(),
    collections: copied,
  });
  createdTarget = null;
  console.log(`Copied ${copied.length} collections into ${targetName}. Control database ${controlDatabase} was not modified except for the registry row.`);
  console.log(copied.map((row) => `${row.name} ${row.count}`).join("\n"));
} catch (error) {
  if (createdTarget) {
    await client.db(createdTarget).dropDatabase();
    console.error(`Dropped the unfinished factory database ${createdTarget}. The control database was left as it was.`);
  }
  throw error;
} finally {
  await client.close();
}
