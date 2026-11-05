import { badRequest, notFound } from '../../core/app-error.js';
import { getCollectionModel, sanitizeDocument } from '../../db/dynamic-model.js';
import { prepareInsertDocument } from '../../db/defaults.js';
import { consumeStockLotKg } from './stock-quantity.js';
import { lotLedgerService } from '../trust/lot-ledger.service.js';

type Row = Record<string, any>;
const finiteCost = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};
export const money = (value: number) => Number(value.toFixed(6));

/** Initial/original value is historical; current consumed quantity is never its denominator. */
export const stockUnitCost = (stock: Row, receptionLot?: Row | null): number | null => {
  const unit = finiteCost(stock.cost_tnd_per_kg);
  if (unit !== null) return unit;
  const value = finiteCost(stock.cost_tnd);
  if (value !== null && Number(stock.initial_quantity) > 0) return value / Number(stock.initial_quantity);
  const purchase = finiteCost(receptionLot?.purchase_cost_tnd_per_kg);
  if (purchase !== null) return purchase;
  const purchaseValue = finiteCost(receptionLot?.purchase_cost_tnd);
  return purchaseValue !== null && Number(receptionLot?.quantity) > 0 ? purchaseValue / Number(receptionLot.quantity) : null;
};

/** Resolve an actual active batch, never the first descendant sharing a reception ID. */
export const manufacturingInput = async (lotNumber: string, stockId?: string, allowWip = false): Promise<Row> => {
  const rows = sanitizeDocument(await getCollectionModel('stock_lots').find(stockId ? { id: stockId } : { lot_number: lotNumber }).lean().exec()) as Row[];
  const candidates = rows.filter((row) => Number(row.current_quantity) > 0 && (allowWip || !['TRIAGE', 'PACKAGING'].includes(String(row.source_stage))));
  if (!candidates.length) throw notFound('STOCK_LOT_NOT_FOUND', `Aucun stock actif pour ${lotNumber}.`);
  if (candidates.length !== 1) throw badRequest('MANUFACTURING_STOCK_AMBIGUOUS', 'Plusieurs lots de stock correspondent. Sélectionnez le lot source précis.');
  const stock = candidates[0];
  if (stockId && stock.lot_number !== lotNumber) throw badRequest('SOURCE_LOT_MISMATCH', 'Le stock sélectionné ne correspond pas au lot de fabrication.');
  if (!['VALIDATED', 'RELEASED', 'STOCK_LIBERE', 'LIBERE'].includes(String(stock.status).toUpperCase())) throw badRequest('LOT_NOT_CONSUMABLE', 'Le lot source est bloqué ou non libéré.');
  if (stock.reception_lot_id) {
    const root = await getCollectionModel('reception_lots').findOne({ id: stock.reception_lot_id }).lean().exec();
    if (root?.stock_status !== 'STOCK_LIBERE') throw badRequest('LOT_NOT_LIBERE', 'La décision QC du lot source ne permet pas sa consommation.');
  }
  return stock;
};

/** Called only inside the cleaning domain transaction. Waste is evidenced, not deducted twice. */
export const applyCleaningStock = async (cycle: Row, inputKg: number, outputKg: number, wasteKg: number, now: string) => {
  const source = await manufacturingInput(String(cycle.lot_number), cycle.stock_lot_id ? String(cycle.stock_lot_id) : undefined);
  const root = source.reception_lot_id ? await getCollectionModel('reception_lots').findOne({ id: source.reception_lot_id }).lean().exec() : null;
  if (!root) throw badRequest('SOURCE_LINEAGE_REQUIRED', 'La réception source du nettoyage est introuvable.');
  const unitCost = stockUnitCost(source, root);
  const carriedValue = unitCost === null ? null : money(unitCost * inputKg);
  const quantity = await consumeStockLotKg(String(source.id), inputKg, now);
  const outputNumber = quantity.after <= 0.001 ? String(source.lot_number) : `${source.lot_number}-NET-${cycle.id}`;
  const output = await prepareInsertDocument('stock_lots', {
    lot_number: outputNumber, source_stage: 'CLEANING', cleaning_cycle_id: cycle.id, parent_stock_lot_id: source.id,
    reception_lot_id: root.id, source_reception_id: root.reception_id, source_lot_internal: root.lot_internal,
    product_id: source.product_id ?? null, supplier_id: source.supplier_id ?? null, variety: source.variety ?? root.variety ?? null,
    origin_country: source.origin_country ?? root.origin_country ?? null, is_bio: source.is_bio ?? root.is_bio ?? null,
    category: source.category || 'MP', unit: 'kg', initial_quantity: outputKg, current_quantity: outputKg, status: source.status,
    location_id: source.location_id ?? null, storage_location_id: source.storage_location_id ?? null,
    cost_tnd: carriedValue, cost_tnd_per_kg: carriedValue === null ? null : money(carriedValue / outputKg),
    remaining_cost_tnd: carriedValue, cost_basis: 'carried_material', cost_coverage: carriedValue === null ? 'MISSING_MATERIAL' : 'COMPLETE',
    created_by: cycle.created_by ?? null, created_at: now, updated_at: now,
  });
  await getCollectionModel('stock_lots').create([output]);
  if (unitCost !== null) await getCollectionModel('stock_lots').updateOne({ id: source.id }, { $set: { remaining_cost_tnd: money(unitCost * quantity.after) } });
  const evidence = { cleaning_cycle_id: cycle.id, input_kg: inputKg, output_kg: outputKg, waste_kg: wasteKg, waste_category: cycle.waste_category,
    parent_stock_lot_id: source.id, output_stock_lot_id: output.id, material_cost_tnd: carriedValue };
  const movements = await Promise.all([
    prepareInsertDocument('stock_movements', { movement_type: 'CONSOMMATION', lot_id: source.id, quantity: inputKg, unit: 'kg', document_type: 'CLEANING_CLOSE', document_reference: cycle.cycle_number, request_id: `cleaning:${cycle.id}:input`, performed_by: cycle.created_by ?? null, metadata: { ...evidence, stock_delta_kg: -inputKg }, created_at: now }),
    prepareInsertDocument('stock_movements', { movement_type: 'RECEPTION', lot_id: output.id, quantity: outputKg, unit: 'kg', document_type: 'CLEANING_CLOSE', document_reference: cycle.cycle_number, request_id: `cleaning:${cycle.id}:output`, performed_by: cycle.created_by ?? null, metadata: { ...evidence, stock_delta_kg: outputKg }, created_at: now }),
  ]);
  await getCollectionModel('stock_movements').create(movements);
  await lotLedgerService.append({ lotId: String(root.id), eventType: 'TRANSFORMED', collection: 'cleaning_cycles', action: 'GATE', actorId: cycle.created_by ?? null,
    payload: { process: 'CLEANING', ...evidence }, relatedIds: [String(source.id), String(output.id), String(cycle.id)] });
  return { output, source, root, movements, carriedValue };
};
