// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoClient, ObjectId } from 'mongodb';
import { inventoryFactoryData, copyFactoryData } from './factory-data-migration.mjs';

const uri = process.env.GATE3_IT_MONGO_URI;
const sourceName = 'gate3_migration_it';
const factory = { tenant_id: 'migration-company', factory_id: 'migration-site' };
let client;
let inventory;
describe.skipIf(!uri)('non-destructive factory migration rehearsal', () => {
  beforeAll(async () => {
    if (process.env.APP_ENV !== 'test' || !/^mongodb:\/\/127\.0\.0\.1:27431\//.test(uri)) throw Error('Disposable Gate 3 local database required');
    client = await MongoClient.connect(uri);
    await client.db(sourceName).dropDatabase();
    await client.db(sourceName).collection('stock_lots').createIndex({ id: 1 }, { unique: true });
    await client.db(sourceName).createCollection('empty');
    await client.db(sourceName).collection('stock_lots').insertOne({ _id: new ObjectId(), id: 'lot-1', current_quantity: 1000, at: new Date('2026-11-04T00:00:00Z') });
    await client.db(sourceName).collection('site_settings').insertOne({ id: 'global', company_name: 'Legacy owner' });
    await client.db(sourceName).collection('auth_users').insertOne({ id: 'unassigned-user', passwordHash: 'never-copy-authentication' });
    inventory = await inventoryFactoryData(client, sourceName, factory);
    await client.db(inventory.targetDatabase).dropDatabase();
  });
  afterAll(async () => {
    if (client) { await client.db(sourceName).dropDatabase(); if (inventory) await client.db(inventory.targetDatabase).dropDatabase(); await client.close(); }
  });
  it('inventories without assigning users or printing operational records', async () => {
    expect(inventory.collections.map((entry) => entry.name)).toEqual(['empty', 'site_settings', 'stock_lots']);
    expect(JSON.stringify(inventory)).not.toContain('never-copy-authentication');
    expect(await client.db(inventory.targetDatabase).collection('stock_lots').countDocuments({})).toBe(0);
  });
  it('refuses unreviewed ownership or a stale inventory', async () => {
    await expect(copyFactoryData(client, { controlDatabase: sourceName, factory })).rejects.toThrow(/reviewed/);
    await expect(copyFactoryData(client, { controlDatabase: sourceName, factory, allLegacyDataBelongsToFactory: true, inventoryHash: 'stale' })).rejects.toThrow(/changed/);
  });
  it('copies data and indexes exactly while retaining source and quarantining accounts', async () => {
    const result = await copyFactoryData(client, { ...inventory, allLegacyDataBelongsToFactory: true });
    expect(result).toMatchObject({ sourceUnchanged: true, accountsActivated: false });
    const source = await client.db(sourceName).collection('stock_lots').findOne({ id: 'lot-1' });
    const target = await client.db(inventory.targetDatabase).collection('stock_lots').findOne({ id: 'lot-1' });
    expect(target).toEqual(source);
    expect((await client.db(inventory.targetDatabase).listCollections({}, { nameOnly: true }).toArray()).map((entry) => entry.name)).toContain('empty');
    expect(await client.db(inventory.runtimeDatabase).collection('stock_lots').countDocuments({})).toBe(0);
    expect(await client.db(inventory.targetDatabase).collection('auth_users').countDocuments({})).toBe(0);
    expect((await client.db(sourceName).collection('auth_users').findOne({ id: 'unassigned-user' })).tenant_id).toBeUndefined();
    await expect(client.db(inventory.targetDatabase).collection('stock_lots').insertOne({ id: 'lot-1' })).rejects.toMatchObject({ code: 11000 });
  });
  it('refuses to overwrite or merge an already populated target', async () => {
    await expect(copyFactoryData(client, { ...inventory, allLegacyDataBelongsToFactory: true })).rejects.toThrow(/not empty/);
    expect(await client.db(sourceName).collection('stock_lots').countDocuments({})).toBe(1);
  });
  it('refuses copying for a factory that already has an assigned account', async () => {
    await client.db(sourceName).collection('auth_users').updateOne({ id: 'unassigned-user' }, { $set: factory });
    await expect(copyFactoryData(client, { ...inventory, allLegacyDataBelongsToFactory: true })).rejects.toThrow(/assigned account/);
  });
  it('refuses a schema or view it cannot faithfully preserve', async () => {
    await client.db(sourceName).createCollection('guarded', { validator: { quantity: { $gte: 0 } } });
    const changed = await inventoryFactoryData(client, sourceName, factory);
    await expect(copyFactoryData(client, { ...changed, allLegacyDataBelongsToFactory: true })).rejects.toThrow(/Unsupported collection options/);
  });
});
