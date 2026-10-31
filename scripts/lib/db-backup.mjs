/**
 * Logical backup of a MongoDB database with the driver, so it needs no extra binaries
 * and can be checked: one gzipped EJSON file per collection, plus a manifest with counts,
 * indexes and a content hash. A backup that was never restored proves nothing, which is
 * what restore-rehearsal.mjs is for.
 */
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";

import { BSON } from "mongodb";

const { EJSON } = BSON;

export const MANIFEST_VERSION = 1;
const INSERT_BATCH = 500;

/** Field order must not change the result, so restored documents can be compared. */
export const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
};

export const hashDocuments = (serialized) => {
  // Sorted, so the hash ignores the natural order a restore may change.
  const hash = createHash("sha256");
  for (const line of [...serialized].sort()) hash.update(line).update("\n");
  return hash.digest("hex");
};

const serialize = (doc) => JSON.stringify(canonicalize(EJSON.serialize(doc, { relaxed: false })));

const indexSpec = ({ v: _v, ns: _ns, ...spec }) => spec;

const listUserCollections = async (db) =>
  (await db.listCollections({ type: "collection" }, { nameOnly: true }).toArray())
    .map((row) => row.name)
    .filter((name) => !name.startsWith("system."))
    .sort();

export const summarizeCollection = async (collection) => {
  const lines = [];
  for await (const doc of collection.find({}, { sort: { _id: 1 } })) lines.push(serialize(doc));
  const indexes = (await collection.indexes()).map(indexSpec).sort((a, b) => a.name.localeCompare(b.name));
  return { count: lines.length, hash: hashDocuments(lines), indexes };
};

export const summarizeDatabase = async (db) => {
  const collections = {};
  for (const name of await listUserCollections(db)) collections[name] = await summarizeCollection(db.collection(name));
  return collections;
};

export const compareSummaries = (expected, actual) => {
  const problems = [];
  const names = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const name of [...names].sort()) {
    const want = expected[name];
    const got = actual[name];
    if (!want) problems.push(`${name}: not in the backup`);
    else if (!got) problems.push(`${name}: missing after restore`);
    else {
      if (want.count !== got.count) problems.push(`${name}: ${want.count} documents became ${got.count}`);
      else if (want.hash !== got.hash) problems.push(`${name}: contents differ`);
      if (JSON.stringify(want.indexes) !== JSON.stringify(got.indexes)) problems.push(`${name}: indexes differ`);
    }
  }
  return problems;
};

const sha256File = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

export const backupDatabase = async (db, outDir) => {
  mkdirSync(outDir, { recursive: true });
  const collections = {};
  for (const name of await listUserCollections(db)) {
    const file = `${encodeURIComponent(name)}.ejson.gz`;
    const full = path.join(outDir, file);
    const lines = [];
    const source = Readable.from((async function* read() {
      for await (const doc of db.collection(name).find({}, { sort: { _id: 1 } })) {
        const line = serialize(doc);
        lines.push(line);
        yield `${line}\n`;
      }
    })());
    await pipeline(source, createGzip(), createWriteStream(full));
    const indexes = (await db.collection(name).indexes()).map(indexSpec).sort((a, b) => a.name.localeCompare(b.name));
    collections[name] = { file, count: lines.length, hash: hashDocuments(lines), indexes, bytes: statSync(full).size, sha256: sha256File(full) };
  }
  const manifest = { version: MANIFEST_VERSION, database: db.databaseName, created_at: new Date().toISOString(), collections };
  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
};

export const readManifest = (dir) => {
  const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"));
  if (manifest.version !== MANIFEST_VERSION) throw new Error(`Unsupported backup version ${manifest.version}.`);
  return manifest;
};

/** Refuses a damaged backup before anything is written. */
export const verifyBackupFiles = (dir, manifest) => {
  for (const [name, entry] of Object.entries(manifest.collections)) {
    const actual = sha256File(path.join(dir, entry.file));
    if (actual !== entry.sha256) throw new Error(`Backup file for ${name} is damaged.`);
  }
};

const readDocuments = async function* read(file) {
  const lines = createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const line of lines) {
    if (line) yield EJSON.parse(line, { relaxed: false });
  }
};

/** Restores only into an empty database: it never merges into or overwrites one. */
export const restoreDatabase = async (db, dir, manifest = readManifest(dir)) => {
  verifyBackupFiles(dir, manifest);
  const existing = await listUserCollections(db);
  if (existing.length > 0) throw new Error(`Refusing to restore: database ${db.databaseName} is not empty.`);

  for (const [name, entry] of Object.entries(manifest.collections)) {
    const collection = await db.createCollection(name);
    let batch = [];
    for await (const doc of readDocuments(path.join(dir, entry.file))) {
      batch.push(doc);
      if (batch.length === INSERT_BATCH) {
        await collection.insertMany(batch, { ordered: true });
        batch = [];
      }
    }
    if (batch.length > 0) await collection.insertMany(batch, { ordered: true });
    const indexes = entry.indexes.filter((index) => index.name !== "_id_");
    if (indexes.length > 0) await collection.createIndexes(indexes);
  }
};

/** Local databases only, and never anything but the rehearsal's own copy. */
export const rehearsalDatabaseName = (source, stamp) => `${source}_restore_${stamp}`.slice(0, 63);
