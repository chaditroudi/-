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

const buildRecordMap = <T extends { id: string }>(
  items: readonly T[],
) =>
  new Map(
    items
      .filter((item) => typeof item.id === 'string' && item.id)
      .map((item) => [String(item.id), item]),
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

  const compareRecords = <T extends { id: string }>(
    scope: TraceabilityRealtimeChange['scope'],
    prevItems: readonly T[],
    nextItems: readonly T[],
    labelField: keyof T,
    statusField?: keyof T,
  ) => {
    const previousMap = buildRecordMap(prevItems);
    const nextMap = buildRecordMap(nextItems);

    nextMap.forEach((item, id) => {
      const previousItem = previousMap.get(id);
      const label = String(item[labelField] ?? item.id ?? scope);
      const nextStatus = statusField && item[statusField] ? String(item[statusField]) : null;

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

      const previousStatus = statusField && previousItem[statusField] ? String(previousItem[statusField]) : null;
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
    previous.qc_inspections,
    next.qc_inspections,
    'inspection_number',
    'decision',
  );
  compareRecords(
    'fumigation',
    previous.fumigation_cycles,
    next.fumigation_cycles,
    'cycle_number',
    'status',
  );
  compareRecords(
    'cleaning',
    previous.cleaning_cycles,
    next.cleaning_cycles,
    'cycle_number',
    'status',
  );
  compareRecords(
    'hydration',
    previous.hydration_cycles,
    next.hydration_cycles,
    'cycle_number',
    'status',
  );
  compareRecords(
    'triage',
    previous.triage_sessions,
    next.triage_sessions,
    'session_number',
    'status',
  );
  compareRecords(
    'stock_lot',
    previous.stock_lots,
    next.stock_lots,
    'lot_number',
    'status',
  );
  compareRecords(
    'stock_movement',
    previous.stock_movements,
    next.stock_movements,
    'movement_number',
    'movement_type',
  );
  compareRecords(
    'production',
    previous.production_orders,
    next.production_orders,
    'order_number',
    'status',
  );
  compareRecords(
    'output_lot',
    previous.output_lots,
    next.output_lots,
    'lot_pf_number',
  );
  compareRecords(
    'shipment',
    previous.shipments,
    next.shipments,
    'shipment_number',
    'status',
  );

  const previousSubLots = buildRecordMap(previous.sub_lots);
  (next.sub_lots).forEach((subLot) => {
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
