/**
 * Proves a database can be recovered: backs it up, restores into a new throwaway database,
 * compares contents and indexes, shows a damaged backup and a non-empty target are refused,
 * reports the time taken, and removes its copy. Local databases only.
 *
 *   MONGODB_URI=... MONGODB_DB_NAME=<source> node scripts/restore-rehearsal.mjs
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { MongoClient } from "mongodb";

import {
  backupDatabase,
  compareSummaries,
  readManifest,
  rehearsalDatabaseName,
  restoreDatabase,
  summarizeDatabase,
} from "./lib/db-backup.mjs";
import { assertSafeDbTarget } from "./lib/db-target-guard.mjs";

const uri = process.env.MONGODB_URI;
const source = process.env.MONGODB_DB_NAME;
if (!source) throw new Error("MONGODB_DB_NAME is required.");
if (!assertSafeDbTarget({ uri, dbName: source, argv: [] }).isLocal) throw new Error("A rehearsal runs on local databases only.");

const target = rehearsalDatabaseName(source, Date.now());
const workDir = mkdtempSync(path.join(os.tmpdir(), "dhh-rehearsal-"));
const client = await MongoClient.connect(uri);
const seconds = (from) => ((performance.now() - from) / 1000).toFixed(2);

try {
  const db = client.db(source);
  const copy = client.db(target);

  let started = performance.now();
  const manifest = await backupDatabase(db, workDir);
  const backupSeconds = seconds(started);
  const documents = Object.values(manifest.collections).reduce((sum, row) => sum + row.count, 0);
  if (documents === 0) throw new Error(`Database ${source} is empty: a rehearsal on it proves nothing.`);

  started = performance.now();
  await restoreDatabase(copy, workDir);
  const restoreSeconds = seconds(started);

  const problems = compareSummaries(await summarizeDatabase(db), await summarizeDatabase(copy));
  if (problems.length > 0) throw new Error(`Restore does not match the source:\n${problems.join("\n")}`);

  await restoreDatabase(copy, workDir).then(
    () => { throw new Error("A non-empty database was accepted as a restore target."); },
    (error) => { if (!/not empty/.test(error.message)) throw error; },
  );

  const [name, entry] = Object.entries(readManifest(workDir).collections).find(([, row]) => row.count > 0);
  const damaged = path.join(workDir, entry.file);
  const original = readFileSync(damaged);
  writeFileSync(damaged, Buffer.concat([original.subarray(0, -1), Buffer.from([original.at(-1) ^ 0xff])]));
  await client.db(`${target}_x`).dropDatabase();
  await restoreDatabase(client.db(`${target}_x`), workDir).then(
    () => { throw new Error(`A damaged backup of ${name} was accepted.`); },
    (error) => { if (!/damaged/.test(error.message)) throw error; },
  );

  console.log(`Rehearsal passed on ${source}: ${Object.keys(manifest.collections).length} collections, ${documents} documents.`);
  console.log(`Backup ${backupSeconds} s, restore ${restoreSeconds} s. Contents and indexes match.`);
  console.log("A damaged backup and a non-empty target were both refused.");
} finally {
  await client.db(target).dropDatabase().catch(() => undefined);
  await client.db(`${target}_x`).dropDatabase().catch(() => undefined);
  await client.close();
  rmSync(workDir, { recursive: true, force: true });
}
