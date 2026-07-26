import { describe, expect, it } from 'vitest';

import { ApiRequestError } from '@/lib/axiosClient';
import { isOutboxRetryable } from './outbox';

describe('W3 offline outbox retry classification', () => {
  it('retries transport, server, and in-progress conflicts', () => {
    expect(isOutboxRetryable(new ApiRequestError({
      message: 'offline',
      isNetworkError: true,
    }))).toBe(true);
    expect(isOutboxRetryable(new ApiRequestError({ message: 'busy', status: 409 }))).toBe(true);
    expect(isOutboxRetryable(new ApiRequestError({ message: 'server', status: 503 }))).toBe(true);
  });

  it('leaves validation and authentication failures for operator action', () => {
    expect(isOutboxRetryable(new ApiRequestError({ message: 'bad', status: 400 }))).toBe(false);
    expect(isOutboxRetryable(new ApiRequestError({ message: 'auth', status: 401 }))).toBe(false);
    expect(isOutboxRetryable(new ApiRequestError({ message: 'forbidden', status: 403 }))).toBe(false);
  });
});
