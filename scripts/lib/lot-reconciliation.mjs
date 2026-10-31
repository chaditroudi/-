/**
 * Compares the QC record, reception lots and stock lots. It only classifies:
 * every remediation below is a person's decision, made through the QC workflow.
 */

const RELEASED_STOCK = new Set(["VALIDATED", "STOCK_LIBERE", "LIBERE", "RELEASED"]);
const RELEASED_RECEPTION = new Set(["STOCK_LIBERE", "LIBERE"]);
const upper = (value) => String(value || "").toUpperCase();

export const FINDINGS = {
  STOCK_RELEASED_RECEPTION_NOT: {
    severity: "CRITICAL",
    remediation: "Hold the lot physically; the quality manager opens a QC inspection and records the outcome there.",
  },
  REJECTED_STOCK_NOT_BLOCKED: {
    severity: "CRITICAL",
    remediation: "Hold the lot physically; the quality manager confirms the rejection and blocks it through the QC workflow.",
  },
  RELEASED_WITHOUT_INSPECTION: {
    severity: "CRITICAL",
    remediation: "Hold the lot; a new inspection decides it. Check any production or shipment that already used it.",
  },
  ACCEPTED_WITH_CRITICAL_NONCONFORMITY: {
    severity: "CRITICAL",
    remediation: "The quality manager reviews the decision and opens a non-conformity; trace any use of the lot.",
  },
  ACCEPTED_WITHOUT_EVIDENCE: {
    severity: "HIGH",
    remediation: "The quality manager reviews the lot and records a new inspection if it is still in stock.",
  },
  RELEASED_AFTER_HOLD: {
    severity: "HIGH",
    remediation: "The quality manager checks the release against the audit log and the reason for the hold.",
  },
  BATCH_DECISION_ON_RECEPTION: {
    severity: "HIGH",
    remediation: "Compare with the inspection record; a batch decision is not QC evidence.",
  },
  RECEPTION_RELEASED_STOCK_HELD: {
    severity: "HIGH",
    remediation: "Production refuses this lot. The quality manager decides which side is right, then corrects it through QC.",
  },
  RELEASED_WITHOUT_VERIFIED_PIN: {
    severity: "MEDIUM",
    remediation: "Record for the HACCP file. Do not re-sign old decisions; review with the quality manager.",
  },
  MISSING_STOCK_LOT: {
    severity: "MEDIUM",
    remediation: "The stock owner confirms whether the lot physically exists before any record is created.",
  },
  ORPHAN_STOCK_LOT: {
    severity: "MEDIUM",
    remediation: "The stock owner traces the reception lot this row referred to.",
  },
  MULTIPLE_STOCK_LOTS: {
    severity: "MEDIUM",
    remediation: "The stock owner confirms which rows are real; the gate treats any held row as holding the lot.",
  },
  QUANTITY_ABOVE_INITIAL: {
    severity: "MEDIUM",
    remediation: "The stock owner reconciles with a physical count and a recorded stock movement.",
  },
};

const groupBy = (rows, key) => {
  const groups = new Map();
  for (const row of rows) {
    const value = row[key];
    if (!value) continue;
    groups.set(value, [...(groups.get(value) ?? []), row]);
  }
  return groups;
};

/** The production gate's rule, kept beside the audit so the report says what the gate would do. */
export const usableUnderGate = (receptionStatus, stockStatuses) => {
  const active = stockStatuses.map(upper).filter((status) => status !== "CONSUMED");
  const reception = upper(receptionStatus);
  if (!reception && active.length === 0) return false;
  return (!reception || RELEASED_RECEPTION.has(reception)) && active.every((status) => RELEASED_STOCK.has(status));
};

export const reconcileLots = ({ receptionLots, stockLots, inspections, checkResults, batches }) => {
  const findings = [];
  const add = (code, lot, detail) => findings.push({
    code, ...FINDINGS[code], lot_id: lot.id, lot_number: lot.lot_internal ?? lot.lot_number ?? null, detail,
  });

  const stockByLot = groupBy(stockLots, "reception_lot_id");
  const inspectionsByReception = groupBy(inspections, "reception_id");
  const checksByInspection = groupBy(checkResults, "inspection_id");
  const decidedBatches = new Set(batches.filter((batch) => batch.qc_decision).map((batch) => batch.reception_id));
  const receptionLotIds = new Set(receptionLots.map((lot) => lot.id));
  let usable = 0;
  let refused = 0;

  for (const lot of receptionLots) {
    const stock = stockByLot.get(lot.id) ?? [];
    const status = upper(lot.stock_status);
    const released = RELEASED_RECEPTION.has(status);
    // A re-inspection speaks for its own lot; any other inspection covers the whole reception.
    const decided = (inspectionsByReception.get(lot.reception_id) ?? [])
      .filter((row) => row.decision && (!row.reception_lot_id || row.reception_lot_id === lot.id));
    const accepted = decided.filter((row) => row.decision === "ACCEPTE");
    const stockStatuses = stock.map((row) => row.status);
    const active = stockStatuses.map(upper).filter((value) => value !== "CONSUMED");

    if (usableUnderGate(lot.stock_status, stockStatuses)) usable += 1;
    else refused += 1;

    if (stock.length === 0 && status !== "NON_STOCKE") add("MISSING_STOCK_LOT", lot, { reception: status });
    if (stock.length > 1) add("MULTIPLE_STOCK_LOTS", lot, { stock: stockStatuses });
    if (!released && status !== "STOCK_REJETE" && active.some((value) => RELEASED_STOCK.has(value))) {
      add("STOCK_RELEASED_RECEPTION_NOT", lot, { reception: status, stock: stockStatuses });
    }
    if (status === "STOCK_REJETE" && active.some((value) => value !== "BLOCKED")) {
      add("REJECTED_STOCK_NOT_BLOCKED", lot, { stock: stockStatuses });
    }
    if (decidedBatches.has(lot.reception_id)) add("BATCH_DECISION_ON_RECEPTION", lot, { reception: status });
    if (!released) continue;

    if (active.some((value) => !RELEASED_STOCK.has(value))) {
      add("RECEPTION_RELEASED_STOCK_HELD", lot, { stock: stockStatuses });
    }
    if (decided.length === 0) add("RELEASED_WITHOUT_INSPECTION", lot, { reception_id: lot.reception_id });
    else if (accepted.length === 0) add("RELEASED_AFTER_HOLD", lot, { decisions: decided.map((row) => row.decision) });
    if (lot.release_pin_verified !== true) add("RELEASED_WITHOUT_VERIFIED_PIN", lot, {});

    for (const inspection of accepted) {
      const checks = checksByInspection.get(inspection.id) ?? [];
      if (checks.length === 0) add("ACCEPTED_WITHOUT_EVIDENCE", lot, { inspection_id: inspection.id });
      const critical = checks.filter((row) => row.severity === "CRITIQUE" && row.result === "NON_CONFORME");
      if (critical.length > 0) {
        add("ACCEPTED_WITH_CRITICAL_NONCONFORMITY", lot, { inspection_id: inspection.id, checks: critical.map((row) => row.check_code) });
      }
    }
  }

  for (const stock of stockLots) {
    if (stock.reception_lot_id && !receptionLotIds.has(stock.reception_lot_id)) {
      add("ORPHAN_STOCK_LOT", stock, { reception_lot_id: stock.reception_lot_id, stock: stock.status });
    }
    if (Number(stock.current_quantity) > Number(stock.initial_quantity)) {
      add("QUANTITY_ABOVE_INITIAL", stock, { current: stock.current_quantity, initial: stock.initial_quantity });
    }
  }

  const byCode = Object.fromEntries(Object.keys(FINDINGS).map((code) => [code, findings.filter((row) => row.code === code).length]));
  return {
    totals: { reception_lots: receptionLots.length, stock_lots: stockLots.length, usable_under_gate: usable, refused_by_gate: refused },
    by_code: byCode,
    findings,
  };
};
