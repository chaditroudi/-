/**
 * Writes a verifiable backup of one database. It only reads the source.
 * The output holds password hashes and business records: keep it out of the repository.
 *
 *   MONGODB_URI=... MONGODB_DB_NAME=... node scripts/backup-db.mjs [outDir]
 */
import path from "node:path";

import { MongoClient } from "mongodb";

import { backupDatabase } from "./lib/db-backup.mjs";
import { assertSafeDbTarget } from "./lib/db-target-guard.mjs";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;
if (!dbName) throw new Error("MONGODB_DB_NAME is required.");
assertSafeDbTarget({ uri, dbName });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = process.argv.slice(2).find((arg) => !arg.startsWith("--")) || path.join("backups", `${dbName}-${stamp}`);

const client = await MongoClient.connect(uri);
try {
  const manifest = await backupDatabase(client.db(dbName), outDir);
  const rows = Object.values(manifest.collections);
  const documents = rows.reduce((sum, row) => sum + row.count, 0);
  console.log(`Backup of ${dbName}: ${rows.length} collections, ${documents} documents, in ${outDir}`);
} finally {
  await client.close();
}
