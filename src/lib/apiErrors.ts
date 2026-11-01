/** Why data is missing. Screens state this; they never turn it into an empty result. */
export type FailureKind = 'restricted' | 'session' | 'offline' | 'server' | 'notFound' | 'invalid';

export const classifyFailure = (error: unknown, online = true): FailureKind => {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = error.status;
    if (status === 403) return 'restricted';
    if (status === 401) return 'session';
    if (status === 404) return 'notFound';
    if (status === null || status === 'FETCH_ERROR') return online ? 'server' : 'offline';
    if (typeof status === 'number' && status >= 500) return 'server';
    return 'invalid';
  }
  return online ? 'server' : 'offline';
};

/** Retrying cannot change a refusal, and repeating one only delays saying so. */
export const shouldRetryQuery = (failureCount: number, error: unknown) => {
  const kind = classifyFailure(error);
  return failureCount < 1 && kind !== 'restricted' && kind !== 'session' && kind !== 'notFound' && kind !== 'invalid';
};

const EN_SERVER_MESSAGE = /^(You do not have|Request failed|Network Error|MongoDB|Forbidden|Unauthorized)/i;

/** What an employee reads in a toast: the server's reason when it wrote one for them. */
export const failureMessage = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!message || EN_SERVER_MESSAGE.test(message)) return fallback;
  return message;
};
