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

  const asRecords = <T,>(items: T[] | null | undefined): Array<Record<string, unknown>> =>
    (items ?? []) as unknown as Array<Record<string, unknown>>;

  compareRecords(
    'qc',
    asRecords(previous.qc_inspections),
    asRecords(next.qc_inspections),
    'inspection_number',
    'decision',
  );
  compareRecords(
    'fumigation',
    asRecords(previous.fumigation_cycles),
    asRecords(next.fumigation_cycles),
    'cycle_number',
  );
  compareRecords(
    'cleaning',
    asRecords(previous.cleaning_cycles),
    asRecords(next.cleaning_cycles),
    'cycle_number',
  );
  compareRecords(
    'hydration',
    asRecords(previous.hydration_cycles),
    asRecords(next.hydration_cycles),
    'cycle_number',
  );
  compareRecords(
    'triage',
    asRecords(previous.triage_sessions),
    asRecords(next.triage_sessions),
    'session_number',
  );
  compareRecords(
    'stock_lot',
    asRecords(previous.stock_lots),
    asRecords(next.stock_lots),
    'lot_number',
  );
  compareRecords(
    'stock_movement',
    asRecords(previous.stock_movements),
    asRecords(next.stock_movements),
    'movement_number',
    'movement_type',
  );
  compareRecords(
    'production',
    asRecords(previous.production_orders),
    asRecords(next.production_orders),
    'order_number',
  );
  compareRecords(
    'output_lot',
    asRecords(previous.output_lots),
    asRecords(next.output_lots),
    'lot_pf_number',
  );
  compareRecords(
    'shipment',
    asRecords(previous.shipments),
    asRecords(next.shipments),
    'shipment_number',
  );

  const previousSubLots = buildRecordMap(asRecords(previous.sub_lots));
  asRecords(next.sub_lots).forEach((subLot) => {
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
