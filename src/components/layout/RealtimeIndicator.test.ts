import { describe, expect, it } from 'vitest';

import { describeRealtime } from '@/lib/realtimeStatus';

const at = new Date(2026, 9, 31, 14, 2).getTime();

describe('describeRealtime', () => {
  it('claims to be live only while the stream is', () => {
    expect(describeRealtime({ state: 'live', lastLiveAt: at }, true)?.label).toBe('En direct');
    expect(describeRealtime({ state: 'reconnecting', lastLiveAt: at }, true)?.label).toBe('Reconnexion, données de 14:02');
    expect(describeRealtime({ state: 'connecting', lastLiveAt: null }, true)?.label).toBe('Connexion…');
  });

  it('says offline first, whatever the stream last reported', () => {
    expect(describeRealtime({ state: 'live', lastLiveAt: at }, false)?.label).toBe('Hors ligne, données de 14:02');
    expect(describeRealtime({ state: 'live', lastLiveAt: at }, false)?.tone).toBe('bad');
  });

  it('says nothing when no one is signed in', () => {
    expect(describeRealtime({ state: 'idle', lastLiveAt: null }, true)).toBeNull();
  });
});
