import { describe, expect, it } from 'vitest';

import { getRealtimeDispatchEntries, type ServerRealtimeEvent } from './client';

describe('mongodb realtime dispatch mapping', () => {
  it('keeps row payloads on the primary table only', () => {
    const receptionRow = { id: 'rec-1', reception_number: 'REC-001' };
    const event: ServerRealtimeEvent = {
      table: 'receptions_v2',
      action: 'INSERT',
      rows: [receptionRow],
      relatedTables: ['system_notifications', 'reception_alerts', 'receptions_v2'],
    };

    const entries = getRealtimeDispatchEntries(event);

    expect(entries).toEqual([
      {
        table: 'receptions_v2',
        new: receptionRow,
        old: undefined,
      },
      {
        table: 'system_notifications',
        new: undefined,
        old: undefined,
      },
      {
        table: 'reception_alerts',
        new: undefined,
        old: undefined,
      },
    ]);
  });

  it('still emits a primary-table sync entry when no rows are provided', () => {
    const event: ServerRealtimeEvent = {
      table: 'system_notifications',
      action: 'SYNC',
      relatedTables: ['notifications'],
    };

    const entries = getRealtimeDispatchEntries(event);

    expect(entries).toEqual([
      {
        table: 'system_notifications',
        new: undefined,
        old: undefined,
      },
      {
        table: 'notifications',
        new: undefined,
        old: undefined,
      },
    ]);
  });
});
