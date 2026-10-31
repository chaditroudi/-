import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SseConnection, type SseMessage } from './sseClient';

const post = vi.hoisted(() => vi.fn());
vi.mock('./axiosClient', () => ({ axiosClient: { post } }));

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
const settle = () => vi.advanceTimersByTimeAsync(0);

describe('SseConnection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    localStorage.setItem('date-harvest-hub-session', JSON.stringify({ access_token: 'token' }));
    let issued = 0;
    post.mockReset();
    post.mockImplementation(async () => ({ data: { data: { ticket: `ticket-${(issued += 1)}` } } }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('flags a reconnection so the screens can reload what they missed', async () => {
    const connection = new SseConnection();
    await settle();
    const seen: SseMessage[] = [];
    connection.subscribe((message) => seen.push(message));

    latest().fire('connected');
    latest().onerror?.();
    await vi.advanceTimersByTimeAsync(3_000);
    latest().fire('connected');

    expect(seen.map((message) => message.eventName === 'connected' && message.payload.reconnected)).toEqual([false, true]);
    connection.close();
  });

  it('replaces a stream that went silent without an error, as a dropped link does', async () => {
    const connection = new SseConnection();
    await settle();
    latest().fire('connected');
    const silent = latest();

    await vi.advanceTimersByTimeAsync(50_000);

    expect(silent.closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(2);
    connection.close();
  });

  it('keeps a stream that receives its pings', async () => {
    const connection = new SseConnection();
    await settle();
    latest().fire('connected');
    for (let beat = 0; beat < 4; beat += 1) {
      vi.advanceTimersByTime(25_000);
      latest().fire('ping');
    }

    expect(FakeEventSource.instances).toHaveLength(1);
    connection.close();
  });

  it('puts a single-use ticket in the URL, never the session token', async () => {
    const connection = new SseConnection();
    await settle();

    expect(post).toHaveBeenCalledWith('/realtime/ticket');
    expect(latest().url).toContain('ticket=ticket-1');
    expect(latest().url).not.toContain('token');
    connection.close();
  });

  it('buys a new ticket for every reconnection', async () => {
    const connection = new SseConnection();
    await settle();
    latest().onerror?.();
    await vi.advanceTimersByTimeAsync(3_000);

    expect(latest().url).toContain('ticket=ticket-2');
    connection.close();
  });

  it('opens nothing without a session', async () => {
    localStorage.clear();
    const connection = new SseConnection();
    await settle();

    expect(post).not.toHaveBeenCalled();
    expect(FakeEventSource.instances).toHaveLength(0);
    connection.close();
  });

  it('retries when a ticket cannot be had', async () => {
    post.mockRejectedValueOnce(new Error('network'));
    const connection = new SseConnection();
    await settle();
    expect(FakeEventSource.instances).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(3_000);
    expect(FakeEventSource.instances).toHaveLength(1);
    connection.close();
  });

  it('closes the stream at sign-out and keeps its subscribers for the next account', async () => {
    const connection = new SseConnection();
    await settle();
    const seen: SseMessage[] = [];
    connection.subscribe((message) => seen.push(message));
    const first = latest();
    first.fire('connected');

    localStorage.clear();
    connection.restart();
    await settle();
    expect(first.closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(1);

    localStorage.setItem('date-harvest-hub-session', JSON.stringify({ access_token: 'token-b' }));
    connection.restart();
    await settle();
    latest().fire('connected');

    expect(FakeEventSource.instances).toHaveLength(2);
    expect(seen).toHaveLength(2);
    expect(seen[1].eventName === 'connected' && seen[1].payload.reconnected).toBe(false);
    connection.close();
  });

  it('throws away a ticket bought for the previous account', async () => {
    let answer: (value: unknown) => void = () => undefined;
    post.mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));
    const connection = new SseConnection();
    await settle();

    localStorage.clear();
    connection.restart();
    answer({ data: { data: { ticket: 'old-account' } } });
    await settle();

    expect(FakeEventSource.instances).toHaveLength(0);
    connection.close();
  });
});
