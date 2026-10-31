import { describe, expect, it } from 'vitest';

import { ApiRequestError } from '@/lib/axiosClient';
import { isOutboxRetryable, isSessionExpiredError } from './outbox';

describe('W3 offline outbox retry classification', () => {
  it('retries transport, server, and in-progress conflicts', () => {
    expect(isOutboxRetryable(new ApiRequestError({
      message: 'offline',
      isNetworkError: true,
    }))).toBe(true);
    expect(isOutboxRetryable(new ApiRequestError({ message: 'busy', status: 409, code: 'IDEMPOTENT_IN_PROGRESS' }))).toBe(true);
    expect(isOutboxRetryable(new ApiRequestError({ message: 'server', status: 503 }))).toBe(true);
  });

  it('keeps a queued delivery when the session has ended', () => {
    const expired = new ApiRequestError({ message: 'auth', status: 401 });
    expect(isOutboxRetryable(expired)).toBe(true);
    expect(isSessionExpiredError(expired)).toBe(true);
  });

  it('asks a person to resolve business conflicts instead of retrying forever', () => {
    expect(isOutboxRetryable(new ApiRequestError({ message: 'stale', status: 409, code: 'DRAFT_STALE' }))).toBe(false);
    expect(isOutboxRetryable(new ApiRequestError({ message: 'other', status: 409, code: 'IDEMPOTENT_PAYLOAD_MISMATCH' }))).toBe(false);
  });

  it('leaves validation and permission failures for operator action', () => {
    expect(isOutboxRetryable(new ApiRequestError({ message: 'bad', status: 400 }))).toBe(false);
    expect(isOutboxRetryable(new ApiRequestError({ message: 'forbidden', status: 403 }))).toBe(false);
  });
});
