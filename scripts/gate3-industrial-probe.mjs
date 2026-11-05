/** Evidence probe for historical failures. Its successful execution is NOT industrial acceptance. */
import 'reflect-metadata';
import { writeFile } from 'node:fs/promises';
import mongoose from 'mongoose';
if (process.env.APP_ENV !== 'test' || !/^mongodb:\/\/127\.0\.0\.1:27431\//.test(process.env.MONGODB_URI ?? '')) throw Error('Disposable local test replica set required');
process.env.MONGODB_DB_NAME = 'gate3_industrial_probe';
const { connectToDatabase } = await import('../server-dist/db/mongoose.js');
const { runWithFactory, factoryConnection } = await import('../server-dist/db/factory-context.js');
const { getCollectionModel: model } = await import('../server-dist/db/dynamic-model.js');
const { ensureTrustIndexes } = await import('../server-dist/db/indexes.js');
const { createApp } = await import('../server-dist/app.js');
const { Phase2Service } = await import('../server-dist/modules/phase2/phase2.service.js');
const { PackagingService } = await import('../server-dist/modules/packaging/packaging.service.js');
const scope = { tenant_id: 'industrial-probe', factory_id: 'site-one' };
let app;
const result = { fixture: 'Synthetic 1000 kg lot; existing stage-close services on a real local replica set', fullGoldenThread: 'NOT VERIFIED', checks: [] };
try {
  await connectToDatabase();
  app = await createApp();
  await app.init();
  await runWithFactory(scope, async () => {
    await factoryConnection().dropDatabase();
    await ensureTrustIndexes(factoryConnection().db, true);
    await model('site_settings').create({ id: 'global', costing: { labour_rate_tnd_per_hour: 0, energy_tariff_tnd_per_kwh: 0, overhead_tnd_per_kg: 0.15 }, quality: { mass_balance_tolerance_pct: 2 } });
    await model('receptions_v2').create({ id: 'rec', supplier_id: 'supplier', status: 'ACCEPTE', variety: 'Deglet Nour' });
    await model('suppliers').create({ id: 'supplier', code: 'SUP-PROBE', name: 'Synthetic probe supplier', is_active: true });
    await model('reception_lots').create({ id: 'lot', reception_id: 'rec', lot_internal: 'PROBE-1000', quantity: 1000, stock_status: 'STOCK_LIBERE', purchase_cost_tnd: 10000, purchase_cost_tnd_per_kg: 10 });
    await model('stock_lots').create({ id: 'mp', reception_lot_id: 'lot', lot_number: 'PROBE-1000', category: 'MP', status: 'VALIDATED', current_quantity: 1000, initial_quantity: 1000, unit: 'kg' });
    await model('cleaning_cycles').create({ id: 'clean', cycle_number: 'CLEAN-PROBE', status: 'EN_COURS', lot_number: 'PROBE-1000' });
    const stockKg = async () => (await model('stock_lots').find({}).lean()).reduce((sum, row) => sum + Number(row.current_quantity || 0), 0);
    const phase2 = app.get(Phase2Service);
    await phase2.closeCleaningCycle('clean', { weight_in_kg: 1000, weight_out_kg: 960, waste_weight_kg: 40, waste_category: 'IMPURETES' });
    result.checks.push({ name: 'Cleaning changes inventory', status: (await stockKg()) === 960 ? 'PASS' : 'FAIL', expectedKg: 960, actualKg: await stockKg(), movements: await model('stock_movements').countDocuments({}) });
    await model('triage_sessions').create({ id: 'tri', session_number: 'TRI-PROBE', status: 'EN_COURS', parent_lot_number: 'PROBE-1000', parent_reception_id: 'rec', parent_weight_kg: 400,
      weight_extra_kg: 100, weight_cat1_kg: 200, weight_cat2_kg: 80, weight_reject_kg: 20, total_sorted_kg: 400, worker_count: 0 });
    const triage = await phase2.closeTriageSession('tri');
    const afterTriage = await stockKg();
    result.checks.push({ name: 'Triage consumes 400 kg before creating 380 kg of stock', status: afterTriage === 980 ? 'PASS' : 'FAIL', expectedFromRecordedInputKg: 980, actualKg: afterTriage, physicallyExpectedAfterCleaningKg: 940 });
    const unitCost = Number(triage.stockLots[0]?.cost_tnd_per_kg);
    result.checks.push({ name: 'Partial triage allocates only consumed material cost', status: Math.abs(unitCost - (4057 / 380)) < 0.001 ? 'PASS' : 'FAIL', actualTndPerKg: unitCost, expectedTndPerKg: 4057 / 380, expectedMaterialTnd: 4000, standardOverheadTnd: 57 });
    try {
      const order = await app.get(PackagingService).createOrder({ client_request_id: 'probe-package', source_sublot_id: triage.subLots.find((lot) => lot.grade === 'EXTRA')?.id,
        source_lot_number: 'PROBE-1000-EX', source_weight_kg: 50, bom_net_weight_g: 500, grade: 'EXTRA' });
      result.checks.push({ name: 'Derived triage lot reaches packaging', status: 'PASS', orderId: order.id, remainingStockKg: await stockKg() });
    } catch (error) { result.checks.push({ name: 'Derived triage lot reaches packaging', status: 'FAIL', code: error.code, message: error.message }); }
    result.checks.push({ name: 'Premium route ledger is complete', status: 'NOT VERIFIED', events: await model('lot_events').countDocuments({ lot_id: 'lot' }), reason: 'This probe does not perform device fumigation, full QC, pallet/order/shipment or browser manufacturing; warnings are retained in its log.' });
  });
  await writeFile('.local/gate3-2026-11-04/industrial-probe.json', `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await app?.close();
  if (mongoose.connection.name === 'gate3_industrial_probe') {
    await runWithFactory(scope, () => factoryConnection().dropDatabase());
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
}
