import { randomUUID } from "node:crypto";
import { getCollectionModel, sanitizeDocument } from "./dynamic-model.js";
import { normalizeSupplierDocument } from "../modules/suppliers/supplier-domain.js";
const nowDate = () => new Date().toISOString();
const nextSequence = async (scope) => {
    const Counter = getCollectionModel("counters");
    const counter = await Counter.findOneAndUpdate({ scope }, { $inc: { value: 1 }, $setOnInsert: { scope } }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true })
        .lean()
        .exec();
    return Number(counter?.value || 1);
};
const nextSerial = async (prefix, scope = prefix) => {
    const sequence = await nextSequence(scope);
    return `${prefix}-${String(sequence).padStart(4, "0")}`;
};
const nextDailyNumber = async (prefix) => {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const sequence = await nextSequence(`${prefix}-${day}`);
    return `${prefix}-${day}-${String(sequence).padStart(4, "0")}`;
};
const nextStorageMovementNumber = async () => {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const sequence = await nextSequence(`MV-${day}`);
    return `MV${day}-${String(sequence).padStart(4, "0")}`;
};
export const prepareInsertDocument = async (collection, rawInput) => {
    const now = nowDate();
    const doc = sanitizeDocument({ ...rawInput });
    doc.id = String(doc.id || randomUUID());
    doc.created_at = String(doc.created_at || now);
    doc.updated_at = now;
    if (collection === "profiles") {
        doc.avatar_url = doc.avatar_url ?? null;
        doc.phone = doc.phone ?? null;
    }
    if (collection === "user_roles") {
        doc.assigned_at = doc.assigned_at || now;
    }
    if (collection === "suppliers") {
        doc.code = doc.code || (await nextSerial("SUP", "SUPPLIER"));
        doc.country = doc.country || "Tunisie";
        doc.is_active = doc.is_active ?? true;
        doc.supplier_status = doc.supplier_status || "active";
        doc.produced_varieties = Array.isArray(doc.produced_varieties) && doc.produced_varieties.length > 0 ? doc.produced_varieties : ["Deglet Nour"];
        Object.assign(doc, normalizeSupplierDocument(doc));
    }
    if (collection === "materials") {
        doc.code = doc.code || (await nextSerial("MAT", "MATERIAL"));
        doc.unit = doc.unit || "kg";
        doc.min_stock = Number(doc.min_stock ?? 0);
        doc.is_active = doc.is_active ?? true;
    }
    if (collection === "employees") {
        doc.employee_number = doc.employee_number || (await nextSerial("EMP", "EMPLOYEE"));
        doc.status = doc.status || "active";
        doc.hire_date = doc.hire_date || now.slice(0, 10);
    }
    if (collection === "timesheets") {
        doc.status = doc.status || "draft";
        doc.break_minutes = Number(doc.break_minutes ?? 0);
        doc.submitted_at = doc.submitted_at ?? null;
        doc.approved_at = doc.approved_at ?? null;
        doc.approved_by = doc.approved_by ?? null;
        doc.rejection_reason = doc.rejection_reason ?? null;
        doc.task_description = doc.task_description ?? null;
        doc.project_reference = doc.project_reference ?? null;
        doc.operation_module = doc.operation_module ?? null;
        doc.operation_id = doc.operation_id ?? null;
        doc.notes = doc.notes ?? null;
        doc.end_time = doc.end_time ?? null;
        // compute hours_worked
        if (doc.start_time && doc.end_time) {
            const [sh, sm] = doc.start_time.split(":").map(Number);
            const [eh, em] = doc.end_time.split(":").map(Number);
            const worked = (eh * 60 + em) - (sh * 60 + sm) - Number(doc.break_minutes ?? 0);
            doc.hours_worked = Math.round(Math.max(0, worked) * 100) / 100 / 60;
        }
        else {
            doc.hours_worked = null;
        }
    }
    if (collection === "employee_tasks") {
        doc.status = doc.status || "pending";
        doc.priority = doc.priority || "medium";
        doc.description = doc.description ?? null;
        doc.assigned_to = doc.assigned_to ?? null;
        doc.assigned_by = doc.assigned_by ?? null;
        doc.due_date = doc.due_date ?? null;
        doc.completed_at = doc.completed_at ?? null;
        doc.department = doc.department ?? null;
        doc.related_batch_id = doc.related_batch_id ?? null;
        doc.related_production_order_id = doc.related_production_order_id ?? null;
        doc.notes = doc.notes ?? null;
    }
    if (collection === "weighing_records") {
        doc.lot_id = doc.lot_id ?? null;
        doc.reception_id = doc.reception_id ?? null;
        doc.type = doc.type || "GROSS"; // GROSS | TARE
        doc.weight_kg = Number(doc.weight_kg ?? 0);
        doc.source = doc.source || "MANUAL"; // MANUAL | SCALE
        doc.device_ref = doc.device_ref ?? null;
        doc.supervisor = doc.supervisor ?? null;
        doc.recorded_by = doc.recorded_by ?? null;
        doc.notes = doc.notes ?? null;
    }
    if (collection === "epcis_events") {
        doc.event_type = doc.event_type || "ObjectEvent";
        doc.event_time = doc.event_time || now;
        doc.event_time_zone_offset = doc.event_time_zone_offset || "+01:00";
        doc.biz_step = doc.biz_step ?? null;
        doc.disposition = doc.disposition ?? null;
        doc.epc_list = Array.isArray(doc.epc_list) ? doc.epc_list : [];
        doc.read_point = doc.read_point ?? null;
        doc.biz_location = doc.biz_location ?? null;
        doc.actor_id = doc.actor_id ?? null;
        doc.entity_type = doc.entity_type ?? null;
        doc.entity_id = doc.entity_id ?? null;
        doc.metadata = doc.metadata ?? {};
    }
    if (collection === "products") {
        doc.code = doc.code || (await nextSerial("PROD", "PRODUCT"));
        doc.unit = doc.unit || "kg";
        doc.rotation_rule = doc.rotation_rule || "FIFO";
        doc.is_active = doc.is_active ?? true;
        doc.threshold_min = Number(doc.threshold_min ?? 0);
        doc.threshold_security = Number(doc.threshold_security ?? doc.threshold_min ?? 0);
        doc.threshold_max = doc.threshold_max ?? null;
    }
    if (collection === "stock_locations") {
        doc.code = doc.code || (await nextSerial("LOC", "LOCATION"));
        doc.current_load_kg = Number(doc.current_load_kg ?? 0);
        doc.current_load_units = Number(doc.current_load_units ?? 0);
        doc.capacity_kg = Number(doc.capacity_kg ?? 0);
        doc.capacity_units = Number(doc.capacity_units ?? 0);
        doc.is_active = doc.is_active ?? true;
        doc.is_cold = doc.is_cold ?? false;
        doc.is_dry = doc.is_dry ?? true;
    }
    if (collection === "storage_zones") {
        doc.code = doc.code || (await nextSerial("ZONE", "STORAGE_ZONE"));
        doc.name = doc.name || doc.code;
        doc.zone_type = doc.zone_type || "ventilated";
        doc.storage_family = doc.storage_family || "raw";
        doc.capacity_palettes = Number(doc.capacity_palettes ?? 0);
        doc.current_load_palettes = Number(doc.current_load_palettes ?? 0);
        doc.capacity_kg = Number(doc.capacity_kg ?? 0);
        doc.current_load_kg = Number(doc.current_load_kg ?? 0);
        doc.temperature_min = doc.temperature_min ?? null;
        doc.temperature_max = doc.temperature_max ?? null;
        doc.humidity_min = doc.humidity_min ?? null;
        doc.humidity_max = doc.humidity_max ?? null;
        doc.temperature_sensor_count = Number(doc.temperature_sensor_count ?? 0);
        doc.humidity_sensor_count = Number(doc.humidity_sensor_count ?? 0);
        doc.gas_sensor_count = Number(doc.gas_sensor_count ?? 0);
        doc.is_bio_only = doc.is_bio_only ?? false;
        doc.allowed_varieties = Array.isArray(doc.allowed_varieties) ? doc.allowed_varieties : [];
        doc.condition_status = doc.condition_status || "normal";
        doc.is_active = doc.is_active ?? true;
    }
    if (collection === "storage_locations") {
        doc.code = doc.code || (await nextSerial("SLOC", "STORAGE_LOCATION"));
        doc.name = doc.name || doc.code;
        doc.zone_code = doc.zone_code || null;
        doc.storage_zone_id = doc.storage_zone_id || null;
        doc.capacity_palettes = Number(doc.capacity_palettes ?? 1);
        doc.occupied_palettes = Number(doc.occupied_palettes ?? 0);
        doc.capacity_kg = Number(doc.capacity_kg ?? 0);
        doc.occupied_kg = Number(doc.occupied_kg ?? 0);
        doc.location_status = doc.location_status || "free";
        doc.lot_ids_present = Array.isArray(doc.lot_ids_present) ? doc.lot_ids_present : [];
        doc.last_movement_at = doc.last_movement_at ?? null;
        doc.current_temperature_c = doc.current_temperature_c ?? null;
        doc.current_humidity_percent = doc.current_humidity_percent ?? null;
        doc.current_gas_ppm = doc.current_gas_ppm ?? null;
        doc.door_distance_rank = Number(doc.door_distance_rank ?? 999);
        doc.preferred_variety = doc.preferred_variety ?? null;
        doc.is_active = doc.is_active ?? true;
    }
    if (collection === "storage_condition_readings") {
        doc.reading_number = doc.reading_number || (await nextDailyNumber("COND"));
        doc.reading_at = doc.reading_at || now;
        doc.condition_status = doc.condition_status || "normal";
        doc.messages = Array.isArray(doc.messages) ? doc.messages : [];
    }
    if (collection === "storage_location_movements") {
        doc.movement_number = doc.movement_number || (await nextStorageMovementNumber());
        doc.movement_date = doc.movement_date || now;
        doc.movement_type = doc.movement_type || "TRANSFERT";
        doc.quantity_palettes = Number(doc.quantity_palettes ?? 0);
        doc.quantity_kg = Number(doc.quantity_kg ?? 0);
    }
    if (collection === "storage_door_events") {
        doc.event_number = doc.event_number || (await nextDailyNumber("DOOR"));
        doc.event_at = doc.event_at || now;
        doc.event_type = doc.event_type || "OPEN";
    }
    if (collection === "storage_cycle_counts") {
        doc.count_number = doc.count_number || (await nextDailyNumber("CC"));
        doc.scheduled_for = doc.scheduled_for || now.slice(0, 10);
        doc.status = doc.status || "scheduled";
        doc.variance_report = doc.variance_report || null;
    }
    if (collection === "purchase_requisitions") {
        doc.requisition_number = doc.requisition_number || (await nextDailyNumber("DA"));
        doc.status = doc.status || "draft";
    }
    if (collection === "purchase_orders") {
        doc.order_number = doc.order_number || (await nextDailyNumber("BC"));
        doc.status = doc.status || "draft";
        doc.order_date = doc.order_date || now.slice(0, 10);
        doc.currency = doc.currency || "TND";
        doc.invoice_status = doc.invoice_status || "not_invoiced";
        doc.receipt_status = doc.receipt_status || "not_received";
        doc.supplier_reference = doc.supplier_reference ?? null;
        doc.delivery_site = doc.delivery_site ?? null;
        doc.incoterm = doc.incoterm ?? null;
        doc.buyer_name = doc.buyer_name ?? doc.created_by ?? null;
        doc.approval_threshold = Number(doc.approval_threshold ?? 5000);
        doc.approval_required = doc.approval_required ?? Number(doc.total_amount ?? 0) >= Number(doc.approval_threshold ?? 5000);
        doc.goods_receipt_count = Number(doc.goods_receipt_count ?? 0);
        doc.line_count = Number(doc.line_count ?? 0);
        doc.submitted_at = doc.submitted_at ?? null;
        doc.delivered_at = doc.delivered_at ?? null;
        doc.invoiced_at = doc.invoiced_at ?? null;
        doc.invoice_number = doc.invoice_number ?? null;
        doc.invoice_date = doc.invoice_date ?? null;
        doc.invoice_amount = doc.invoice_amount ?? null;
    }
    if (collection === "purchase_order_lines") {
        doc.quantity = Number(doc.quantity ?? 0);
        doc.confirmed_quantity = Number(doc.confirmed_quantity ?? doc.quantity ?? 0);
        doc.received_quantity = Number(doc.received_quantity ?? 0);
        doc.accepted_quantity = Number(doc.accepted_quantity ?? 0);
        doc.rejected_quantity = Number(doc.rejected_quantity ?? 0);
        doc.invoiced_quantity = Number(doc.invoiced_quantity ?? 0);
        doc.unit_price = Number(doc.unit_price ?? 0);
        doc.total_price = Number(doc.total_price ?? doc.quantity) * Number(doc.unit_price ?? 0);
        doc.over_delivery_tolerance_pct = Number(doc.over_delivery_tolerance_pct ?? 0);
        doc.under_delivery_tolerance_pct = Number(doc.under_delivery_tolerance_pct ?? 100);
        doc.line_status = doc.line_status || "open";
        doc.last_reception_id = doc.last_reception_id ?? doc.reception_id ?? null;
        doc.last_received_at = doc.last_received_at ?? null;
        doc.last_supplier_lot = doc.last_supplier_lot ?? null;
    }
    if (collection === "purchase_order_receiving_lots") {
        doc.received_quantity = Number(doc.received_quantity ?? 0);
        doc.accepted_quantity = Number(doc.accepted_quantity ?? 0);
        doc.rejected_quantity = Number(doc.rejected_quantity ?? 0);
        doc.qc_outcome = doc.qc_outcome || "pending_qc";
        doc.unit = doc.unit || "kg";
        doc.received_at = doc.received_at || now;
    }
    if (collection === "material_receptions") {
        doc.reception_number = doc.reception_number || (await nextDailyNumber("REC"));
        doc.status = doc.status || "pending";
        doc.received_at = doc.received_at || now;
    }
    if (collection === "receptions_v2") {
        const incomingNumber = String(doc.reception_number || "");
        doc.reception_number = !incomingNumber || incomingNumber.startsWith("REC-TEMP") ? await nextDailyNumber("REC") : incomingNumber;
        doc.site_id = doc.site_id || "default-site";
        doc.actual_arrival_date = doc.actual_arrival_date || now;
        doc.status = doc.status || "BROUILLON";
        doc.qc_decision = doc.qc_decision ?? null;
        doc.quantity_total = Number(doc.quantity_total ?? 0);
        doc.unit = doc.unit || "kg";
    }
    if (collection === "reception_lots") {
        doc.lot_internal = doc.lot_internal || (await nextSerial("LOT", "RECEPTION_LOT"));
        doc.origin_country = doc.origin_country || "Tunisie";
        doc.stock_status = doc.stock_status || "EN_QUARANTAINE";
        doc.quantity = Number(doc.quantity ?? 0);
        doc.unit = doc.unit || "kg";
        doc.qr_code_payload = doc.qr_code_payload || String(doc.lot_internal);
        doc.child_lot_ids = Array.isArray(doc.child_lot_ids) ? doc.child_lot_ids : [];
    }
    if (collection === "reception_units") {
        doc.barcode = doc.barcode || (await nextSerial("UNIT", "RECEPTION_UNIT"));
        doc.sscc = doc.sscc ?? null;
        doc.unit_status = doc.unit_status || "EN_QUARANTAINE";
        doc.quantity = Number(doc.quantity ?? 0);
        doc.unit = doc.unit || "kg";
        doc.qr_code_payload = doc.qr_code_payload || String(doc.barcode);
        doc.qr_label_text = doc.qr_label_text || `${doc.barcode} | ${doc.quantity} ${doc.unit}`;
        doc.label_printed_at = doc.label_printed_at ?? null;
        doc.label_printed_by = doc.label_printed_by ?? null;
    }
    if (collection === "qc_checklists") {
        doc.version = Number(doc.version ?? 1);
        doc.is_active = doc.is_active ?? true;
    }
    if (collection === "qc_checklist_items") {
        doc.sequence_order = Number(doc.sequence_order ?? 1);
        doc.is_active = doc.is_active ?? true;
    }
    if (collection === "qc_inspections") {
        doc.inspection_number = doc.inspection_number || (await nextDailyNumber("QC"));
        doc.started_at = doc.started_at || now;
        doc.ended_at = doc.ended_at ?? null;
        doc.decision = doc.decision ?? null;
        doc.lab_sample_required = doc.lab_sample_required ?? false;
        const emptyCritere = { test1: null, test2: null, test3: null, taux_moyen: null };
        doc.rqc = doc.rqc ?? {
            conventionnel: false, bio_certifie: false, ggp: false,
            bon_de_reception_ref: null,
            poids_echantillon_branche_kg: null, poids_tb_kg: null, taux_tb_percent: null,
            poids_vrac_kg: null,
            type_dattes_branche: true, type_dattes_vrac: false,
            infestee: { ...emptyCritere }, fermentee: { ...emptyCritere },
            immature: { ...emptyCritere }, craquellee: { ...emptyCritere },
            grasse: { ...emptyCritere }, seche: { ...emptyCritere },
            tachee: { ...emptyCritere }, ridee: { ...emptyCritere },
            petit_calibre: { ...emptyCritere },
            taux_dechet_percent: null, endommage_percent: null,
            db_score: null, td_percent: null, conclusion: null,
            responsable_qc1: null, responsable_qc2: null, directeur_qc: null,
        };
    }
    if (collection === "qc_check_results") {
        doc.checked_at = doc.checked_at || now;
    }
    if (collection === "packaging_bom") {
        doc.is_active = doc.is_active ?? true;
        doc.net_weight_g = Number(doc.net_weight_g ?? 0);
        doc.gross_weight_g = Number(doc.gross_weight_g ?? 0);
        doc.boxes_per_layer = Number(doc.boxes_per_layer ?? 0);
        doc.layers_per_palette = Number(doc.layers_per_palette ?? 0);
        doc.is_private_label = doc.is_private_label ?? false;
        doc.label_template_id = doc.label_template_id ?? null;
        doc.label_template_name = doc.label_template_name ?? null;
        doc.private_label_client_id = doc.private_label_client_id ?? null;
        doc.private_label_client_name = doc.private_label_client_name ?? null;
    }
    if (collection === "label_templates") {
        doc.status = doc.status || "BROUILLON";
        doc.approved_by = doc.approved_by ?? null;
        doc.approved_at = doc.approved_at ?? null;
        doc.is_active = doc.is_active ?? false;
        doc.client_name = doc.client_name ?? null;
        doc.variety = doc.variety ?? null;
        doc.allergens = doc.allergens ?? null;
        doc.gtin = doc.gtin ?? null;
        doc.net_weight_g = Number(doc.net_weight_g ?? 0);
        doc.use_by_days = Number(doc.use_by_days ?? 0);
    }
    if (collection === "private_label_clients") {
        doc.active = doc.active ?? true;
        doc.contact_name = doc.contact_name ?? null;
        doc.contact_email = doc.contact_email ?? null;
    }
    if (collection === "packaging_orders") {
        doc.status = doc.status || "PLANIFIE";
        doc.target_units = Number(doc.target_units ?? 0);
        doc.produced_units = Number(doc.produced_units ?? 0);
        doc.rejected_units = Number(doc.rejected_units ?? 0);
        doc.checkweigher_count = Number(doc.checkweigher_count ?? 0);
        doc.checkweigher_failures = Number(doc.checkweigher_failures ?? 0);
        doc.metal_detector_failures = Number(doc.metal_detector_failures ?? 0);
        doc.worker_count = Number(doc.worker_count ?? 0);
        doc.started_at = doc.started_at ?? null;
        doc.ended_at = doc.ended_at ?? null;
        doc.duration_minutes = doc.duration_minutes ?? null;
        doc.chef_ligne = doc.chef_ligne ?? null;
    }
    if (collection === "packaging_palettes") {
        doc.status = doc.status || "EN_COURS";
        doc.box_count = Number(doc.box_count ?? 0);
        doc.gross_weight_kg = Number(doc.gross_weight_kg ?? 0);
        doc.net_weight_kg = Number(doc.net_weight_kg ?? 0);
        doc.seal_number = doc.seal_number ?? null;
        doc.sealed_by = doc.sealed_by ?? null;
        doc.sealed_at = doc.sealed_at ?? null;
        doc.sscc = doc.sscc ?? null;
        doc.storage_location_id = doc.storage_location_id ?? null;
    }
    if (collection === "fumigation_cycles") {
        doc.status = doc.status || "PREPARATION";
        doc.lot_refs = Array.isArray(doc.lot_refs) ? doc.lot_refs : [];
        doc.total_weight_kg = Number(doc.total_weight_kg ?? 0);
        doc.fill_rate_percent = Number(doc.fill_rate_percent ?? 0);
        doc.has_bio_lots = doc.has_bio_lots ?? false;
        doc.dose_calculated_g = doc.dose_calculated_g ?? null;
        doc.dose_applied_g = doc.dose_applied_g ?? null;
        doc.dose_variance_percent = doc.dose_variance_percent ?? null;
        doc.product_lot_number = doc.product_lot_number ?? null;
        doc.product_expiry_date = doc.product_expiry_date ?? null;
        doc.photo_disposition_urls = Array.isArray(doc.photo_disposition_urls) ? doc.photo_disposition_urls : [];
        doc.t0_start = doc.t0_start ?? null;
        doc.t_end_real = doc.t_end_real ?? null;
        doc.duration_minutes = doc.duration_minutes ?? null;
        doc.minimum_duration_minutes = Number(doc.minimum_duration_minutes ?? 0);
        doc.duration_compliant = doc.duration_compliant ?? null;
        doc.parameters_compliant = doc.parameters_compliant ?? null;
        doc.residual_concentration_ppm = doc.residual_concentration_ppm ?? null;
        doc.residual_tlv_compliant = doc.residual_tlv_compliant ?? null;
        doc.operator_id = doc.operator_id ?? null;
        doc.operator_name = doc.operator_name ?? null;
        doc.operator_signed_at = doc.operator_signed_at ?? null;
        doc.quality_inspector_id = doc.quality_inspector_id ?? null;
        doc.quality_inspector_name = doc.quality_inspector_name ?? null;
        doc.quality_signed_at = doc.quality_signed_at ?? null;
        doc.certificate_pdf_url = doc.certificate_pdf_url ?? null;
        doc.certificate_generated_at = doc.certificate_generated_at ?? null;
    }
    if (collection === "fumigation_sensor_readings") {
        doc.read_at = doc.read_at || now;
        doc.concentration_p1_gm3 = doc.concentration_p1_gm3 ?? null;
        doc.concentration_p2_gm3 = doc.concentration_p2_gm3 ?? null;
        doc.concentration_p3_gm3 = doc.concentration_p3_gm3 ?? null;
        doc.concentration_p4_gm3 = doc.concentration_p4_gm3 ?? null;
        doc.concentration_avg_gm3 = doc.concentration_avg_gm3 ?? null;
        doc.temperature_t1_c = doc.temperature_t1_c ?? null;
        doc.temperature_t2_c = doc.temperature_t2_c ?? null;
        doc.temperature_t3_c = doc.temperature_t3_c ?? null;
        doc.temperature_t4_c = doc.temperature_t4_c ?? null;
        doc.temperature_t5_c = doc.temperature_t5_c ?? null;
        doc.temperature_t6_c = doc.temperature_t6_c ?? null;
        doc.humidity_h1_percent = doc.humidity_h1_percent ?? null;
        doc.humidity_h2_percent = doc.humidity_h2_percent ?? null;
        doc.pressure_differential_pa = doc.pressure_differential_pa ?? null;
        doc.external_leak_ppm = doc.external_leak_ppm ?? null;
        doc.door_locked = doc.door_locked ?? true;
        doc.created_by = doc.created_by ?? "system";
    }
    if (collection === "cleaning_cycles") {
        doc.status = doc.status || "EN_COURS";
        doc.program_forced_reason = doc.program_forced_reason ?? null;
        doc.variety = doc.variety ?? null;
        doc.weight_in_kg = doc.weight_in_kg ?? null;
        doc.weight_out_kg = doc.weight_out_kg ?? null;
        doc.yield_percent = doc.yield_percent ?? null;
        doc.water_volume_liters = doc.water_volume_liters ?? null;
        doc.water_recycled_percent = doc.water_recycled_percent ?? null;
        doc.water_temperature_c = doc.water_temperature_c ?? null;
        doc.turbidity_ntu = doc.turbidity_ntu ?? null;
        doc.ph_water = doc.ph_water ?? null;
        doc.waste_weight_kg = doc.waste_weight_kg ?? null;
        doc.waste_category = doc.waste_category ?? null;
        doc.waste_photo_urls = Array.isArray(doc.waste_photo_urls) ? doc.waste_photo_urls : [];
        doc.ended_at = doc.ended_at ?? null;
    }
    if (collection === "hydration_cycles") {
        doc.status = doc.status || "EN_COURS";
        doc.lot_refs = Array.isArray(doc.lot_refs) ? doc.lot_refs : [];
        doc.humidity_in_percent = doc.humidity_in_percent ?? null;
        doc.program_override_reason = doc.program_override_reason ?? null;
        doc.temperature_t1_c = doc.temperature_t1_c ?? null;
        doc.temperature_t2_c = doc.temperature_t2_c ?? null;
        doc.air_humidity_percent = doc.air_humidity_percent ?? null;
        doc.steam_injected_kg = doc.steam_injected_kg ?? null;
        doc.energy_kwh = doc.energy_kwh ?? null;
        doc.humidity_out_1 = doc.humidity_out_1 ?? null;
        doc.humidity_out_2 = doc.humidity_out_2 ?? null;
        doc.humidity_out_3 = doc.humidity_out_3 ?? null;
        doc.humidity_out_avg = doc.humidity_out_avg ?? null;
        doc.conformity = doc.conformity ?? null;
        doc.additional_cycle_count = Number(doc.additional_cycle_count ?? 0);
        doc.non_conformity_action = doc.non_conformity_action ?? null;
        doc.ended_at = doc.ended_at ?? null;
        doc.inspector_name = doc.inspector_name ?? null;
    }
    if (collection === "triage_sessions") {
        doc.status = doc.status || "EN_COURS";
        doc.variety = doc.variety ?? null;
        doc.parent_weight_kg = Number(doc.parent_weight_kg ?? 0);
        doc.worker_count = Number(doc.worker_count ?? 0);
        doc.worker_ids = Array.isArray(doc.worker_ids) ? doc.worker_ids : [];
        doc.weight_extra_kg = Number(doc.weight_extra_kg ?? 0);
        doc.weight_cat1_kg = Number(doc.weight_cat1_kg ?? 0);
        doc.weight_cat2_kg = Number(doc.weight_cat2_kg ?? 0);
        doc.weight_reject_kg = Number(doc.weight_reject_kg ?? 0);
        doc.total_sorted_kg = Number(doc.total_sorted_kg ?? 0);
        doc.extra_percent = Number(doc.extra_percent ?? 0);
        doc.cat1_percent = Number(doc.cat1_percent ?? 0);
        doc.cat2_percent = Number(doc.cat2_percent ?? 0);
        doc.reject_percent = Number(doc.reject_percent ?? 0);
        doc.yield_kg_per_hour = doc.yield_kg_per_hour ?? null;
        doc.quality_score_percent = doc.quality_score_percent ?? null;
        doc.ended_at = doc.ended_at ?? null;
        doc.duration_minutes = doc.duration_minutes ?? null;
    }
    if (collection === "triage_quality_checks") {
        doc.checked_at = doc.checked_at || now;
        doc.sample_weight_kg = Number(doc.sample_weight_kg ?? 0);
        doc.extra_error_count = Number(doc.extra_error_count ?? 0);
        doc.cat1_error_count = Number(doc.cat1_error_count ?? 0);
        doc.cat2_error_count = Number(doc.cat2_error_count ?? 0);
        doc.reject_error_count = Number(doc.reject_error_count ?? 0);
        doc.error_rate_percent = Number(doc.error_rate_percent ?? 0);
        doc.notes = doc.notes ?? null;
    }
    if (collection === "triage_sublots") {
        doc.weight_kg = Number(doc.weight_kg ?? 0);
        doc.percent_of_parent = Number(doc.percent_of_parent ?? 0);
        doc.destination = doc.destination ?? null;
        doc.qr_label_url = doc.qr_label_url ?? null;
    }
    if (collection === "stock_lots") {
        doc.lot_number = doc.lot_number || (await nextDailyNumber("STK"));
        doc.reception_date = doc.reception_date || now;
        doc.origin_country = doc.origin_country || "Tunisie";
        doc.initial_quantity = Number(doc.initial_quantity ?? doc.current_quantity ?? 0);
        doc.current_quantity = Number(doc.current_quantity ?? doc.initial_quantity ?? 0);
        doc.unit = doc.unit || "kg";
        doc.status = doc.status || "QUARANTINE";
    }
    if (collection === "stock_movements") {
        doc.movement_number = doc.movement_number || (await nextDailyNumber("MOV"));
        doc.movement_date = doc.movement_date || now;
        doc.quantity = Number(doc.quantity ?? 0);
        doc.unit = doc.unit || "kg";
    }
    if (collection === "stock_alerts") {
        doc.status = doc.status || "active";
        doc.severity = doc.severity || "warning";
    }
    if (collection === "inventory_counts") {
        doc.inventory_number = doc.inventory_number || (await nextDailyNumber("INV"));
        doc.inventory_date = doc.inventory_date || now.slice(0, 10);
        doc.expected_quantity = Number(doc.expected_quantity ?? 0);
        doc.counted_quantity = Number(doc.counted_quantity ?? 0);
        const variance = Number(doc.counted_quantity) - Number(doc.expected_quantity);
        doc.variance = variance;
        doc.variance_percent = Number(doc.expected_quantity) === 0 ? 0 : Math.round((variance / Number(doc.expected_quantity)) * 10000) / 100;
        doc.adjustment_approved = doc.adjustment_approved ?? false;
    }
    if (collection === "shipment_preparations") {
        doc.shipment_number = doc.shipment_number || (await nextDailyNumber("SHP"));
        doc.status = doc.status || "DRAFT";
    }
    if (collection === "shipment_lines") {
        doc.picked_quantity = Number(doc.picked_quantity ?? 0);
        doc.requested_quantity = Number(doc.requested_quantity ?? 0);
        doc.suggested_by_system = doc.suggested_by_system ?? false;
        doc.unit = doc.unit || "kg";
    }
    if (collection === "transport_vehicles") {
        doc.vehicle_code = doc.vehicle_code || (await nextSerial("TRK", "TRANSPORT_VEHICLE"));
        doc.status = doc.status || "AVAILABLE";
        doc.capacity_kg = Number(doc.capacity_kg ?? 0);
        doc.last_position_at = doc.last_position_at ?? null;
        doc.last_latitude = doc.last_latitude ?? null;
        doc.last_longitude = doc.last_longitude ?? null;
        doc.last_speed_kmh = doc.last_speed_kmh ?? null;
        doc.is_active = doc.is_active ?? true;
    }
    if (collection === "transport_drivers") {
        doc.driver_code = doc.driver_code || (await nextSerial("DRV", "TRANSPORT_DRIVER"));
        doc.status = doc.status || "AVAILABLE";
        doc.phone = doc.phone ?? null;
        doc.license_number = doc.license_number ?? null;
        doc.license_expiry_date = doc.license_expiry_date ?? null;
        doc.is_active = doc.is_active ?? true;
    }
    if (collection === "transport_missions") {
        doc.mission_number = doc.mission_number || (await nextDailyNumber("MIS"));
        doc.mission_type = doc.mission_type || "DELIVERY";
        doc.status = doc.status || "PLANNED";
        doc.origin_label = doc.origin_label ?? null;
        doc.destination_label = doc.destination_label ?? null;
        doc.destination_address = doc.destination_address ?? null;
        doc.planned_departure_at = doc.planned_departure_at ?? null;
        doc.planned_arrival_at = doc.planned_arrival_at ?? null;
        doc.actual_departure_at = doc.actual_departure_at ?? null;
        doc.actual_arrival_at = doc.actual_arrival_at ?? null;
        doc.tracking_active = doc.tracking_active ?? false;
        doc.last_position_at = doc.last_position_at ?? null;
        doc.last_latitude = doc.last_latitude ?? null;
        doc.last_longitude = doc.last_longitude ?? null;
        doc.last_speed_kmh = doc.last_speed_kmh ?? null;
        doc.last_heading = doc.last_heading ?? null;
        doc.estimated_distance_km = doc.estimated_distance_km ?? null;
        doc.cargo_summary = doc.cargo_summary ?? null;
    }
    if (collection === "transport_position_logs") {
        doc.position_number = doc.position_number || (await nextDailyNumber("GPS"));
        doc.captured_at = doc.captured_at || now;
        doc.latitude = Number(doc.latitude ?? 0);
        doc.longitude = Number(doc.longitude ?? 0);
        doc.accuracy_m = doc.accuracy_m ?? null;
        doc.speed_kmh = doc.speed_kmh ?? null;
        doc.heading = doc.heading ?? null;
        doc.source = doc.source || "driver_browser";
        doc.position_status = doc.position_status || "moving";
    }
    if (collection === "system_notifications") {
        doc.notification_type = doc.notification_type || doc.type || null;
        doc.type = doc.type || doc.notification_type || null;
        doc.category = doc.category || "system";
        doc.entity_type = doc.entity_type ?? null;
        doc.entity_id = doc.entity_id ?? null;
        doc.status = doc.status || "ACTIVE";
        doc.is_read = doc.is_read ?? false;
        doc.read_at = doc.read_at ?? null;
        doc.read_by = doc.read_by ?? null;
        doc.metadata = doc.metadata ?? null;
        doc.severity = doc.severity || "info";
        doc.action_url = doc.action_url || "/";
    }
    if (collection === "alerts" || collection === "reception_alerts") {
        doc.status = doc.status || "ACTIVE";
    }
    if (collection === "p2p_rfq") {
        doc.rfq_number = doc.rfq_number || (await nextDailyNumber("AO"));
        doc.status = doc.status || "BROUILLON";
        doc.supplier_ids = Array.isArray(doc.supplier_ids) ? doc.supplier_ids : [];
        doc.deadline_date = doc.deadline_date ?? null;
        doc.description = doc.description ?? null;
        doc.selected_supplier_id = doc.selected_supplier_id ?? null;
        doc.selected_reason = doc.selected_reason ?? null;
    }
    if (collection === "p2p_rfq_responses") {
        doc.received_at = doc.received_at || now;
        doc.unit_price = Number(doc.unit_price ?? 0);
        doc.total_amount = Number(doc.total_amount ?? 0);
        doc.delivery_days = Number(doc.delivery_days ?? 0);
        doc.validity_days = Number(doc.validity_days ?? 30);
        doc.score = doc.score ?? null;
        doc.rank = doc.rank ?? null;
        doc.notes = doc.notes ?? null;
    }
    if (collection === "p2p_goods_receipts") {
        doc.receipt_number = doc.receipt_number || (await nextDailyNumber("BR"));
        doc.status = doc.status || "ATTENDUE";
        doc.total_received_qty = Number(doc.total_received_qty ?? 0);
        doc.total_accepted_qty = Number(doc.total_accepted_qty ?? 0);
        doc.total_rejected_qty = Number(doc.total_rejected_qty ?? 0);
        doc.release_decision = doc.release_decision ?? null;
        doc.release_by = doc.release_by ?? null;
        doc.release_at = doc.release_at ?? null;
        doc.qc_notes = doc.qc_notes ?? null;
        doc.reception_id = doc.reception_id ?? null;
        doc.dluo_date = doc.dluo_date ?? null;
        doc.fds_document = doc.fds_document ?? null;
        doc.bio_cert_ref = doc.bio_cert_ref ?? null;
        doc.phyto_doc_ref = doc.phyto_doc_ref ?? null;
    }
    if (collection === "p2p_invoices") {
        doc.invoice_number = doc.invoice_number || (await nextDailyNumber("FACT"));
        doc.status = doc.status || "RECUE";
        doc.currency = doc.currency || "TND";
        doc.subtotal = Number(doc.subtotal ?? 0);
        doc.tax_amount = Number(doc.tax_amount ?? 0);
        doc.total_amount = Number(doc.total_amount ?? 0);
        doc.tolerance_pct = Number(doc.tolerance_pct ?? 3);
        doc.match_result = doc.match_result || "NON_VERIFIE";
        doc.bc_amount = doc.bc_amount ?? null;
        doc.br_amount = doc.br_amount ?? null;
        doc.variance_amount = doc.variance_amount ?? null;
        doc.variance_pct = doc.variance_pct ?? null;
        doc.match_notes = doc.match_notes ?? null;
        doc.matched_by = doc.matched_by ?? null;
        doc.matched_at = doc.matched_at ?? null;
        doc.payment_reference = doc.payment_reference ?? null;
        doc.paid_at = doc.paid_at ?? null;
        doc.paid_by = doc.paid_by ?? null;
    }
    if (collection === "p2p_certificates") {
        doc.certificate_number = doc.certificate_number ?? null;
        doc.issuer = doc.issuer ?? null;
        doc.issue_date = doc.issue_date ?? null;
        doc.document_ref = doc.document_ref ?? null;
        doc.notes = doc.notes ?? null;
    }
    if (collection === "flux_runs") {
        doc.status = doc.status || "running";
        doc.order_id = doc.order_id ?? null;
        doc.input_weight_kg = Number(doc.input_weight_kg ?? 0);
        doc.output_weight_kg = Number(doc.output_weight_kg ?? 0);
        doc.waste_kg = Number(doc.waste_kg ?? 0);
        doc.ccp2_passed = doc.ccp2_passed ?? null;
        doc.notes = doc.notes ?? null;
        doc.started_at = doc.started_at || nowDate();
        doc.completed_at = doc.completed_at ?? null;
    }
    if (collection === "haccp_states") {
        doc.status = doc.status || "not_monitored";
        doc.measured_value = doc.measured_value ?? null;
        doc.checked_by = doc.checked_by ?? null;
        doc.note = doc.note ?? null;
        doc.last_checked_at = doc.last_checked_at ?? null;
    }
    if (collection === "p2p_budget_centers") {
        doc.annual_budget = Number(doc.annual_budget ?? 0);
        doc.consumed = Number(doc.consumed ?? 0);
        doc.committed = Number(doc.committed ?? 0);
        doc.currency = doc.currency || "TND";
        doc.fiscal_year = Number(doc.fiscal_year ?? new Date().getFullYear());
        doc.site = doc.site ?? null;
        doc.manager_name = doc.manager_name ?? null;
        doc.description = doc.description ?? null;
    }
    // ── Purchasing ────────────────────────────────────────────────────────────
    if (collection === "purchase_order_receipt_logs") {
        doc.log_number = doc.log_number || (await nextDailyNumber("GRN"));
        doc.order_id = doc.order_id ?? null;
        doc.line_id = doc.line_id ?? null;
        doc.grn_number = doc.grn_number ?? null;
        doc.received_at = doc.received_at || now;
        doc.received_qty = Number(doc.received_qty ?? 0);
        doc.supplier_lot = doc.supplier_lot ?? null;
        doc.qc_status = doc.qc_status || "accepted";
        doc.quarantine_reason = doc.quarantine_reason ?? null;
        doc.rejection_reason = doc.rejection_reason ?? null;
        doc.received_by = doc.received_by ?? null;
        doc.notes = doc.notes ?? null;
    }
    // ── Production ────────────────────────────────────────────────────────────
    if (collection === "production_orders") {
        doc.order_number = doc.order_number || (await nextDailyNumber("OP"));
        doc.status = doc.status || "DRAFT";
        doc.production_type = doc.production_type || "STANDARD";
        doc.planned_start_at = doc.planned_start_at ?? null;
        doc.planned_end_at = doc.planned_end_at ?? null;
        doc.actual_start_at = doc.actual_start_at ?? null;
        doc.actual_end_at = doc.actual_end_at ?? null;
        doc.target_output_kg = Number(doc.target_output_kg ?? 0);
        doc.actual_output_kg = Number(doc.actual_output_kg ?? 0);
        doc.actual_yield_pct = doc.actual_yield_pct ?? null;
        doc.input_lot_ids = Array.isArray(doc.input_lot_ids) ? doc.input_lot_ids : [];
        doc.created_by = doc.created_by ?? null;
        doc.notes = doc.notes ?? null;
        doc.cancel_reason = doc.cancel_reason ?? null;
    }
    if (collection === "production_steps") {
        doc.status = doc.status || "PENDING";
        doc.production_order_id = doc.production_order_id ?? null;
        doc.step_definition_id = doc.step_definition_id ?? null;
        doc.sequence_order = Number(doc.sequence_order ?? 0);
        doc.started_at = doc.started_at ?? null;
        doc.completed_at = doc.completed_at ?? null;
        doc.performed_by = doc.performed_by ?? null;
        doc.result_notes = doc.result_notes ?? null;
        doc.is_mandatory = doc.is_mandatory ?? true;
        doc.fail_reason = doc.fail_reason ?? null;
    }
    if (collection === "production_lot_allocations") {
        doc.production_order_id = doc.production_order_id ?? null;
        doc.lot_id = doc.lot_id ?? null;
        doc.allocated_kg = Number(doc.allocated_kg ?? 0);
        doc.allocated_at = doc.allocated_at || now;
        doc.allocated_by = doc.allocated_by ?? null;
    }
    if (collection === "production_output_lots") {
        doc.lot_number = doc.lot_number || (await nextDailyNumber("PF"));
        doc.production_order_id = doc.production_order_id ?? null;
        doc.output_type = doc.output_type || "DATES_CONDITIONNEES";
        doc.weight_kg = Number(doc.weight_kg ?? 0);
        doc.grade = doc.grade ?? null;
        doc.recorded_at = doc.recorded_at || now;
        doc.recorded_by = doc.recorded_by ?? null;
        doc.notes = doc.notes ?? null;
    }
    // ── Batches ───────────────────────────────────────────────────────────────
    if (collection === "batches") {
        doc.batch_number = doc.batch_number || (await nextDailyNumber("LOT"));
        doc.status = doc.status || "pending";
        doc.quality_grade = doc.quality_grade ?? null;
        doc.quality_score = doc.quality_score ?? null;
        doc.current_weight_kg = Number(doc.current_weight_kg ?? 0);
        doc.initial_weight_kg = Number(doc.initial_weight_kg ?? 0);
        doc.reception_id = doc.reception_id ?? null;
        doc.supplier_id = doc.supplier_id ?? null;
        doc.material_id = doc.material_id ?? null;
        doc.origin_farm = doc.origin_farm ?? null;
        doc.harvest_date = doc.harvest_date ?? null;
        doc.qc_decision = doc.qc_decision ?? null;
        doc.qc_decision_date = doc.qc_decision_date ?? null;
        doc.qc_decision_by = doc.qc_decision_by ?? null;
        doc.quarantine_reason = doc.quarantine_reason ?? null;
        doc.rejection_reason = doc.rejection_reason ?? null;
        doc.created_by = doc.created_by ?? null;
        doc.notes = doc.notes ?? null;
    }
    if (collection === "batch_movements") {
        doc.batch_id = doc.batch_id ?? null;
        doc.movement_type = doc.movement_type || "STATUS_CHANGE";
        doc.from_status = doc.from_status ?? null;
        doc.to_status = doc.to_status ?? null;
        doc.quantity_kg = Number(doc.quantity_kg ?? 0);
        doc.performed_by = doc.performed_by ?? null;
        doc.reason = doc.reason ?? null;
    }
    if (collection === "non_conformities") {
        doc.nc_number = doc.nc_number || (await nextDailyNumber("NC"));
        doc.batch_id = doc.batch_id ?? null;
        doc.reception_id = doc.reception_id ?? null;
        doc.nc_type = doc.nc_type || "QUALITY";
        doc.severity = doc.severity || "MINOR";
        doc.description = doc.description ?? null;
        doc.detected_by = doc.detected_by ?? null;
        doc.detected_at = doc.detected_at || now;
        doc.corrective_action = doc.corrective_action ?? null;
        doc.corrective_action_deadline = doc.corrective_action_deadline ?? null;
        doc.closed_by = doc.closed_by ?? null;
        doc.closed_at = doc.closed_at ?? null;
        doc.status = doc.status || "OPEN";
    }
    if (collection === "quality_inspections") {
        doc.inspection_number = doc.inspection_number || (await nextDailyNumber("INSP"));
        doc.batch_id = doc.batch_id ?? null;
        doc.step_id = doc.step_id ?? null;
        doc.score = doc.score ?? null;
        doc.decision = doc.decision ?? null;
        doc.inspector_id = doc.inspector_id ?? null;
        doc.notes = doc.notes ?? null;
        doc.criteria = doc.criteria ?? null;
        doc.inspected_at = doc.inspected_at || now;
    }
    if (collection === "bon_expeditions") {
        doc.numero_bon = doc.numero_bon || (await nextDailyNumber("BDE"));
        doc.annee = doc.annee || new Date().getFullYear();
        doc.conventionnel = doc.conventionnel ?? false;
        doc.bio_certifie = doc.bio_certifie ?? false;
        doc.ggp = doc.ggp ?? false;
        doc.lieu = doc.lieu ?? null;
        doc.code_fournisseur = doc.code_fournisseur ?? null;
        doc.fournisseur_id = doc.fournisseur_id ?? null;
        doc.code_controleur = doc.code_controleur ?? null;
        doc.date_expedition = doc.date_expedition || now.slice(0, 10);
        doc.numero_camion = doc.numero_camion ?? null;
        doc.nom_chauffeur = doc.nom_chauffeur ?? null;
        doc.lieu_reception = doc.lieu_reception ?? null;
        doc.responsable_reception = doc.responsable_reception ?? null;
        doc.nom_signataire = doc.nom_signataire ?? null;
        const defaultLignes = [
            { produit: "branche_1ere", nature_caisse: null, quantite_caisse: null, observation: null },
            { produit: "branche_2eme", nature_caisse: null, quantite_caisse: null, observation: null },
            { produit: "vrac", nature_caisse: null, quantite_caisse: null, observation: null },
            { produit: "vrac_seche", nature_caisse: null, quantite_caisse: null, observation: null },
            { produit: "branche_seche", nature_caisse: null, quantite_caisse: null, observation: null },
            { produit: "alig_khouat", nature_caisse: null, quantite_caisse: null, observation: null },
        ];
        doc.lignes = Array.isArray(doc.lignes) && doc.lignes.length > 0 ? doc.lignes : defaultLignes;
        doc.casse_nature = doc.casse_nature ?? null;
        doc.casse_gc = doc.casse_gc ?? null;
        doc.casse_p = doc.casse_p ?? null;
        doc.casse_l = doc.casse_l ?? null;
        doc.statut = doc.statut || "brouillon";
    }
    if (collection === "bon_receptions_achat") {
        doc.numero_bon = doc.numero_bon || (await nextDailyNumber("BRA"));
        doc.annee = doc.annee || new Date().getFullYear();
        doc.convention = doc.convention ?? false;
        doc.bio_certifie = doc.bio_certifie ?? false;
        doc.numero_expedition = doc.numero_expedition ?? null;
        doc.lieu_expedition = doc.lieu_expedition ?? null;
        doc.fournisseur_id = doc.fournisseur_id ?? null;
        doc.fournisseur_nom = doc.fournisseur_nom ?? null;
        doc.numero_facture = doc.numero_facture ?? null;
        doc.date_reception = doc.date_reception || now.slice(0, 10);
        doc.heure_arrivee = doc.heure_arrivee ?? null;
        doc.region = doc.region || "kebilli";
        doc.numero_lot = doc.numero_lot ?? null;
        doc.numero_camion = doc.numero_camion ?? null;
        doc.nom_chauffeur = doc.nom_chauffeur ?? null;
        doc.lieu_reception = doc.lieu_reception ?? null;
        doc.responsable_reception = doc.responsable_reception ?? null;
        doc.numero_rapport_qcr = doc.numero_rapport_qcr ?? null;
        doc.numero_fiche_palette = doc.numero_fiche_palette ?? null;
        const emptyBranch = { gc: null, rp: null, gcm: null, l: null, poid_brut: null, poid_net: null, nbre_palette: null, observation: null };
        doc.branche_premiere = doc.branche_premiere ?? { ...emptyBranch };
        doc.branche_deuxieme = doc.branche_deuxieme ?? { ...emptyBranch };
        doc.vrac = doc.vrac ?? { ...emptyBranch };
        doc.branche_seche = doc.branche_seche ?? { ...emptyBranch, nbre_palette_ajout: null, nbre_palette_retrait: null };
        doc.casse = Array.isArray(doc.casse) ? doc.casse : [];
        doc.statut = doc.statut || "brouillon";
    }
    return doc;
};
