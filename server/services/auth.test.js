// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createAccessToken, createSessionPayload, extractBearerToken, SESSION_DURATION_SECONDS, verifyAccessToken } from './auth.js';

describe('auth service', () => {
  const secret = 'test-secret';
  const user = { id: 'user-1', email: 'user@example.com' };

  it('creates and verifies a JWT access token', () => {
    const token = createAccessToken(user, secret, { roles: ['admin'] });
    const payload = verifyAccessToken(token, secret);

    expect(payload.sub).toBe(user.id);
    expect(payload.email).toBe(user.email);
    expect(payload.roles).toEqual(['admin']);
  });

  it('builds a session payload with bearer semantics', () => {
    const session = createSessionPayload(user, secret, {
      user_metadata: { roles: ['responsable_production'], domains: ['production'] },
    });

    expect(session.token_type).toBe('bearer');
    expect(session.expires_in).toBe(SESSION_DURATION_SECONDS);
    expect(session.user.email).toBe(user.email);
    expect(session.user.user_metadata.domains).toEqual(['production']);
  });

  it('extracts bearer tokens from authorization headers', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(extractBearerToken('Basic test')).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
  });
});
