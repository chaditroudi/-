import { z } from "zod";
const nonEmpty = z.string().min(1);
const optionalString = z.union([z.string(), z.null()]).optional();
const quantity = z.coerce.number().finite();
const receptionSchema = z
    .object({
    supplier_id: optionalString,
    quantity_total: quantity.optional(),
    unit: z.string().optional(),
    status: z.string().optional(),
})
    .passthrough();
const receptionLotSchema = z
    .object({
    reception_id: nonEmpty,
    quantity: quantity.optional(),
    unit: z.string().optional(),
    stock_status: z.string().optional(),
    lot_internal: z.string().optional(),
    variety: optionalString,
})
    .passthrough();
const receptionUnitSchema = z
    .object({
    reception_lot_id: nonEmpty,
    quantity: quantity.optional(),
    unit: z.string().optional(),
})
    .passthrough();
const qcInspectionSchema = z
    .object({
    reception_id: optionalString,
    reception_lot_id: optionalString,
    decision: optionalString,
})
    .passthrough();
const stockLotSchema = z
    .object({
    reception_lot_id: optionalString,
    current_quantity: quantity.optional(),
    initial_quantity: quantity.optional(),
    status: z.string().optional(),
    unit: z.string().optional(),
})
    .passthrough();
const stockMovementSchema = z
    .object({
    lot_id: optionalString,
    quantity: quantity,
    unit: z.string().optional(),
    movement_type: z.string().optional(),
})
    .passthrough();
const fumigationSchema = z
    .object({
    lot_ids: z.array(z.string()).optional(),
    status: z.string().optional(),
})
    .passthrough();
const triageSessionSchema = z
    .object({
    parent_lot_id: optionalString,
    status: z.string().optional(),
})
    .passthrough();
const triageSublotSchema = z
    .object({
    parent_lot_id: optionalString,
    session_id: optionalString,
    weight_kg: quantity.optional(),
})
    .passthrough();
const productionOrderSchema = z
    .object({
    status: z.string().optional(),
    input_lot_ids: z.array(z.string()).optional(),
    target_output_kg: quantity.optional(),
})
    .passthrough();
const packagingPaletteSchema = z
    .object({
    packaging_order_id: optionalString,
    status: z.string().optional(),
})
    .passthrough();
const shipmentSchema = z
    .object({
    status: z.string().optional(),
    shipment_number: z.string().optional(),
})
    .passthrough();
export const CORE_SCHEMAS = {
    receptions_v2: receptionSchema,
    reception_lots: receptionLotSchema,
    reception_units: receptionUnitSchema,
    qc_inspections: qcInspectionSchema,
    stock_lots: stockLotSchema,
    stock_movements: stockMovementSchema,
    fumigation_cycles: fumigationSchema,
    triage_sessions: triageSessionSchema,
    triage_sublots: triageSublotSchema,
    production_orders: productionOrderSchema,
    packaging_palettes: packagingPaletteSchema,
    shipment_preparations: shipmentSchema,
};
export const validateCoreDocument = (collection, doc) => {
    const schema = CORE_SCHEMAS[collection];
    if (!schema)
        return { ok: true, data: doc, errors: [] };
    const parsed = schema.safeParse(doc);
    if (parsed.success) {
        return { ok: true, data: parsed.data, errors: [] };
    }
    const errors = parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);
    return { ok: false, data: doc, errors };
};
