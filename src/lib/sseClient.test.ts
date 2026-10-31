import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SseConnection, type SseMessage } from './sseClient';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners = new Map<string, (event: { data: string }) => void>();
  onerror: (() => void) | null = null;
  closed = false;

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(name: string, listener: (event: { data: string }) => void) {
    this.listeners.set(name, listener);
  }
  close() {
    this.closed = true;
  }
  fire(name: string, data: unknown = {}) {
    this.listeners.get(name)?.({ data: JSON.stringify(data) });
  }
}

const latest = () => FakeEventSource.instances[FakeEventSource.instances.length - 1];

describe('SseConnection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    localStorage.setItem('date-harvest-hub-session', JSON.stringify({ access_token: 'token' }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('flags a reconnection so the screens can reload what they missed', () => {
    const connection = new SseConnection();
    const seen: SseMessage[] = [];
    connection.subscribe((message) => seen.push(message));

    latest().fire('connected');
    latest().onerror?.();
    vi.advanceTimersByTime(3_000);
    latest().fire('connected');

    expect(seen.map((message) => message.eventName === 'connected' && message.payload.reconnected)).toEqual([false, true]);
    connection.close();
  });

  it('replaces a stream that went silent without an error, as a dropped link does', () => {
    const connection = new SseConnection();
    latest().fire('connected');
    const silent = latest();

    vi.advanceTimersByTime(50_000);

    expect(silent.closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(2);
    connection.close();
  });

  it('keeps a stream that receives its pings', () => {
    const connection = new SseConnection();
    latest().fire('connected');
    for (let beat = 0; beat < 4; beat += 1) {
      vi.advanceTimersByTime(25_000);
      latest().fire('ping');
    }

    expect(FakeEventSource.instances).toHaveLength(1);
    connection.close();
  });
});
