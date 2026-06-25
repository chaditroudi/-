import { randomUUID } from "node:crypto";

import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { prepareInsertDocument } from "../../db/defaults.js";

const StockLotModel = () => getCollectionModel("stock_lots");
const ReceptionLotModel = () => getCollectionModel("reception_lots");

const DEFAULT_RAW_PRODUCT = {
  code: "MP-DN-001",
  name: "Deglet Nour Fraiche",
  category: "MP",
  unit: "kg",
  variety: "Deglet Nour",
  threshold_min: 1000,
  threshold_security: 2000,
  threshold_max: 10000,
  rotation_rule: "FIFO",
  is_active: true,
};

const ensureProductHasBusinessId = async (productModel: any, product: any) => {
  if (!product) return null;
  if (product.id) return String(product.id);

  const id = randomUUID();
  await productModel
    .updateOne({ _id: product._id }, { $set: { id, updated_at: new Date().toISOString() } })
    .exec();
  return id;
};

const resolveProductId = async () => {
  const Product = getCollectionModel("products");
  const product =
    (await Product.findOne({ code: DEFAULT_RAW_PRODUCT.code }).lean().exec()) ||
    (await Product.findOne({ is_active: true, category: "MP" }).lean().exec()) ||
    (await Product.findOne({ is_active: true }).lean().exec());

  const productId = await ensureProductHasBusinessId(Product, product);
  if (productId) return productId;

  const prepared = await prepareInsertDocument("products", DEFAULT_RAW_PRODUCT);
  await Product.create([prepared]);
  return String(prepared.id);
};

export const syncReceptionLotsToStock = async (lots: any[], options?: { reception?: any; actorId?: string }) => {
  const stockLotModel = StockLotModel();
  const fallbackProductId = await resolveProductId();

  for (const rawLot of lots) {
    const lot = sanitizeDocument(rawLot);
    const existing = await stockLotModel.findOne({ reception_lot_id: lot.id }).lean().exec();
    const payload = {
      product_id: lot.product_id || options?.reception?.product_id || fallbackProductId,
      reception_lot_id: lot.id,
      source_reception_id: lot.reception_id || options?.reception?.id || null,
      source_reception_number: options?.reception?.reception_number || null,
      source_lot_internal: lot.lot_internal || null,
      source_lot_supplier: lot.lot_supplier || null,
      source_stage: "RECEPTION",
      source_status: lot.stock_status || "EN_QUARANTAINE",
      source_sync_reason: existing ? "SYNC_UPDATE" : "SYNC_CREATE",
      origin_farm: lot.origin_farm || null,
      origin_country: lot.origin_country || "Tunisie",
      supplier_id: options?.reception?.supplier_id || null,
      variety: lot.variety || options?.reception?.variety || null,
      harvest_date: lot.harvest_date || null,
      reception_date: options?.reception?.actual_arrival_date || options?.reception?.created_at || new Date().toISOString(),
      initial_quantity: Number(existing?.initial_quantity ?? lot.quantity ?? 0),
      current_quantity: Number(existing?.current_quantity ?? lot.quantity ?? 0),
      unit: lot.unit || "kg",
      status:
        lot.stock_status === "STOCK_LIBERE"
          ? "VALIDATED"
          : lot.stock_status === "STOCK_REJETE"
            ? "BLOCKED"
            : "QUARANTINE",
      location_id: existing?.location_id || null,
      storage_location_id: existing?.storage_location_id || null,
      storage_location_code: existing?.storage_location_code || null,
      position: existing?.position || null,
      quality_notes: lot.quarantine_reason || null,
      qc_validated_by:
        lot.stock_status === "STOCK_LIBERE"
          ? (options?.actorId ?? existing?.qc_validated_by ?? null)
          : (existing?.qc_validated_by ?? null),
      qc_validated_at:
        lot.stock_status === "STOCK_LIBERE"
          ? (lot.release_date || existing?.qc_validated_at || new Date().toISOString())
          : (existing?.qc_validated_at ?? null),
      created_by: options?.actorId || null,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await stockLotModel.updateOne({ id: existing.id }, { $set: payload }).exec();
    } else {
      const prepared = await prepareInsertDocument("stock_lots", payload);
      await stockLotModel.create([prepared]);
    }
  }
};

export const removeReceptionLotsFromStock = async (receptionLotIds: string[]) => {
  if (receptionLotIds.length === 0) return;
  await StockLotModel().deleteMany({ reception_lot_id: { $in: receptionLotIds } }).exec();
};

export const loadReceptionLots = async (receptionId: string) => {
  return sanitizeDocument(await ReceptionLotModel().find({ reception_id: receptionId }).lean().exec());
};
