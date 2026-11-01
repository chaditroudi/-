import { classifyFailure, type FailureKind } from './apiErrors';

/** The condition of one piece of data on screen. Only `ready` and `stale` may show it. */
export type DataCondition = 'loading' | 'ready' | 'empty' | 'error' | 'restricted' | 'session' | 'notFound' | 'offline' | 'stale';

export type DataConditionInput = {
  isLoading?: boolean;
  error?: unknown;
  /** Undefined until something has been received. */
  data?: unknown;
  isEmpty?: boolean;
  online?: boolean;
};

const holdsData = (data: unknown) => data !== undefined && data !== null;

export const isEmptyData = (data: unknown) => Array.isArray(data) && data.length === 0;

export const resolveDataCondition = ({ isLoading, error, data, isEmpty, online = true }: DataConditionInput): DataCondition => {
  const failure: FailureKind | null = error ? classifyFailure(error, online) : null;
  // Whatever is held from before, this account may not see it.
  if (failure === 'session') return 'session';
  if (failure === 'restricted') return 'restricted';
  if (failure === 'notFound') return 'notFound';
  if (failure) {
    if (holdsData(data)) return 'stale';
    return failure === 'offline' ? 'offline' : 'error';
  }
  if (!holdsData(data)) return isLoading ? 'loading' : online ? 'loading' : 'offline';
  if (isLoading) return 'loading';
  if (!online) return 'stale';
  return (isEmpty ?? isEmptyData(data)) ? 'empty' : 'ready';
};

/** A figure the screen does not know is not zero. */
export const knownCount = <T>(condition: DataCondition, rows: T[] | undefined, count: (rows: T[]) => number) =>
  (condition === 'ready' || condition === 'empty' || condition === 'stale') && rows ? count(rows) : null;

export const conditionLabel = (condition: DataCondition) => {
  if (condition === 'restricted') return 'Accès réservé';
  if (condition === 'session') return 'Session expirée';
  if (condition === 'notFound') return 'Introuvable';
  if (condition === 'offline') return 'Hors ligne';
  if (condition === 'error') return 'Indisponible';
  if (condition === 'loading') return 'Chargement…';
  return null;
};
