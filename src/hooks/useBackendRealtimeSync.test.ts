import { describe, expect, it } from 'vitest';

import type { ServerRealtimeEvent } from '@/integrations/mongodb/client';

import { shouldRefetchNotificationsForEvent } from './useBackendRealtimeSync';

describe('useBackendRealtimeSync notification refresh rules', () => {
  it('refetches notifications when another table reports notification side effects', () => {
    const event: ServerRealtimeEvent = {
      table: 'receptions_v2',
      action: 'UPDATE',
      relatedTables: ['system_notifications', 'reception_alerts'],
    };

    expect(shouldRefetchNotificationsForEvent(event, 'receptions_v2')).toBe(true);
  });

  it('does not force a fetch when the realtime event is already a notification row update', () => {
    const event: ServerRealtimeEvent = {
      table: 'system_notifications',
      action: 'INSERT',
      rows: [{ id: 'notif-1' }],
    };

    expect(shouldRefetchNotificationsForEvent(event, 'system_notifications')).toBe(false);
  });
});
