/**
 * Restores a backup into an empty database, after checking the backup is intact and
 * then checking the result against its manifest. It never merges into existing data.
 *
 *   MONGODB_URI=... MONGODB_DB_NAME=<empty database> node scripts/restore-db.mjs <backupDir>
 */
import { MongoClient } from "mongodb";

import { compareSummaries, readManifest, restoreDatabase, summarizeDatabase } from "./lib/db-backup.mjs";
import { assertSafeDbTarget } from "./lib/db-target-guard.mjs";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;
const backupDir = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
if (!dbName || !backupDir) throw new Error("Usage: MONGODB_URI=... MONGODB_DB_NAME=... node scripts/restore-db.mjs <backupDir>");
assertSafeDbTarget({ uri, dbName });

const manifest = readManifest(backupDir);
const client = await MongoClient.connect(uri);
try {
  const db = client.db(dbName);
  await restoreDatabase(db, backupDir, manifest);
  const problems = compareSummaries(manifest.collections, await summarizeDatabase(db));
  if (problems.length > 0) throw new Error(`Restore does not match the backup:\n${problems.join("\n")}`);
  console.log(`Restored ${Object.keys(manifest.collections).length} collections into ${dbName}, verified against the manifest.`);
} finally {
  await client.close();
}
