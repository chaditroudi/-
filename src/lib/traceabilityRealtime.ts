import type { LotTraceabilityData } from '@/lib/api/phase2';

export interface TraceabilityRealtimeChange {
  key: string;
  scope:
    | 'reception'
    | 'qc'
    | 'fumigation'
    | 'cleaning'
    | 'hydration'
    | 'triage'
    | 'sub_lot'
    | 'stock_lot'
    | 'stock_movement'
    | 'production'
    | 'output_lot'
    | 'shipment';
  title: string;
  detail: string;
  kind: 'new' | 'updated';
}

const buildRecordMap = <T extends Record<string, unknown>>(
  items: T[],
  idField = 'id',
) =>
  new Map(
    items
      .filter((item) => typeof item[idField] === 'string' && item[idField])
      .map((item) => [String(item[idField]), item]),
  );

const pushChange = (
  changes: TraceabilityRealtimeChange[],
  change: TraceabilityRealtimeChange,
) => {
  if (!changes.some((entry) => entry.key === change.key && entry.detail === change.detail)) {
    changes.push(change);
  }
};

export const diffLotTraceability = (
  previous: LotTraceabilityData | null | undefined,
  next: LotTraceabilityData | null | undefined,
): TraceabilityRealtimeChange[] => {
  if (!previous || !next) {
    return [];
  }

  const changes: TraceabilityRealtimeChange[] = [];

  if (
    previous.reception?.status &&
    next.reception?.status &&
    previous.reception.status !== next.reception.status
  ) {
    pushChange(changes, {
      key: `reception-${next.reception.id}`,
      scope: 'reception',
      title: next.reception.reception_number,
      detail: `Statut ${previous.reception.status} -> ${next.reception.status}`,
      kind: 'updated',
    });
  }

  const compareRecords = (
    scope: TraceabilityRealtimeChange['scope'],
    prevItems: Array<Record<string, unknown>>,
    nextItems: Array<Record<string, unknown>>,
    labelField: string,
    statusField = 'status',
  ) => {
    const previousMap = buildRecordMap(prevItems);
    const nextMap = buildRecordMap(nextItems);

    nextMap.forEach((item, id) => {
      const previousItem = previousMap.get(id);
      const label = String(item[labelField] ?? item.id ?? scope);
      const nextStatus = item[statusField] ? String(item[statusField]) : null;

      if (!previousItem) {
        pushChange(changes, {
          key: `${scope}-${id}`,
          scope,
          title: label,
          detail: nextStatus ? `Nouvel enregistrement (${nextStatus})` : 'Nouvel enregistrement',
          kind: 'new',
        });
        return;
      }

      const previousStatus = previousItem[statusField] ? String(previousItem[statusField]) : null;
      if (previousStatus !== nextStatus && nextStatus) {
        pushChange(changes, {
          key: `${scope}-${id}`,
          scope,
          title: label,
          detail: previousStatus ? `Statut ${previousStatus} -> ${nextStatus}` : `Statut ${nextStatus}`,
          kind: 'updated',
        });
      }
    });
  };

  compareRecords(
    'qc',
    previous.qc_inspections as Array<Record<string, unknown>>,
    next.qc_inspections as Array<Record<string, unknown>>,
    'inspection_number',
    'decision',
  );
  compareRecords(
    'fumigation',
    previous.fumigation_cycles as Array<Record<string, unknown>>,
    next.fumigation_cycles as Array<Record<string, unknown>>,
    'cycle_number',
  );
  compareRecords(
    'cleaning',
    previous.cleaning_cycles as Array<Record<string, unknown>>,
    next.cleaning_cycles as Array<Record<string, unknown>>,
    'cycle_number',
  );
  compareRecords(
    'hydration',
    previous.hydration_cycles as Array<Record<string, unknown>>,
    next.hydration_cycles as Array<Record<string, unknown>>,
    'cycle_number',
  );
  compareRecords(
    'triage',
    previous.triage_sessions as Array<Record<string, unknown>>,
    next.triage_sessions as Array<Record<string, unknown>>,
    'session_number',
  );
  compareRecords(
    'stock_lot',
    previous.stock_lots as Array<Record<string, unknown>>,
    next.stock_lots as Array<Record<string, unknown>>,
    'lot_number',
  );
  compareRecords(
    'stock_movement',
    previous.stock_movements as Array<Record<string, unknown>>,
    next.stock_movements as Array<Record<string, unknown>>,
    'movement_number',
    'movement_type',
  );
  compareRecords(
    'production',
    previous.production_orders as Array<Record<string, unknown>>,
    next.production_orders as Array<Record<string, unknown>>,
    'order_number',
  );
  compareRecords(
    'output_lot',
    previous.output_lots as Array<Record<string, unknown>>,
    next.output_lots as Array<Record<string, unknown>>,
    'lot_pf_number',
  );
  compareRecords(
    'shipment',
    previous.shipments as Array<Record<string, unknown>>,
    next.shipments as Array<Record<string, unknown>>,
    'shipment_number',
  );

  const previousSubLots = buildRecordMap(previous.sub_lots as Array<Record<string, unknown>>);
  (next.sub_lots as Array<Record<string, unknown>>).forEach((subLot) => {
    const id = String(subLot.id ?? '');
    if (!id || previousSubLots.has(id)) return;

    pushChange(changes, {
      key: `sub-lot-${id}`,
      scope: 'sub_lot',
      title: String(subLot.lot_number ?? 'Sous-lot'),
      detail: `Nouveau sous-lot ${String(subLot.grade ?? '').replace(/_/g, ' ')}`.trim(),
      kind: 'new',
    });
  });

  return changes;
};
