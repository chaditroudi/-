/**
 * Native EventSource-based SSE client for the NestJS realtime endpoint.
 *
 * Replaces the mongodb.channel() Supabase-facade with a plain HTTP SSE
 * connection to /api/realtime/events — no MongoDB SDK involved.
 */

const AUTH_STORAGE_KEY = 'date-harvest-hub-session';

const getToken = (): string | null => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    const session = raw ? JSON.parse(raw) : null;
    return session?.access_token ?? null;
  } catch {
    return null;
  }
};

const getRealtimeUrl = (): string | null => {
  const token = getToken();
  if (!token) return null;
  const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
  return `${base}/realtime/events?token=${encodeURIComponent(token)}`;
};

export type DbChangeEvent = {
  id?: string;
  type?: string;
  /** Semantic REST resource name (e.g. 'receptions', 'suppliers') — matches /api/<resource> paths */
  resource: string;
  /** Additional resources affected by this event */
  relatedResources?: string[];
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT' | 'SYNC';
  actorId?: string | null;
  rowIds?: string[];
  rows?: unknown[];
  at?: string;
};

export type SseMessage =
  | { eventName: 'db_change'; payload: DbChangeEvent }
  | { eventName: 'connected'; payload: { clientId: string; connectedClients: number; at: string; reconnected?: boolean } }
  | { eventName: 'ping'; payload: { at: string; connectedClients: number } };

export type SseSubscriber = (msg: SseMessage) => void;

const RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
/** The server pings every 25 s. A dropped link raises no error, so silence is the only sign. */
const SILENT_STREAM_MS = 40_000;
const WATCHDOG_INTERVAL_MS = 5_000;

export class SseConnection {
  private es: EventSource | null = null;
  private subscribers = new Set<SseSubscriber>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = RECONNECT_DELAY_MS;
  private closed = false;
  private connectedOnce = false;
  private lastMessageAt = 0;
  private watchdog: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.connect();
  }

  private startWatchdog() {
    if (this.watchdog) return;
    this.watchdog = setInterval(() => {
      if (!this.es || Date.now() - this.lastMessageAt < SILENT_STREAM_MS) return;
      this.es.close();
      this.es = null;
      this.scheduleReconnect();
    }, WATCHDOG_INTERVAL_MS);
  }

  private connect() {
    if (this.closed) return;
    const url = getRealtimeUrl();
    if (!url) return; // no token — will retry when subscribe() is called

    this.es = new EventSource(url);
    this.lastMessageAt = Date.now();
    this.startWatchdog();

    // Backend emits event name "db-change"
    this.es.addEventListener('db-change', (e: MessageEvent) => {
      this.lastMessageAt = Date.now();
      try {
        const payload: DbChangeEvent = JSON.parse(e.data);
        this.emit({ eventName: 'db_change', payload });
      } catch { /* malformed event */ }
    });

    this.es.addEventListener('connected', (e: MessageEvent) => {
      this.lastMessageAt = Date.now();
      try {
        this.reconnectDelay = RECONNECT_DELAY_MS; // reset backoff on success
        const payload = JSON.parse(e.data);
        const reconnected = this.connectedOnce;
        this.connectedOnce = true;
        this.emit({ eventName: 'connected', payload: { ...payload, reconnected } });
      } catch { /* ignore */ }
    });

    this.es.addEventListener('ping', (e: MessageEvent) => {
      this.lastMessageAt = Date.now();
      try {
        const payload = JSON.parse(e.data);
        this.emit({ eventName: 'ping', payload });
      } catch { /* ignore */ }
    });

    this.es.onerror = () => {
      this.es?.close();
      this.es = null;
      if (!this.closed) this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, MAX_RECONNECT_DELAY_MS);
      this.connect();
    }, this.reconnectDelay);
  }

  private emit(msg: SseMessage) {
    this.subscribers.forEach((cb) => cb(msg));
  }

  subscribe(cb: SseSubscriber): () => void {
    this.subscribers.add(cb);
    // If we aren't connected yet (e.g. no token at construction time), try now
    if (!this.es && !this.reconnectTimer && !this.closed) this.connect();
    return () => { this.subscribers.delete(cb); };
  }

  close() {
    this.closed = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.watchdog) { clearInterval(this.watchdog); this.watchdog = null; }
    this.es?.close();
    this.es = null;
    this.subscribers.clear();
  }
}

// Singleton connection shared across the app
let _singleton: SseConnection | null = null;

export const getSseConnection = (): SseConnection => {
  if (!_singleton) _singleton = new SseConnection();
  return _singleton;
};

export const resetSseConnection = () => {
  _singleton?.close();
  _singleton = null;
};
