/**
 * Royal Palm MES — Phase 2 MongoDB Collections
 * Run with:  mongosh <connection-string> scripts/create_phase2_collections.js
 *
 * Safe to re-run: collection creation is idempotent (skips if exists),
 * createIndex is always idempotent.
 */

const DB_NAME = 'date_harvest_hub';
const db = db.getSiblingDB(DB_NAME);

// ─── Helper ────────────────────────────────────────────────────────────────

function ensureCollection(name, validator) {
  const existing = db.getCollectionNames();
  if (existing.includes(name)) {
    print(`[SKIP] Collection "${name}" already exists — updating validator only`);
    db.runCommand({ collMod: name, validator: validator, validationLevel: 'moderate' });
  } else {
    db.createCollection(name, {
      validator: validator,
      validationLevel: 'moderate',   // warn but don't reject on legacy docs
      validationAction: 'warn',
    });
    print(`[OK]   Collection "${name}" created`);
  }
}

// ─── 1. fumigation_cycles ──────────────────────────────────────────────────

ensureCollection('fumigation_cycles', {
  $jsonSchema: {
    bsonType: 'object',
    required: ['cycle_number', 'chamber', 'protocol', 'status', 'created_by', 'created_at'],
    properties: {
      cycle_number:            { bsonType: 'string', description: 'FUM-FU01-YYYYMMDD-SEQ' },
      chamber:                 { enum: ['FU-01', 'FU-02'] },
      protocol:                { enum: ['FUM-PH3-72', 'FUM-CO2-96', 'FUM-THERM-04'] },
      status:                  { enum: ['PREPARATION', 'CHARGEMENT', 'EN_COURS', 'VENTILATION', 'VALIDATION', 'TERMINE', 'INTERROMPU', 'ECHEC'] },
      lot_refs:                { bsonType: 'array' },
      total_weight_kg:         { bsonType: ['double', 'int', 'null'] },
      fill_rate_percent:       { bsonType: ['double', 'int', 'null'] },
      has_bio_lots:            { bsonType: 'bool' },
      dose_calculated_g:       { bsonType: ['double', 'int', 'null'] },
      dose_applied_g:          { bsonType: ['double', 'int', 'null'] },
      dose_variance_percent:   { bsonType: ['double', 'int', 'null'] },
      product_lot_number:      { bsonType: ['string', 'null'] },
      product_expiry_date:     { bsonType: ['string', 'null'] },
      photo_disposition_urls:  { bsonType: 'array' },
      t0_start:                { bsonType: ['string', 'null'] },
      t_end_real:              { bsonType: ['string', 'null'] },
      duration_minutes:        { bsonType: ['double', 'int', 'null'] },
      minimum_duration_minutes:{ bsonType: ['double', 'int'] },
      duration_compliant:      { bsonType: ['bool', 'null'] },
      parameters_compliant:    { bsonType: ['bool', 'null'] },
      residual_concentration_ppm: { bsonType: ['double', 'int', 'null'] },
      residual_tlv_compliant:  { bsonType: ['bool', 'null'] },
      operator_id:             { bsonType: ['string', 'null'] },
      operator_name:           { bsonType: ['string', 'null'] },
      operator_signed_at:      { bsonType: ['string', 'null'] },
      quality_inspector_id:    { bsonType: ['string', 'null'] },
      quality_inspector_name:  { bsonType: ['string', 'null'] },
      quality_signed_at:       { bsonType: ['string', 'null'] },
      certificate_pdf_url:     { bsonType: ['string', 'null'] },
      certificate_generated_at:{ bsonType: ['string', 'null'] },
      created_by:              { bsonType: 'string' },
      created_at:              { bsonType: 'string' },
      updated_at:              { bsonType: 'string' },
    },
  },
});

db.fumigation_cycles.createIndex({ cycle_number: 1 }, { unique: true, name: 'idx_cycle_number' });
db.fumigation_cycles.createIndex({ status: 1 },        { name: 'idx_status' });
db.fumigation_cycles.createIndex({ chamber: 1 },       { name: 'idx_chamber' });
db.fumigation_cycles.createIndex({ created_at: -1 },   { name: 'idx_created_at' });
db.fumigation_cycles.createIndex({ has_bio_lots: 1 },  { name: 'idx_bio' });
print('[IDX]  fumigation_cycles indexes created');

// ─── 2. fumigation_sensor_readings ─────────────────────────────────────────

ensureCollection('fumigation_sensor_readings', {
  $jsonSchema: {
    bsonType: 'object',
    required: ['cycle_id', 'read_at', 'door_locked', 'created_by'],
    properties: {
      cycle_id:                   { bsonType: 'string' },
      read_at:                    { bsonType: 'string' },
      concentration_p1_gm3:       { bsonType: ['double', 'int', 'null'] },
      concentration_p2_gm3:       { bsonType: ['double', 'int', 'null'] },
      concentration_p3_gm3:       { bsonType: ['double', 'int', 'null'] },
      concentration_p4_gm3:       { bsonType: ['double', 'int', 'null'] },
      concentration_avg_gm3:      { bsonType: ['double', 'int', 'null'] },
      temperature_t1_c:           { bsonType: ['double', 'int', 'null'] },
      temperature_t2_c:           { bsonType: ['double', 'int', 'null'] },
      temperature_t3_c:           { bsonType: ['double', 'int', 'null'] },
      temperature_t4_c:           { bsonType: ['double', 'int', 'null'] },
      temperature_t5_c:           { bsonType: ['double', 'int', 'null'] },
      temperature_t6_c:           { bsonType: ['double', 'int', 'null'] },
      humidity_h1_percent:        { bsonType: ['double', 'int', 'null'] },
      humidity_h2_percent:        { bsonType: ['double', 'int', 'null'] },
      pressure_differential_pa:   { bsonType: ['double', 'int', 'null'] },
      external_leak_ppm:          { bsonType: ['double', 'int', 'null'] },
      door_locked:                { bsonType: 'bool' },
      created_by:                 { bsonType: 'string' },
    },
  },
});

db.fumigation_sensor_readings.createIndex({ cycle_id: 1, read_at: 1 }, { name: 'idx_cycle_read_at' });
db.fumigation_sensor_readings.createIndex({ cycle_id: 1 },             { name: 'idx_cycle_id' });
db.fumigation_sensor_readings.createIndex({ read_at: -1 },             { name: 'idx_read_at' });
// Partial index for leak alerts — only indexes rows where leak > 0
db.fumigation_sensor_readings.createIndex(
  { external_leak_ppm: 1 },
  { name: 'idx_leak_ppm', partialFilterExpression: { external_leak_ppm: { $gt: 0 } } }
);
print('[IDX]  fumigation_sensor_readings indexes created');

// ─── 3. cleaning_cycles ───────────────────────────────────────────────────

ensureCollection('cleaning_cycles', {
  $jsonSchema: {
    bsonType: 'object',
    required: ['cycle_number', 'reception_id', 'lot_number', 'status', 'program', 'operator_name', 'started_at', 'created_by', 'created_at'],
    properties: {
      cycle_number:          { bsonType: 'string', description: 'NET-YYYYMMDD-SEQ' },
      reception_id:          { bsonType: 'string' },
      lot_number:            { bsonType: 'string' },
      variety:               { bsonType: ['string', 'null'] },
      status:                { enum: ['EN_COURS', 'TERMINE', 'INCIDENT'] },
      program:               { enum: ['A', 'B', 'C', 'D'] },
      program_forced_reason: { bsonType: ['string', 'null'] },
      weight_in_kg:          { bsonType: ['double', 'int', 'null'] },
      weight_out_kg:         { bsonType: ['double', 'int', 'null'] },
      yield_percent:         { bsonType: ['double', 'int', 'null'] },
      water_volume_liters:   { bsonType: ['double', 'int', 'null'] },
      water_recycled_percent:{ bsonType: ['double', 'int', 'null'] },
      water_temperature_c:   { bsonType: ['double', 'int', 'null'] },
      turbidity_ntu:         { bsonType: ['double', 'int', 'null'] },
      ph_water:              { bsonType: ['double', 'int', 'null'] },
      waste_weight_kg:       { bsonType: ['double', 'int', 'null'] },
      waste_category:        { enum: ['ORGANIQUE', 'INERTE', 'MAUVAISES_DATTES', null] },
      waste_photo_urls:      { bsonType: 'array' },
      started_at:            { bsonType: 'string' },
      ended_at:              { bsonType: ['string', 'null'] },
      operator_name:         { bsonType: 'string' },
      created_by:            { bsonType: 'string' },
      created_at:            { bsonType: 'string' },
      updated_at:            { bsonType: 'string' },
    },
  },
});

db.cleaning_cycles.createIndex({ cycle_number: 1 },  { unique: true, name: 'idx_cycle_number' });
db.cleaning_cycles.createIndex({ status: 1 },         { name: 'idx_status' });
db.cleaning_cycles.createIndex({ reception_id: 1 },   { name: 'idx_reception_id' });
db.cleaning_cycles.createIndex({ created_at: -1 },    { name: 'idx_created_at' });
// Partial index: alert-relevant rows with low yield
db.cleaning_cycles.createIndex(
  { yield_percent: 1 },
  { name: 'idx_yield', partialFilterExpression: { yield_percent: { $lt: 92 } } }
);
print('[IDX]  cleaning_cycles indexes created');

// ─── 4. hydration_cycles ──────────────────────────────────────────────────

ensureCollection('hydration_cycles', {
  $jsonSchema: {
    bsonType: 'object',
    required: ['cycle_number', 'chamber', 'status', 'program_suggested', 'program_applied', 'operator_name', 'started_at', 'created_by', 'created_at'],
    properties: {
      cycle_number:              { bsonType: 'string', description: 'HYD-HY01-YYYYMMDD-SEQ' },
      chamber:                   { enum: ['HY-01', 'HY-02', 'HY-03'] },
      lot_refs:                  { bsonType: 'array' },
      status:                    { enum: ['EN_COURS', 'TERMINE', 'NON_CONFORME'] },
      humidity_in_percent:       { bsonType: ['double', 'int', 'null'] },
      program_suggested:         { enum: ['HYD-LONG', 'HYD-COURT', 'SKIP', 'SEC-COURT', 'SEC-LONG'] },
      program_applied:           { enum: ['HYD-LONG', 'HYD-COURT', 'SKIP', 'SEC-COURT', 'SEC-LONG'] },
      program_override_reason:   { bsonType: ['string', 'null'] },
      temperature_t1_c:          { bsonType: ['double', 'int', 'null'] },
      temperature_t2_c:          { bsonType: ['double', 'int', 'null'] },
      air_humidity_percent:      { bsonType: ['double', 'int', 'null'] },
      steam_injected_kg:         { bsonType: ['double', 'int', 'null'] },
      energy_kwh:                { bsonType: ['double', 'int', 'null'] },
      humidity_out_1:            { bsonType: ['double', 'int', 'null'] },
      humidity_out_2:            { bsonType: ['double', 'int', 'null'] },
      humidity_out_3:            { bsonType: ['double', 'int', 'null'] },
      humidity_out_avg:          { bsonType: ['double', 'int', 'null'] },
      conformity:                { enum: ['VERT', 'JAUNE', 'ROUGE', null] },
      additional_cycle_count:    { bsonType: 'int' },
      non_conformity_action:     { enum: ['REFAIRE', 'ACCEPTER', 'REJETER', null] },
      started_at:                { bsonType: 'string' },
      ended_at:                  { bsonType: ['string', 'null'] },
      operator_name:             { bsonType: 'string' },
      inspector_name:            { bsonType: ['string', 'null'] },
      created_by:                { bsonType: 'string' },
      created_at:                { bsonType: 'string' },
      updated_at:                { bsonType: 'string' },
    },
  },
});

db.hydration_cycles.createIndex({ cycle_number: 1 },  { unique: true, name: 'idx_cycle_number' });
db.hydration_cycles.createIndex({ status: 1 },         { name: 'idx_status' });
db.hydration_cycles.createIndex({ chamber: 1 },        { name: 'idx_chamber' });
db.hydration_cycles.createIndex({ created_at: -1 },    { name: 'idx_created_at' });
db.hydration_cycles.createIndex({ conformity: 1 },     { name: 'idx_conformity' });
print('[IDX]  hydration_cycles indexes created');

// ─── 5. triage_sessions ───────────────────────────────────────────────────

ensureCollection('triage_sessions', {
  $jsonSchema: {
    bsonType: 'object',
    required: ['session_number', 'line', 'parent_reception_id', 'parent_lot_number', 'parent_weight_kg', 'status', 'worker_count', 'chef_ligne', 'tape_speed', 'started_at', 'created_by', 'created_at'],
    properties: {
      session_number:        { bsonType: 'string', description: 'TRI-L1-YYYYMMDD-SEQ' },
      line:                  { enum: ['L1', 'L2', 'L3', 'L4'] },
      parent_reception_id:   { bsonType: 'string' },
      parent_lot_number:     { bsonType: 'string' },
      variety:               { bsonType: ['string', 'null'] },
      parent_weight_kg:      { bsonType: ['double', 'int'] },
      status:                { enum: ['EN_COURS', 'PAUSE', 'TERMINE', 'INCIDENT'] },
      worker_count:          { bsonType: 'int', minimum: 1, maximum: 12 },
      worker_ids:            { bsonType: 'array' },
      chef_ligne:            { bsonType: 'string' },
      tape_speed:            { enum: ['LENT', 'STANDARD', 'RAPIDE'] },
      weight_extra_kg:       { bsonType: ['double', 'int'] },
      weight_cat1_kg:        { bsonType: ['double', 'int'] },
      weight_cat2_kg:        { bsonType: ['double', 'int'] },
      weight_reject_kg:      { bsonType: ['double', 'int'] },
      total_sorted_kg:       { bsonType: ['double', 'int'] },
      extra_percent:         { bsonType: ['double', 'int'] },
      cat1_percent:          { bsonType: ['double', 'int'] },
      cat2_percent:          { bsonType: ['double', 'int'] },
      reject_percent:        { bsonType: ['double', 'int'] },
      yield_kg_per_hour:     { bsonType: ['double', 'int', 'null'] },
      quality_score_percent: { bsonType: ['double', 'int', 'null'] },
      started_at:            { bsonType: 'string' },
      ended_at:              { bsonType: ['string', 'null'] },
      duration_minutes:      { bsonType: ['double', 'int', 'null'] },
      created_by:            { bsonType: 'string' },
      created_at:            { bsonType: 'string' },
      updated_at:            { bsonType: 'string' },
    },
  },
});

db.triage_sessions.createIndex({ session_number: 1 },       { unique: true, name: 'idx_session_number' });
db.triage_sessions.createIndex({ status: 1 },                { name: 'idx_status' });
db.triage_sessions.createIndex({ line: 1 },                  { name: 'idx_line' });
db.triage_sessions.createIndex({ parent_reception_id: 1 },   { name: 'idx_parent_reception' });
db.triage_sessions.createIndex({ created_at: -1 },           { name: 'idx_created_at' });
print('[IDX]  triage_sessions indexes created');

// ─── 6. triage_quality_checks ─────────────────────────────────────────────

ensureCollection('triage_quality_checks', {
  $jsonSchema: {
    bsonType: 'object',
    required: ['session_id', 'checked_at', 'inspector_name', 'sample_weight_kg', 'error_rate_percent'],
    properties: {
      session_id:          { bsonType: 'string' },
      checked_at:          { bsonType: 'string' },
      inspector_name:      { bsonType: 'string' },
      sample_weight_kg:    { bsonType: ['double', 'int'] },
      extra_error_count:   { bsonType: 'int' },
      cat1_error_count:    { bsonType: 'int' },
      cat2_error_count:    { bsonType: 'int' },
      reject_error_count:  { bsonType: 'int' },
      error_rate_percent:  { bsonType: ['double', 'int'] },
      notes:               { bsonType: ['string', 'null'] },
    },
  },
});

db.triage_quality_checks.createIndex({ session_id: 1, checked_at: 1 }, { name: 'idx_session_checked_at' });
db.triage_quality_checks.createIndex({ session_id: 1 },                { name: 'idx_session_id' });
// Partial index for low-quality checks that trigger AL-TRI-03
db.triage_quality_checks.createIndex(
  { error_rate_percent: 1 },
  { name: 'idx_error_rate', partialFilterExpression: { error_rate_percent: { $lt: 90 } } }
);
print('[IDX]  triage_quality_checks indexes created');

// ─── 7. triage_sublots ───────────────────────────────────────────────────

ensureCollection('triage_sublots', {
  $jsonSchema: {
    bsonType: 'object',
    required: ['session_id', 'parent_reception_id', 'parent_lot_number', 'grade', 'lot_number', 'weight_kg', 'percent_of_parent', 'destination', 'created_at'],
    properties: {
      session_id:           { bsonType: 'string' },
      parent_reception_id:  { bsonType: 'string' },
      parent_lot_number:    { bsonType: 'string' },
      grade:                { enum: ['EXTRA', 'CATEGORIE_I', 'CATEGORIE_II', 'REJETE'] },
      lot_number:           { bsonType: 'string', description: 'parent_lot_number + suffix (-EX/-C1/-C2/-RJ)' },
      weight_kg:            { bsonType: ['double', 'int'] },
      percent_of_parent:    { bsonType: ['double', 'int'] },
      destination:          { enum: ['CONDITIONNEMENT_PREMIUM', 'CONDITIONNEMENT_STANDARD', 'TRANSFORMATION', 'DESTRUCTION'] },
      qr_label_url:         { bsonType: ['string', 'null'] },
      created_at:           { bsonType: 'string' },
    },
  },
});

db.triage_sublots.createIndex({ lot_number: 1 },           { unique: true, name: 'idx_lot_number' });
db.triage_sublots.createIndex({ session_id: 1 },            { name: 'idx_session_id' });
db.triage_sublots.createIndex({ parent_reception_id: 1 },   { name: 'idx_parent_reception' });
db.triage_sublots.createIndex({ parent_lot_number: 1 },     { name: 'idx_parent_lot' });
db.triage_sublots.createIndex({ grade: 1 },                 { name: 'idx_grade' });
db.triage_sublots.createIndex({ destination: 1 },           { name: 'idx_destination' });
print('[IDX]  triage_sublots indexes created');

// ─── Summary ──────────────────────────────────────────────────────────────

print('');
print('=== Phase 2 collections ready ===');
const names = [
  'fumigation_cycles',
  'fumigation_sensor_readings',
  'cleaning_cycles',
  'hydration_cycles',
  'triage_sessions',
  'triage_quality_checks',
  'triage_sublots',
];
names.forEach((n) => {
  const info = db.getCollection(n).stats();
  print(`  ${n}: ${info.count ?? 0} docs, ${JSON.stringify(db.getCollection(n).getIndexes().map(i => i.name))}`);
});
