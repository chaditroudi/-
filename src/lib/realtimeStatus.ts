/** What the stream is really doing, so a screen can say so instead of claiming to be live. */
export type RealtimeState = 'idle' | 'connecting' | 'live' | 'reconnecting';

export type RealtimeStatus = {
  state: RealtimeState;
  /** When the stream last worked. Anything on screen may be older than this. */
  lastLiveAt: number | null;
};

let status: RealtimeStatus = { state: 'idle', lastLiveAt: null };
const listeners = new Set<() => void>();

export const getRealtimeStatus = () => status;

export const setRealtimeState = (state: RealtimeState) => {
  const lastLiveAt = state === 'live' || status.state === 'live' ? Date.now() : status.lastLiveAt;
  if (state === status.state && state !== 'live') return;
  status = { state, lastLiveAt: state === 'idle' ? null : lastLiveAt };
  listeners.forEach((listener) => listener());
};

export const subscribeRealtimeStatus = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

const time = (at: number) => new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export const describeRealtime = ({ state, lastLiveAt }: RealtimeStatus, online: boolean) => {
  const since = lastLiveAt ? `, données de ${time(lastLiveAt)}` : '';
  // `key` and `at` let the indicator say the same thing in the reader's language.
  const at = lastLiveAt ? time(lastLiveAt) : null;
  if (!online) return { key: 'offline' as const, at, label: `Hors ligne${since}`, tone: 'bad' as const };
  if (state === 'live') return { key: 'live' as const, at: null, label: 'En direct', tone: 'good' as const };
  if (state === 'reconnecting') return { key: 'reconnecting' as const, at, label: `Reconnexion${since}`, tone: 'bad' as const };
  if (state === 'connecting') return { key: 'connecting' as const, at: null, label: 'Connexion…', tone: 'wait' as const };
  return null;
};
