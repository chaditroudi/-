/** Transforms a raw traceability dossier into a directed genealogy graph (nodes + edges). */

export type GenealogyNodeType =
  | 'reception_lot'
  | 'qc_inspection'
  | 'fumigation'
  | 'cleaning'
  | 'hydration'
  | 'triage'
  | 'sub_lot'
  | 'production_order'
  | 'output_lot'
  | 'stock_lot'
  | 'packaging_order'
  | 'palette'
  | 'shipment';

export interface GenealogyNode {
  id: string;
  type: GenealogyNodeType;
  label: string;
  sublabel: string | null;
  status: string | null;
  column: number;
  row: number;
  meta: Record<string, unknown>;
}

export interface GenealogyEdge {
  id: string;
  from: string;
  to: string;
  edgeType: 'process' | 'output' | 'shipment' | 'link';
}

export interface GenealogyStats {
  total_kg_in: number | null;
  final_units: number | null;
  palette_count: number;
  shipment_count: number;
  stage_count: number;
}

export interface GenealogyTree {
  lot_number: string;
  nodes: GenealogyNode[];
  edges: GenealogyEdge[];
  stats: GenealogyStats;
}

// ── Column constants ────────────────────────────────────────────────────────────
const COL: Record<GenealogyNodeType, number> = {
  reception_lot:    0,
  qc_inspection:    1,
  fumigation:       2,
  cleaning:         2,
  hydration:        2,
  triage:           3,
  sub_lot:          4,
  production_order: 5,
  output_lot:       6,
  stock_lot:        6,
  packaging_order:  7,
  palette:          8,
  shipment:         9,
};

const rs = (v: unknown): string => (v != null ? String(v) : '');
const rn = (v: unknown): number | null => (typeof v === 'number' ? v : null);

export function buildGenealogyFromDossier(dossier: Record<string, unknown>): GenealogyTree {
  const nodes: GenealogyNode[] = [];
  const edges: GenealogyEdge[] = [];
  const colCounts: Record<number, number> = {};
  let edgeSeq = 0;

  const addNode = (node: Omit<GenealogyNode, 'row'>): GenealogyNode => {
    const col = node.column;
    const row = colCounts[col] ?? 0;
    colCounts[col] = row + 1;
    const n: GenealogyNode = { ...node, row };
    nodes.push(n);
    return n;
  };

  const addEdge = (from: string, to: string, edgeType: GenealogyEdge['edgeType'] = 'process') => {
    if (!from || !to || from === to) return;
    edges.push({ id: `e${edgeSeq++}`, from, to, edgeType });
  };

  // ── Reception lot ──────────────────────────────────────────────────────────
  const receptionLots = (dossier.reception_lots as any[] | undefined) ?? [];
  const mainLot = receptionLots[0] as Record<string, unknown> | undefined;
  const lotNumber = rs(dossier.lot_number);

  if (!mainLot) {
    return { lot_number: lotNumber, nodes: [], edges: [], stats: { total_kg_in: null, final_units: null, palette_count: 0, shipment_count: 0, stage_count: 0 } };
  }

  const mainLotId = rs(mainLot.id);
  addNode({
    id: mainLotId,
    type: 'reception_lot',
    label: rs(mainLot.lot_internal) || lotNumber,
    sublabel: rs(mainLot.variety) || null,
    status: rs(mainLot.stock_status) || null,
    column: COL.reception_lot,
    meta: {
      quantity: rn(mainLot.quantity),
      unit: rs(mainLot.unit),
      variety: rs(mainLot.variety),
      origin_country: rs(mainLot.origin_country),
      harvest_date: rs(mainLot.harvest_date),
      quarantine_reason: rs(mainLot.quarantine_reason),
    },
  });

  // ── QC inspections ─────────────────────────────────────────────────────────
  const qcInspections = (dossier.qc_inspections as any[] | undefined) ?? [];
  for (const insp of qcInspections) {
    const id = rs(insp.id);
    addNode({
      id,
      type: 'qc_inspection',
      label: rs(insp.inspection_number) || 'Inspection QC',
      sublabel: rs(insp.decision) || null,
      status: rs(insp.decision) || 'EN_COURS',
      column: COL.qc_inspection,
      meta: {
        inspector: rs(insp.inspector_name),
        decision: rs(insp.decision),
        comment: rs(insp.comment),
        started_at: rs(insp.started_at),
        ended_at: rs(insp.ended_at),
        nonconformity_codes: insp.nonconformity_codes,
      },
    });
    addEdge(mainLotId, id, 'process');
  }

  // ── Fumigation cycles ──────────────────────────────────────────────────────
  const fumCycles = (dossier.fumigation_cycles as any[] | undefined) ?? [];
  const fumIds: string[] = [];
  for (const fum of fumCycles) {
    const id = rs(fum.id);
    fumIds.push(id);
    addNode({
      id,
      type: 'fumigation',
      label: rs(fum.cycle_number) || 'Fumigation',
      sublabel: rs(fum.chamber) || null,
      status: rs(fum.status) || null,
      column: COL.fumigation,
      meta: {
        chamber: rs(fum.chamber),
        protocol: rs(fum.protocol),
        total_weight_kg: rn(fum.total_weight_kg),
        duration_minutes: rn(fum.duration_minutes),
        duration_compliant: fum.duration_compliant,
        parameters_compliant: fum.parameters_compliant,
        t0_start: rs(fum.t0_start),
        t_end_real: rs(fum.t_end_real),
        operator: rs(fum.operator_name),
      },
    });
    addEdge(mainLotId, id, 'process');
  }

  // ── Cleaning cycles ────────────────────────────────────────────────────────
  const clnCycles = (dossier.cleaning_cycles as any[] | undefined) ?? [];
  const clnIds: string[] = [];
  for (const cln of clnCycles) {
    const id = rs(cln.id);
    clnIds.push(id);
    addNode({
      id,
      type: 'cleaning',
      label: rs(cln.cycle_number) || 'Nettoyage',
      sublabel: cln.yield_percent != null ? `Rdt ${Number(cln.yield_percent).toFixed(1)}%` : null,
      status: rs(cln.status) || null,
      column: COL.cleaning,
      meta: {
        weight_in_kg: rn(cln.weight_in_kg),
        weight_out_kg: rn(cln.weight_out_kg),
        yield_percent: rn(cln.yield_percent),
        waste_weight_kg: rn(cln.waste_weight_kg),
        operator: rs(cln.operator_name),
        started_at: rs(cln.started_at),
        ended_at: rs(cln.ended_at),
      },
    });
    addEdge(mainLotId, id, 'process');
  }

  // ── Hydration cycles ───────────────────────────────────────────────────────
  const hydCycles = (dossier.hydration_cycles as any[] | undefined) ?? [];
  const hydIds: string[] = [];
  for (const hyd of hydCycles) {
    const id = rs(hyd.id);
    hydIds.push(id);
    addNode({
      id,
      type: 'hydration',
      label: rs(hyd.cycle_number) || 'Hydratation',
      sublabel: rs(hyd.chamber) || null,
      status: rs(hyd.status) || null,
      column: COL.hydration,
      meta: {
        humidity_in: rn(hyd.humidity_in_percent),
        humidity_out: rn(hyd.humidity_out_avg),
        conformity: rs(hyd.conformity),
        program_applied: rs(hyd.program_applied),
        operator: rs(hyd.operator_name),
        ended_at: rs(hyd.ended_at),
      },
    });
    addEdge(mainLotId, id, 'process');
  }

  // ── Triage sessions ────────────────────────────────────────────────────────
  const triSessions = (dossier.triage_sessions as any[] | undefined) ?? [];
  const triIdMap = new Map<string, string>(); // session_number → id

  // Determine what connects INTO triage
  const preTriageIds = [...fumIds, ...clnIds, ...hydIds];

  for (const tri of triSessions) {
    const id = rs(tri.id);
    if (tri.session_number) triIdMap.set(rs(tri.session_number), id);
    addNode({
      id,
      type: 'triage',
      label: rs(tri.session_number) || 'Triage',
      sublabel: tri.total_sorted_kg != null ? `${Number(tri.total_sorted_kg).toFixed(0)} kg` : null,
      status: rs(tri.status) || null,
      column: COL.triage,
      meta: {
        line: rs(tri.line),
        total_sorted_kg: rn(tri.total_sorted_kg),
        cat1_percent: rn(tri.cat1_percent),
        cat2_percent: rn(tri.cat2_percent),
        extra_percent: rn(tri.extra_percent),
        reject_percent: rn(tri.reject_percent),
        chef_ligne: rs(tri.chef_ligne),
        started_at: rs(tri.started_at),
        ended_at: rs(tri.ended_at),
      },
    });
    // Connect from last processing stage or directly from lot
    if (preTriageIds.length > 0) {
      for (const pid of preTriageIds) addEdge(pid, id, 'process');
    } else {
      addEdge(mainLotId, id, 'process');
    }
  }

  // ── Sub-lots ───────────────────────────────────────────────────────────────
  const subLots = (dossier.sub_lots as any[] | undefined) ?? [];
  const subLotIdByLotNumber = new Map<string, string>();

  for (const sl of subLots) {
    const id = rs(sl.id);
    const lotNum = rs(sl.lot_number);
    if (lotNum) subLotIdByLotNumber.set(lotNum, id);
    addNode({
      id,
      type: 'sub_lot',
      label: lotNum || `Sous-lot ${rs(sl.grade)}`,
      sublabel: rs(sl.grade) || null,
      status: rs(sl.destination) || 'OK',
      column: COL.sub_lot,
      meta: {
        grade: rs(sl.grade),
        weight_kg: rn(sl.weight_kg),
        percent_of_parent: rn(sl.percent_of_parent),
        destination: rs(sl.destination),
      },
    });
    // Connect from parent triage session
    const parentSessionId = rs(sl.session_id);
    const triNode = nodes.find((n) => n.id === parentSessionId);
    if (triNode) {
      addEdge(parentSessionId, id, 'output');
    } else if (triSessions.length > 0) {
      addEdge(rs(triSessions[0].id), id, 'output');
    } else {
      addEdge(mainLotId, id, 'output');
    }
  }

  // ── Production orders ──────────────────────────────────────────────────────
  const productionOrders = (dossier.production_orders as any[] | undefined) ?? [];
  const productionAllocations = (dossier.production_allocations as any[] | undefined) ?? [];
  const prodOrderIds: string[] = [];

  for (const po of productionOrders) {
    const id = rs(po.id);
    prodOrderIds.push(id);
    addNode({
      id,
      type: 'production_order',
      label: rs(po.order_number) || 'Ordre production',
      sublabel: po.product_name ? rs(po.product_name) : null,
      status: rs(po.status) || null,
      column: COL.production_order,
      meta: {
        product_name: rs(po.product_name),
        target_quantity: rn(po.target_quantity),
        actual_quantity: rn(po.actual_quantity),
        unit: rs(po.unit),
        actual_start_date: rs(po.actual_start_date),
        actual_end_date: rs(po.actual_end_date),
      },
    });

    // Connect from sub-lots that were allocated to this order
    const allocsForOrder = productionAllocations.filter(
      (a) => rs(a.production_order_id) === id,
    );
    const allocatedSubLotIds = allocsForOrder
      .map((a) => {
        const lotNum = rs((a.lot as any)?.lot_internal) || rs(a.reception_lot_id);
        return subLotIdByLotNumber.get(lotNum) ?? '';
      })
      .filter(Boolean);

    if (allocatedSubLotIds.length > 0) {
      for (const slId of allocatedSubLotIds) addEdge(slId, id, 'process');
    } else if (subLots.length > 0) {
      // Fallback: connect from all sub-lots
      for (const sl of subLots) addEdge(rs(sl.id), id, 'process');
    } else {
      addEdge(mainLotId, id, 'process');
    }
  }

  // ── Output lots (PF) ───────────────────────────────────────────────────────
  const outputLots = (dossier.output_lots as any[] | undefined) ?? [];
  const outputLotIds: string[] = [];

  for (const ol of outputLots) {
    const id = rs(ol.id);
    outputLotIds.push(id);
    addNode({
      id,
      type: 'output_lot',
      label: rs(ol.lot_pf_number) || 'Lot PF',
      sublabel: ol.variety ? rs(ol.variety) : null,
      status: 'PRODUCED',
      column: COL.output_lot,
      meta: {
        lot_pf_number: rs(ol.lot_pf_number),
        quantity: rn(ol.quantity),
        unit: rs(ol.unit),
        variety: rs(ol.variety),
        bio_declared: ol.bio_declared,
        recorded_at: rs(ol.recorded_at),
      },
    });
    const parentOrderId = rs(ol.production_order_id);
    if (parentOrderId && nodes.find((n) => n.id === parentOrderId)) {
      addEdge(parentOrderId, id, 'output');
    } else if (prodOrderIds.length > 0) {
      addEdge(prodOrderIds[0], id, 'output');
    }
  }

  // ── Stock lots ─────────────────────────────────────────────────────────────
  const stockLots = (dossier.stock_lots as any[] | undefined) ?? [];
  const stockLotIds: string[] = [];

  for (const sl of stockLots) {
    const id = rs(sl.id);
    stockLotIds.push(id);
    addNode({
      id,
      type: 'stock_lot',
      label: rs(sl.lot_number) || 'Stock lot',
      sublabel: rs(sl.zone_code) || rs(sl.storage_zone_code) || null,
      status: rs(sl.status) || null,
      column: COL.stock_lot,
      meta: {
        lot_number: rs(sl.lot_number),
        current_quantity: rn(sl.current_quantity),
        unit: rs(sl.unit),
        zone_code: rs(sl.zone_code) || rs(sl.storage_zone_code),
        dluo_date: rs(sl.dluo_date),
        variety: rs(sl.variety),
        source_stage: rs(sl.source_stage),
      },
    });
    // Connect from output lots if any, otherwise main lot
    if (outputLotIds.length > 0) {
      addEdge(outputLotIds[0], id, 'output');
    } else if (prodOrderIds.length > 0) {
      addEdge(prodOrderIds[0], id, 'output');
    } else {
      addEdge(mainLotId, id, 'output');
    }
  }

  // ── Packaging orders ───────────────────────────────────────────────────────
  const packagingOrders = (dossier.packaging_orders as any[] | undefined) ?? [];
  const pkgOrderIds: string[] = [];

  for (const pko of packagingOrders) {
    const id = rs(pko.id);
    pkgOrderIds.push(id);
    addNode({
      id,
      type: 'packaging_order',
      label: rs(pko.order_number) || 'Conditionnement',
      sublabel: pko.bom_name ? rs(pko.bom_name) : (pko.grade ? `Grade ${rs(pko.grade)}` : null),
      status: rs(pko.status) || null,
      column: COL.packaging_order,
      meta: {
        bom_name: rs(pko.bom_name),
        grade: rs(pko.grade),
        target_units: rn(pko.target_units),
        produced_units: rn(pko.produced_units),
        line: rs(pko.line),
        started_at: rs(pko.started_at),
      },
    });

    // Connect from source sub-lot by lot_number, or from stock lots, or output lots
    const sourceLotNum = rs(pko.source_lot_number);
    const sourceSubLotId = subLotIdByLotNumber.get(sourceLotNum);
    if (sourceSubLotId) {
      addEdge(sourceSubLotId, id, 'process');
    } else if (stockLotIds.length > 0) {
      addEdge(stockLotIds[0], id, 'process');
    } else if (outputLotIds.length > 0) {
      addEdge(outputLotIds[0], id, 'process');
    } else {
      addEdge(mainLotId, id, 'process');
    }
  }

  // ── Palettes ───────────────────────────────────────────────────────────────
  const packagingPalettes = (dossier.packaging_palettes as any[] | undefined) ?? [];

  for (const pal of packagingPalettes) {
    const id = rs(pal.id);
    addNode({
      id,
      type: 'palette',
      label: rs(pal.sscc) || rs(pal.palette_number) || 'Palette',
      sublabel: pal.gross_weight_kg != null ? `${Number(pal.gross_weight_kg).toFixed(1)} kg` : null,
      status: rs(pal.status) || 'OK',
      column: COL.palette,
      meta: {
        sscc: rs(pal.sscc),
        palette_number: rs(pal.palette_number),
        gross_weight_kg: rn(pal.gross_weight_kg),
        net_weight_kg: rn(pal.net_weight_kg),
        unit_count: rn(pal.unit_count),
        seal_number: rs(pal.seal_number),
      },
    });
    const parentPkoId = rs(pal.packaging_order_id);
    if (parentPkoId && nodes.find((n) => n.id === parentPkoId)) {
      addEdge(parentPkoId, id, 'output');
    } else if (pkgOrderIds.length > 0) {
      addEdge(pkgOrderIds[pkgOrderIds.length - 1], id, 'output');
    }
  }

  // ── Shipments ──────────────────────────────────────────────────────────────
  const shipments = (dossier.shipments as any[] | undefined) ?? [];
  const shipmentLines = (dossier.shipment_lines as any[] | undefined) ?? [];

  for (const sh of shipments) {
    const id = rs(sh.id);
    addNode({
      id,
      type: 'shipment',
      label: rs(sh.shipment_number) || 'Expédition',
      sublabel: rs(sh.customer_name) || rs(sh.destination_country) || null,
      status: rs(sh.status) || null,
      column: COL.shipment,
      meta: {
        shipment_number: rs(sh.shipment_number),
        customer_name: rs(sh.customer_name),
        destination_country: rs(sh.destination_country),
        validated_by: rs(sh.validated_by),
        shipped_at: rs(sh.shipped_at),
        line_count: shipmentLines.filter((l) => rs(l.shipment_id) === id).length,
      },
    });
    // Connect from palettes if any, else stock lots
    if (packagingPalettes.length > 0) {
      addEdge(rs(packagingPalettes[0].id), id, 'shipment');
    } else if (stockLotIds.length > 0) {
      addEdge(stockLotIds[0], id, 'shipment');
    } else {
      addEdge(mainLotId, id, 'shipment');
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalKgIn = rn(mainLot.quantity);
  const finalUnits = packagingOrders.reduce(
    (sum, pko) => sum + (rn(pko.produced_units) ?? 0),
    0,
  );

  return {
    lot_number: lotNumber,
    nodes,
    edges,
    stats: {
      total_kg_in: totalKgIn,
      final_units: finalUnits > 0 ? finalUnits : null,
      palette_count: packagingPalettes.length,
      shipment_count: shipments.length,
      stage_count: nodes.length,
    },
  };
}
