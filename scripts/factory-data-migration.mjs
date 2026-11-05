/** Non-destructive staging only. Build server first. Never assigns ownership or activates accounts. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { BSON, MongoClient } from 'mongodb';
import { assertSafeDbTarget } from './lib/db-target-guard.mjs';

const CONTROL = new Set(['auth_users', 'auth_security_events', 'sessions', 'refresh_tokens', 'factory_migrations']);
const digest = async (collection) => {
  const hash = createHash('sha256');
  let count = 0;
  for await (const row of collection.find({}).sort({ _id: 1 })) {
    hash.update(BSON.EJSON.stringify(row, { relaxed: false }));
    hash.update('\n');
    count++;
  }
  return { count, sha256: hash.digest('hex') };
};

export const inventoryFactoryData = async (client, controlDatabase, factory) => {
  const { factoryDatabaseName } = await import('../server-dist/db/factory-context.js');
  const source = client.db(controlDatabase);
  const runtimeDatabase = factoryDatabaseName(controlDatabase, factory);
  // No API model resolves this name. A failed copy cannot become a partially live factory.
  const targetDatabase = `${runtimeDatabase}_staging`;
  const collections = [];
  const entries = (await source.listCollections({}, { nameOnly: false }).toArray())
    .filter((entry) => !CONTROL.has(entry.name) && !entry.name.startsWith('system.'));
  const unsupported = entries.filter((entry) => entry.type !== 'collection' || Object.keys(entry.options ?? {}).length > 0)
    .map((entry) => ({ name: entry.name, type: entry.type, options: entry.options ?? {} }));
  const names = entries.filter((entry) => entry.type === 'collection').map((entry) => entry.name).sort();
  for (const name of names) {
    const collection = source.collection(name);
    const conflicting = await collection.countDocuments({ $or: [
      { tenant_id: { $exists: true, $nin: [null, factory.tenant_id] } },
      { factory_id: { $exists: true, $nin: [null, factory.factory_id] } },
    ] });
    const indexes = (await collection.listIndexes().toArray()).map(({ v, ns, background, ...index }) => index);
    collections.push({ name, ...await digest(collection), conflicting, indexes });
  }
  const payload = { controlDatabase, runtimeDatabase, targetDatabase, factory, collections, unsupported };
  return { ...payload, inventoryHash: createHash('sha256').update(JSON.stringify(payload)).digest('hex') };
};

export const copyFactoryData = async (client, manifest) => {
  if (manifest?.allLegacyDataBelongsToFactory !== true || !manifest.inventoryHash) {
    throw Error('An explicit, reviewed single-factory ownership manifest is required. Mixed ownership must be resolved separately.');
  }
  const inventory = await inventoryFactoryData(client, manifest.controlDatabase, manifest.factory);
  if (inventory.inventoryHash !== manifest.inventoryHash) throw Error('Source changed since review; create and review a new inventory.');
  if (inventory.unsupported.length > 0) throw Error('Unsupported collection options or views require a dedicated reviewed migration.');
  if (inventory.collections.some((entry) => entry.conflicting > 0)) throw Error('Conflicting factory ownership in source records.');
  if (await client.db(manifest.controlDatabase).collection('auth_users').countDocuments(manifest.factory) > 0) {
    throw Error('Factory already has an assigned account; use a separately reviewed live migration procedure.');
  }
  const target = client.db(inventory.targetDatabase);
  if ((await target.listCollections({}, { nameOnly: true }).toArray()).length > 0) throw Error('Target is not empty; refusing to reuse any existing collection.');
  for (const entry of inventory.collections) {
    await target.createCollection(entry.name);
    const destination = target.collection(entry.name);
    for (const { key, ...options } of entry.indexes) {
      if (options.name !== '_id_') await destination.createIndex(key, options);
    }
    let batch = [];
    for await (const row of client.db(manifest.controlDatabase).collection(entry.name).find({})) {
      batch.push(row);
      if (batch.length >= 500) { await destination.insertMany(batch); batch = []; }
    }
    if (batch.length) await destination.insertMany(batch);
    const actual = await digest(destination);
    if (actual.count !== entry.count || actual.sha256 !== entry.sha256) throw Error(`Copy verification failed for ${entry.name}; target remains quarantined.`);
  }
  const after = await inventoryFactoryData(client, manifest.controlDatabase, manifest.factory);
  if (after.inventoryHash !== inventory.inventoryHash) throw Error('Source changed during copy; target remains quarantined.');
  return { sourceUnchanged: true, accountsActivated: false, runtimeDatabase: inventory.runtimeDatabase, targetDatabase: inventory.targetDatabase,
    inventoryHash: inventory.inventoryHash, collections: inventory.collections.map(({ name, count, sha256 }) => ({ name, count, sha256 })) };
};

const main = async () => {
  const argv = process.argv.slice(2);
  const option = (key) => argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3);
  const controlDatabase = option('database');
  const factory = { tenant_id: option('tenant'), factory_id: option('factory') };
  if (!controlDatabase || !option('output')) throw Error('--database, --tenant, --factory and --output are required. Default action is read-only inventory.');
  assertSafeDbTarget({ uri: process.env.MONGODB_URI, dbName: controlDatabase, argv });
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  try {
    const manifestPath = option('manifest');
    const manifest = manifestPath ? JSON.parse(await readFile(manifestPath, 'utf8')) : null;
    if (argv.includes('--copy') && (!manifest || manifest.controlDatabase !== controlDatabase
      || manifest.factory?.tenant_id !== factory.tenant_id || manifest.factory?.factory_id !== factory.factory_id)) {
      throw Error('Manifest must match the explicitly selected source database, company and factory.');
    }
    const result = argv.includes('--copy') ? await copyFactoryData(client, manifest) : await inventoryFactoryData(client, controlDatabase, factory);
    await writeFile(option('output'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
    console.log(argv.includes('--copy') ? 'Copy verified. No accounts activated; legacy source retained.' : 'Read-only inventory written. Ownership still requires review.');
  } finally { await client.close(); }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
