// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccessToken } from './auth.js';
import { ApiError } from './apiErrors.js';
import { authorizeRpc, authorizeTableAction, createOptionalAuthMiddleware, requireAuth, requireRoles } from './middleware.js';

const createRes = () => ({});

describe('middleware service', () => {
  const secret = 'middleware-secret';
  let db;

  beforeEach(() => {
    db = {
      collection: (name) => {
        if (name === 'auth_users') {
          return {
            findOne: vi.fn(async ({ id }) => (id === 'user-1' ? { id: 'user-1', email: 'user@example.com' } : null)),
          };
        }

        if (name === 'user_roles') {
          return {
            find: vi.fn(() => ({
              toArray: async () => [{ role: 'responsable_stock' }],
            })),
          };
        }

        throw new Error(`Unexpected collection: ${name}`);
      },
    };
  });

  it('hydrates req.auth from a valid bearer token', async () => {
    const middleware = createOptionalAuthMiddleware({ db, jwtSecret: secret });
    const token = createAccessToken({ id: 'user-1', email: 'user@example.com' }, secret);
    const req = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    };
    const next = vi.fn();

    await middleware(req, createRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.auth.user.email).toBe('user@example.com');
    expect(req.auth.roles).toEqual(expect.arrayContaining(['magasin']));
  });

  it('requireAuth rejects unauthenticated requests', () => {
    const next = vi.fn();
    requireAuth({ auth: null }, createRes(), next);

    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
  });

  it('requireRoles rejects users without the required role', () => {
    const next = vi.fn();
    const middleware = requireRoles(['qualite']);
    middleware({ auth: { user: { id: 'user-1' }, roles: ['magasin'] } }, createRes(), next);

    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(403);
  });

  it('authorizeTableAction checks normalized table permissions', () => {
    const next = vi.fn();
    const middleware = authorizeTableAction('write');
    middleware({
      auth: {
        user: { id: 'user-1' },
        rawRoles: ['responsable_stock'],
      },
      body: {
        table: 'stock_movements',
      },
    }, createRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('authorizeRpc blocks roles that are not allowed for the RPC', () => {
    const next = vi.fn();
    authorizeRpc({
      auth: {
        user: { id: 'user-2' },
        rawRoles: ['directeur_achat'],
      },
      params: {
        name: 'suggest_lots_for_picking',
      },
    }, createRes(), next);

    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(403);
  });
});
