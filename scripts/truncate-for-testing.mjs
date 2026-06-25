/**
 * truncate-for-testing.mjs
 * Wipes all operational data for a clean test run.
 * KEEPS: profiles, user_roles, counters, storage_zones, storage_locations
 */

import { MongoClient } from "mongodb";

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://troudishedy6_db_user:vzd6ODtudvMUhzKh@cluster0.1kuiwta.mongodb.net/?appName=Cluster0";
const DB_NAME = process.env.MONGODB_DB_NAME || "date_harvest_hub";

// Collections to KEEP untouched
const KEEP = new Set([
  "auth_users",        // login credentials (passwords)
  "profiles",          // user profile data
  "user_roles",        // role assignments
  "counters",          // serial number state (reset separately below)
  "storage_zones",     // chambres de stockage physiques
  "storage_locations", // emplacements dans les zones
  "production_step_definitions", // step templates (config data)
  "site_settings",     // application config
]);

// Collections to KEEP but reset counters inside
const RESET_COUNTERS_ONLY = [];

// All operational collections to truncate
const TRUNCATE = [
  // Reception
  "receptions_v2",
  "reception_lots",
  "reception_units",
  "reception_alerts",
  "reception_stock_movements",
  "weighing_records",
  "qc_inspections",
  "quality_inspections",
  "qc_checklists",
  "qc_checklist_items",
  "qc_check_results",
  // Suppliers & materials
  "suppliers",
  "materials",
  // Batches / QC
  "batches",
  "batch_movements",
  "non_conformities",
  "alerts",
  // Stock
  "stock_lots",
  "stock_movements",
  "products",
  "shipment_preparations",
  "shipment_lines",
  "storage_condition_readings",
  "storage_cycle_counts",
  "storage_door_events",
  "storage_location_movements",
  // Production
  "production_orders",
  "production_steps",
  "production_lot_allocations",
  "production_output_lots",
  "flux_runs",
  "haccp_states",
  "triage_sessions",
  "triage_sublots",
  "triage_quality_checks",
  "quality_checks",
  "cleaning_cycles",
  // Packaging
  "packaging_orders",
  "packaging_palettes",
  "packaging_bom",
  "label_templates",
  "private_label_clients",
  // Fumigation / hydration
  "fumigation_cycles",
  "fumigation_sensor_readings",
  "hydration_cycles",
  // Purchasing / P2P
  "purchase_requisitions",
  "purchase_orders",
  "purchase_order_lines",
  "purchase_order_receipt_logs",
  "purchase_order_receiving_lots",
  // Transport
  "transport_missions",
  "transport_vehicles",
  "transport_drivers",
  "transport_position_logs",
  // HR
  "employees",
  "timesheets",
  "employee_tasks",
  // Traceability
  "epcis_events",
  "system_audit_logs",
  "system_notifications",
  // Misc
  "material_receptions",
  "inventory_counts",
  "stock_alerts",
  "stock_locations",
];

async function main() {
  console.log("🔌 Connecting to MongoDB Atlas...");
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    console.log(`📦 Database: ${DB_NAME}`);
    console.log(`🔒 Keeping: ${[...KEEP].join(", ")}\n`);

    // List all collections actually in the DB
    const existing = (await db.listCollections().toArray()).map((c) => c.name);
    console.log(`📋 Collections in DB: ${existing.join(", ")}\n`);

    let truncated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const col of TRUNCATE) {
      if (KEEP.has(col)) {
        console.log(`  ⏭  SKIP (protected): ${col}`);
        skipped++;
        continue;
      }
      if (!existing.includes(col)) {
        console.log(`  ○  NOT FOUND (skip): ${col}`);
        notFound++;
        continue;
      }
      const result = await db.collection(col).deleteMany({});
      console.log(`  ✓  TRUNCATED: ${col} — ${result.deletedCount} docs deleted`);
      truncated++;
    }

    // Also truncate any collection in the DB that's not in KEEP and not in TRUNCATE list
    // (catch stray collections from testing etc.)
    const unlistedToTruncate = existing.filter(
      (c) => !KEEP.has(c) && !TRUNCATE.includes(c),
    );
    if (unlistedToTruncate.length > 0) {
      console.log("\n⚠️  Unlisted collections found in DB (also truncating):");
      for (const col of unlistedToTruncate) {
        const result = await db.collection(col).deleteMany({});
        console.log(`  ✓  TRUNCATED (unlisted): ${col} — ${result.deletedCount} docs deleted`);
        truncated++;
      }
    }

    // Reset counters — keep scopes but zero them so serials restart from 1
    const counterCount = await db.collection("counters").countDocuments();
    if (counterCount > 0) {
      await db.collection("counters").updateMany({}, { $set: { value: 0 } });
      console.log(`\n🔢 Reset ${counterCount} counter(s) → value=0 (serial numbers restart from 1)`);
    }

    // Reset storage_locations occupancy to empty
    const locResult = await db.collection("storage_locations").updateMany(
      {},
      { $set: { current_weight_kg: 0, lot_id: null, lot_internal: null, occupied: false } },
    );
    console.log(`\n🗄️  Reset ${locResult.modifiedCount} storage_locations → empty`);

    console.log(`\n✅ Done.`);
    console.log(`   Truncated: ${truncated} collections`);
    console.log(`   Skipped (protected): ${skipped}`);
    console.log(`   Not in DB: ${notFound}`);
    console.log(`\n📌 Kept intact: profiles, user_roles, storage_zones, storage_locations (contents emptied, zones kept)`);

  } finally {
    await client.close();
    console.log("🔌 Disconnected.");
  }
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
