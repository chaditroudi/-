// @vitest-environment node
import 'reflect-metadata';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const uri = process.env.GATE4_IT_MONGO_URI;
const DB = 'gate4_industrial_it';
const factory = { tenant_id: 'gate4-company-a', factory_id: 'site-one' };
let app: any, phase2: any, packaging: any, ctx: any, model: any, ledger: any;
const inFactory = <T>(work: () => T) => ctx.runWithFactory(factory, work);
const close = (id = 'clean', patch = {}) => inFactory(() => phase2.closeCleaningCycle(id, { weight_in_kg: 1000, weight_out_kg: 960, waste_weight_kg: 40, waste_category: 'INERTE', ...patch }));
const stockKg = () => inFactory(async () => (await model('stock_lots').find({}).lean()).reduce((sum: number, row: any) => sum + Number(row.current_quantity || 0), 0));

describe.skipIf(!uri)('Gate 4 industrial atomicity on a real replica set', () => {
  beforeAll(async () => {
    if (process.env.APP_ENV !== 'test' || !/^mongodb:\/\/127\.0\.0\.1:27441\//.test(uri!)) throw Error('Disposable Gate 4 database required');
    process.env.MONGODB_URI = uri; process.env.MONGODB_DB_NAME = DB;
    const compiled = '../../../server-dist';
    const { connectToDatabase } = await import(/* @vite-ignore */ `${compiled}/db/mongoose.js`);
    await connectToDatabase();
    expect(mongoose.connection.name).toBe(DB);
    ctx = await import(/* @vite-ignore */ `${compiled}/db/factory-context.js`);
    ({ getCollectionModel: model } = await import(/* @vite-ignore */ `${compiled}/db/dynamic-model.js`));
    const { ensureTrustIndexes } = await import(/* @vite-ignore */ `${compiled}/db/indexes.js`);
    await inFactory(async () => {
      await ctx.factoryConnection().dropDatabase();
      await ensureTrustIndexes(ctx.factoryConnection().db, true);
      for (const collection of ['stock_lots', 'stock_movements', 'reception_lots', 'receptions_v2', 'cleaning_cycles', 'triage_sessions', 'triage_sublots', 'lot_events', 'counters', 'system_notifications', 'system_audit_logs']) {
        if (!await ctx.factoryConnection().db.listCollections({ name: collection }).hasNext()) await ctx.factoryConnection().db.createCollection(collection);
      }
    });
    const { createApp } = await import(/* @vite-ignore */ `${compiled}/app.js`);
    const { Phase2Service } = await import(/* @vite-ignore */ `${compiled}/modules/phase2/phase2.service.js`);
    const { PackagingService } = await import(/* @vite-ignore */ `${compiled}/modules/packaging/packaging.service.js`);
    const { lotLedgerService } = await import(/* @vite-ignore */ `${compiled}/modules/trust/lot-ledger.service.js`);
    ledger = lotLedgerService;
    app = await createApp(); await app.init(); phase2 = app.get(Phase2Service); packaging = app.get(PackagingService);
  }, 60_000);
  afterAll(async () => {
    await app?.close();
    if (ctx && mongoose.connection.name === DB) { await inFactory(() => ctx.factoryConnection().dropDatabase()); await mongoose.connection.dropDatabase(); }
    await mongoose.disconnect();
  });
  beforeEach(async () => {
    vi.restoreAllMocks();
    await inFactory(async () => {
      for (const name of ['stock_lots', 'stock_movements', 'reception_lots', 'receptions_v2', 'cleaning_cycles', 'triage_sessions', 'triage_sublots', 'lot_events', 'counters', 'system_notifications', 'system_audit_logs']) await model(name).deleteMany({});
      await model('site_settings').findOneAndUpdate({ id: 'global' }, { $set: { costing: { labour_rate_tnd_per_hour: 0, energy_tariff_tnd_per_kwh: 0, overhead_tnd_per_kg: 0 }, quality: { mass_balance_tolerance_pct: 2 } } }, { upsert: true });
      await model('reception_lots').create({ id: 'rl', reception_id: 'rec', lot_internal: 'LOT-1000', quantity: 1000, stock_status: 'STOCK_LIBERE', manufacturing_route: 'GENERIC', purchase_cost_tnd: 10000, purchase_cost_tnd_per_kg: 10 });
      await model('receptions_v2').create({ id: 'rec', status: 'ACCEPTE' });
      await model('stock_lots').create({ id: 'mp', reception_lot_id: 'rl', source_stage: 'RECEPTION', lot_number: 'LOT-1000', category: 'MP', current_quantity: 1000, initial_quantity: 1000, status: 'VALIDATED', unit: 'kg' });
      await model('cleaning_cycles').create({ id: 'clean', cycle_number: 'NET-1', lot_number: 'LOT-1000', reception_id: 'rec', status: 'EN_COURS' });
      await ledger.append({ lotId: 'rl', eventType: 'LOT_CREATED', collection: 'reception_lots', action: 'GATE', payload: { stage: 'SUPPLIER_INTAKE', route: 'GENERIC' } });
      await ledger.append({ lotId: 'rl', eventType: 'QC_DECIDED', collection: 'qc_inspections', action: 'GATE', payload: { stage: 'QC_DECIDED', route: 'GENERIC' } });
    });
  });

  it('cleans 1000 into 960 usable + 40 waste with linked stock and conserved material value', async () => {
    await close();
    expect(await stockKg()).toBe(960);
    await inFactory(async () => {
      const source = await model('stock_lots').findOne({ id: 'mp' }).lean();
      const output = await model('stock_lots').findOne({ source_stage: 'CLEANING' }).lean();
      expect(source.current_quantity).toBe(0);
      expect(output).toMatchObject({ current_quantity: 960, parent_stock_lot_id: 'mp', reception_lot_id: 'rl', cleaning_cycle_id: 'clean', cost_tnd: 10000 });
      expect(output.cost_tnd_per_kg).toBeCloseTo(10000 / 960, 6);
      expect(await model('stock_movements').countDocuments({ document_type: 'CLEANING_CLOSE' })).toBe(2);
      expect((await ledger.verify('rl')).valid).toBe(true);
    });
  });
  it('replays concurrent close calls without duplicating output or waste', async () => {
    await Promise.all([close(), close()]);
    await close();
    expect(await stockKg()).toBe(960);
    expect(await inFactory(() => model('stock_lots').countDocuments({ cleaning_cycle_id: 'clean' }))).toBe(1);
    expect(await inFactory(() => model('stock_movements').countDocuments({ document_type: 'CLEANING_CLOSE' }))).toBe(2);
  });
  it('rolls back stock, output and cycle status if movement persistence fails, then safely retries', async () => {
    const movements = inFactory(() => model('stock_movements'));
    vi.spyOn(movements, 'create').mockRejectedValueOnce(new Error('forced movement failure'));
    await expect(close()).rejects.toThrow('forced movement failure');
    expect(await stockKg()).toBe(1000);
    expect(await inFactory(() => model('stock_lots').countDocuments({ source_stage: 'CLEANING' }))).toBe(0);
    expect((await inFactory(() => model('cleaning_cycles').findOne({ id: 'clean' }).lean())).status).toBe('EN_COURS');
    vi.restoreAllMocks(); await close(); expect(await stockKg()).toBe(960);
  });
  it('rejects held input and unreconciled or negative quantities even when mass-balance mode is warn', async () => {
    await expect(close('clean', { weight_out_kg: 990 })).rejects.toMatchObject({ code: 'MASS_BALANCE_UNBALANCED' });
    await expect(close('clean', { waste_weight_kg: -40, weight_out_kg: 1040 })).rejects.toMatchObject({ code: 'CLEANING_WEIGHTS_INVALID' });
    await inFactory(() => model('stock_lots').updateOne({ id: 'mp' }, { $set: { status: 'HOLD' } }));
    await expect(close()).rejects.toMatchObject({ code: 'LOT_NOT_CONSUMABLE' });
    expect(await stockKg()).toBe(1000);
  });
  it('allocates only 400 kg of a 1000 kg parent to partial triage', async () => {
    await inFactory(() => model('triage_sessions').create({ id: 'tri', session_number: 'TRI-1', parent_lot_number: 'LOT-1000', parent_reception_id: 'rec', parent_weight_kg: 400, status: 'EN_COURS', weight_extra_kg: 100, weight_cat1_kg: 200, weight_cat2_kg: 80, weight_reject_kg: 20, total_sorted_kg: 400, worker_count: 0 }));
    const result = await inFactory(() => phase2.closeTriageSession('tri'));
    expect(result.session.material_cost_tnd).toBe(4000);
    expect(result.stockLots.reduce((sum: number, row: any) => sum + row.cost_tnd, 0)).toBeCloseTo(4000, 3);
    expect(result.stockLots[0].cost_tnd_per_kg).toBeCloseTo(4000 / 380, 4);
    expect(await stockKg()).toBe(980);
  });
});
