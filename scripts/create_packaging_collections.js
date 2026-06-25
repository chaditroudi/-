/**
 * Royal Palm MES — Module 11: Packaging & Étiquettes
 * MongoDB collections init script
 *
 * Run with:
 *   mongosh <connection-string> scripts/create_packaging_collections.js
 *
 * Safe to re-run: createCollection skips if collection exists, createIndex is idempotent.
 */

const DB_NAME = 'date_harvest_hub';
const db = db.getSiblingDB(DB_NAME);

function ensureCollection(name, validator) {
  const existing = db.getCollectionNames();
  if (existing.includes(name)) {
    print(`[SKIP] "${name}" already exists — updating validator`);
    db.runCommand({ collMod: name, validator: validator, validationLevel: 'moderate' });
  } else {
    db.createCollection(name, {
      validator: validator,
      validationLevel: 'moderate',
      validationAction: 'warn',
    });
    print(`[OK]   "${name}" created`);
  }
}

// ─── 1. packaging_bom ────────────────────────────────────────────────────────

ensureCollection('packaging_bom', {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'sku', 'format', 'net_weight_g', 'gross_weight_g', 'box_material',
               'boxes_per_layer', 'layers_per_palette', 'is_active', 'created_by', 'created_at'],
    properties: {
      name:                     { bsonType: 'string' },
      sku:                      { bsonType: 'string' },
      format:                   { enum: ['BARQUETTE_125G','BARQUETTE_250G','BARQUETTE_500G','BOITE_500G','BOITE_1KG','SAC_2KG','SAC_5KG','SAC_10KG','VRAC_25KG'] },
      net_weight_g:             { bsonType: ['int','double'], minimum: 1 },
      gross_weight_g:           { bsonType: ['int','double'], minimum: 1 },
      box_material:             { enum: ['CARTON','PLASTIQUE','SACHET_PP','SACHET_PE','BARQUETTE_PLASTIQUE'] },
      boxes_per_layer:          { bsonType: 'int', minimum: 1 },
      layers_per_palette:       { bsonType: 'int', minimum: 1 },
      label_template_id:        { bsonType: ['string','null'] },
      label_template_name:      { bsonType: ['string','null'] },
      is_private_label:         { bsonType: 'bool' },
      private_label_client_id:  { bsonType: ['string','null'] },
      private_label_client_name:{ bsonType: ['string','null'] },
      is_active:                { bsonType: 'bool' },
      notes:                    { bsonType: ['string','null'] },
      created_by:               { bsonType: 'string' },
      created_at:               { bsonType: 'string' },
      updated_at:               { bsonType: 'string' },
    },
  },
});

db.packaging_bom.createIndex({ sku: 1 },                      { unique: true, name: 'idx_sku' });
db.packaging_bom.createIndex({ is_active: 1 },                { name: 'idx_active' });
db.packaging_bom.createIndex({ format: 1 },                   { name: 'idx_format' });
db.packaging_bom.createIndex({ label_template_id: 1 },        { name: 'idx_label_template' });
db.packaging_bom.createIndex({ is_private_label: 1 },         { name: 'idx_private_label' });
print('[IDX]  packaging_bom indexes created');

// ─── 2. label_templates ──────────────────────────────────────────────────────

ensureCollection('label_templates', {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'version', 'brand', 'language', 'market', 'product_name',
               'origin', 'net_weight_g', 'ingredients', 'storage_temp', 'use_by_days',
               'status', 'created_by', 'created_at'],
    properties: {
      name:          { bsonType: 'string' },
      version:       { bsonType: 'string' },
      brand:         { enum: ['ROYAL_PALM','PRIVATE_LABEL'] },
      client_name:   { bsonType: ['string','null'] },
      language:      { enum: ['FR','EN','AR','DE','FR_EN'] },
      market:        { bsonType: 'string', maxLength: 5 },
      product_name:  { bsonType: 'string' },
      variety:       { bsonType: ['string','null'] },
      origin:        { bsonType: 'string' },
      net_weight_g:  { bsonType: ['int','double'], minimum: 1 },
      ingredients:   { bsonType: 'string' },
      allergens:     { bsonType: ['string','null'] },
      storage_temp:  { bsonType: 'string' },
      use_by_days:   { bsonType: 'int', minimum: 1 },
      gtin:          { bsonType: ['string','null'] },
      status:        { enum: ['BROUILLON','VALIDE','ARCHIVE'] },
      approved_by:   { bsonType: ['string','null'] },
      approved_at:   { bsonType: ['string','null'] },
      is_active:     { bsonType: 'bool' },
      created_by:    { bsonType: 'string' },
      created_at:    { bsonType: 'string' },
      updated_at:    { bsonType: 'string' },
    },
  },
});

db.label_templates.createIndex({ status: 1 },        { name: 'idx_status' });
db.label_templates.createIndex({ brand: 1 },         { name: 'idx_brand' });
db.label_templates.createIndex({ market: 1 },        { name: 'idx_market' });
db.label_templates.createIndex({ gtin: 1 },          { name: 'idx_gtin', sparse: true });
db.label_templates.createIndex({ is_active: 1 },     { name: 'idx_active' });
// Unique name+version per brand+market
db.label_templates.createIndex(
  { name: 1, version: 1, brand: 1, market: 1 },
  { unique: true, name: 'idx_name_version_brand_market' }
);
print('[IDX]  label_templates indexes created');

// ─── 3. private_label_clients ────────────────────────────────────────────────

ensureCollection('private_label_clients', {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'code', 'country', 'active', 'created_at'],
    properties: {
      name:          { bsonType: 'string' },
      code:          { bsonType: 'string' },
      country:       { bsonType: 'string', maxLength: 3 },
      contact_name:  { bsonType: ['string','null'] },
      contact_email: { bsonType: ['string','null'] },
      active:        { bsonType: 'bool' },
      created_at:    { bsonType: 'string' },
      updated_at:    { bsonType: 'string' },
    },
  },
});

db.private_label_clients.createIndex({ code: 1 },    { unique: true, name: 'idx_code' });
db.private_label_clients.createIndex({ active: 1 },  { name: 'idx_active' });
db.private_label_clients.createIndex({ country: 1 }, { name: 'idx_country' });
print('[IDX]  private_label_clients indexes created');

// ─── 4. packaging_orders ─────────────────────────────────────────────────────

ensureCollection('packaging_orders', {
  $jsonSchema: {
    bsonType: 'object',
    required: ['order_number', 'status', 'source_sublot_id', 'source_lot_number',
               'source_weight_kg', 'grade', 'bom_id', 'bom_name', 'bom_format',
               'label_template_id', 'label_template_name', 'target_units',
               'line', 'operator_name', 'worker_count', 'planned_at',
               'created_by', 'created_at'],
    properties: {
      order_number:            { bsonType: 'string' },
      status:                  { enum: ['PLANIFIE','EN_COURS','PAUSE','TERMINE','ANNULE'] },
      source_sublot_id:        { bsonType: 'string' },
      source_lot_number:       { bsonType: 'string' },
      source_weight_kg:        { bsonType: ['int','double'] },
      grade:                   { enum: ['EXTRA','CATEGORIE_I','CATEGORIE_II'] },
      bom_id:                  { bsonType: 'string' },
      bom_name:                { bsonType: 'string' },
      bom_format:              { enum: ['BARQUETTE_125G','BARQUETTE_250G','BARQUETTE_500G','BOITE_500G','BOITE_1KG','SAC_2KG','SAC_5KG','SAC_10KG','VRAC_25KG'] },
      label_template_id:       { bsonType: 'string' },
      label_template_name:     { bsonType: 'string' },
      target_units:            { bsonType: 'int', minimum: 0 },
      produced_units:          { bsonType: 'int', minimum: 0 },
      rejected_units:          { bsonType: 'int', minimum: 0 },
      checkweigher_count:      { bsonType: 'int', minimum: 0 },
      checkweigher_failures:   { bsonType: 'int', minimum: 0 },
      metal_detector_failures: { bsonType: 'int', minimum: 0 },
      line:                    { enum: ['L-PKG-1','L-PKG-2','L-PKG-3'] },
      operator_name:           { bsonType: 'string' },
      chef_ligne:              { bsonType: ['string','null'] },
      worker_count:            { bsonType: 'int', minimum: 1 },
      planned_at:              { bsonType: 'string' },
      started_at:              { bsonType: ['string','null'] },
      ended_at:                { bsonType: ['string','null'] },
      duration_minutes:        { bsonType: ['int','double','null'] },
      notes:                   { bsonType: ['string','null'] },
      created_by:              { bsonType: 'string' },
      created_at:              { bsonType: 'string' },
      updated_at:              { bsonType: 'string' },
    },
  },
});

db.packaging_orders.createIndex({ order_number: 1 },     { unique: true, name: 'idx_order_number' });
db.packaging_orders.createIndex({ status: 1 },            { name: 'idx_status' });
db.packaging_orders.createIndex({ source_sublot_id: 1 }, { name: 'idx_sublot' });
db.packaging_orders.createIndex({ planned_at: -1 },       { name: 'idx_planned_at' });
db.packaging_orders.createIndex({ created_at: -1 },       { name: 'idx_created_at' });
db.packaging_orders.createIndex({ bom_id: 1 },            { name: 'idx_bom' });
// Partial index: orders with metal detector issues
db.packaging_orders.createIndex(
  { metal_detector_failures: 1 },
  { name: 'idx_metal_failures', partialFilterExpression: { metal_detector_failures: { $gt: 0 } } }
);
print('[IDX]  packaging_orders indexes created');

// ─── 5. packaging_palettes ───────────────────────────────────────────────────

ensureCollection('packaging_palettes', {
  $jsonSchema: {
    bsonType: 'object',
    required: ['palette_number', 'order_id', 'order_number', 'status', 'bom_id',
               'box_count', 'gross_weight_kg', 'net_weight_kg', 'created_at'],
    properties: {
      palette_number:      { bsonType: 'string' },
      order_id:            { bsonType: 'string' },
      order_number:        { bsonType: 'string' },
      status:              { enum: ['EN_COURS','SCELLE','EXPEDIE'] },
      bom_id:              { bsonType: 'string' },
      box_count:           { bsonType: 'int', minimum: 0 },
      gross_weight_kg:     { bsonType: ['int','double'] },
      net_weight_kg:       { bsonType: ['int','double'] },
      seal_number:         { bsonType: ['string','null'] },
      sealed_by:           { bsonType: ['string','null'] },
      sealed_at:           { bsonType: ['string','null'] },
      sscc:                { bsonType: ['string','null'] },
      storage_location_id: { bsonType: ['string','null'] },
      created_at:          { bsonType: 'string' },
      updated_at:          { bsonType: 'string' },
    },
  },
});

db.packaging_palettes.createIndex({ palette_number: 1 }, { unique: true, name: 'idx_palette_number' });
db.packaging_palettes.createIndex({ order_id: 1 },        { name: 'idx_order_id' });
db.packaging_palettes.createIndex({ status: 1 },           { name: 'idx_status' });
db.packaging_palettes.createIndex({ created_at: -1 },      { name: 'idx_created_at' });
db.packaging_palettes.createIndex({ sscc: 1 },             { name: 'idx_sscc', sparse: true });
db.packaging_palettes.createIndex({ sealed_at: -1 },       { name: 'idx_sealed_at', sparse: true });
print('[IDX]  packaging_palettes indexes created');

// ─── Summary ─────────────────────────────────────────────────────────────────

print('');
print('=== Module 11 — Packaging & Étiquettes collections ready ===');
[
  'packaging_bom',
  'label_templates',
  'private_label_clients',
  'packaging_orders',
  'packaging_palettes',
].forEach((n) => {
  const info = db.getCollection(n).stats();
  print(`  ${n}: ${info.count ?? 0} docs, indexes: ${JSON.stringify(db.getCollection(n).getIndexes().map(i => i.name))}`);
});
