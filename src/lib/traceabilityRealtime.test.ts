import { describe, expect, it } from "vitest";

import type { LotTraceabilityData } from "@/lib/api/phase2";
import { diffLotTraceability } from "@/lib/traceabilityRealtime";

const buildTraceability = (
  overrides: Partial<LotTraceabilityData> = {},
): LotTraceabilityData => ({
  lot_number: "LOT-2026-001",
  reception: {
    id: "rec-1",
    reception_number: "REC-001",
    status: "EN_ATTENTE",
    variety: "Deglet Nour",
    quantity_total: 1200,
    unit: "kg",
    actual_arrival_date: "2026-06-15T08:00:00.000Z",
    qc_grade: "A",
    supplier_name: "Supplier A",
  },
  reception_lots: [],
  qc_inspections: [],
  qc_check_results: [],
  reception_stock_movements: [],
  fumigation_cycles: [],
  cleaning_cycles: [],
  hydration_cycles: [],
  triage_sessions: [],
  triage_quality_checks: [],
  sub_lots: [],
  stock_lots: [],
  stock_movements: [],
  production_orders: [],
  production_steps: [],
  production_quality_checks: [],
  production_allocations: [],
  output_lots: [],
  packaging_orders: [],
  packaging_palettes: [],
  shipments: [],
  shipment_lines: [],
  audit_logs: [],
  timeline: [],
  controls: {
    immutable_collections: ["stock_movements", "system_audit_logs"],
    business_event_count: 0,
    audit_log_count: 0,
    missing_data: [],
    control_points: [],
  },
  integration_summary: {
    purchase_order_id: null,
    delivery_note_number: null,
    production_order_numbers: [],
    packaging_order_numbers: [],
    shipment_numbers: [],
    customer_names: [],
    document_references: [],
    erp_sync_ready: false,
    mes_sync_ready: false,
    scm_sync_ready: false,
  },
  lineage: {
    inbound_lot_numbers: [],
    sub_lot_numbers: [],
    finished_good_lot_numbers: [],
    shipment_numbers: [],
  },
  ...overrides,
});

describe("traceabilityRealtime", () => {
  it("detects reception status changes", () => {
    const changes = diffLotTraceability(
      buildTraceability(),
      buildTraceability({
        reception: {
          ...buildTraceability().reception!,
          status: "LIBERE",
        },
      }),
    );

    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "reception",
          kind: "updated",
          detail: "Statut EN_ATTENTE -> LIBERE",
        }),
      ]),
    );
  });

  it("detects newly created processing records", () => {
    const changes = diffLotTraceability(
      buildTraceability(),
      buildTraceability({
        fumigation_cycles: [{ id: "fum-1", cycle_number: "FUM-001", status: "PREPARATION" }],
        triage_sessions: [{ id: "tri-1", session_number: "TRI-001", status: "EN_COURS" }],
      }),
    );

    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "fumigation",
          kind: "new",
          title: "FUM-001",
        }),
        expect.objectContaining({
          scope: "triage",
          kind: "new",
          title: "TRI-001",
        }),
      ]),
    );
  });

  it("detects newly created sub-lots", () => {
    const changes = diffLotTraceability(
      buildTraceability(),
      buildTraceability({
        sub_lots: [{ id: "sub-1", lot_number: "LOT-2026-001-EX", grade: "EXTRA" }],
      }),
    );

    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "sub_lot",
          kind: "new",
          title: "LOT-2026-001-EX",
        }),
      ]),
    );
  });

  it("detects newly linked deliveries", () => {
    const changes = diffLotTraceability(
      buildTraceability(),
      buildTraceability({
        shipments: [{ id: "shp-1", shipment_number: "SHP-001", customer_name: null, destination: null, status: "READY" }],
      }),
    );

    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "shipment",
          kind: "new",
          title: "SHP-001",
        }),
      ]),
    );
  });
});
