import { describe, expect, it } from 'vitest';
import { isSessionEnded } from './axiosClient';

describe('isSessionEnded', () => {
  it('ends the session when the route guard refuses the token', () => {
    expect(isSessionEnded(401, 'SESSION_REQUIRED')).toBe(true);
  });

  it('keeps the session on a wrong PIN or password, which are also 401', () => {
    expect(isSessionEnded(401, 'UNAUTHORIZED')).toBe(false);
  });

  it('keeps the session on a permission refusal', () => {
    expect(isSessionEnded(403, 'FORBIDDEN')).toBe(false);
  });
});
