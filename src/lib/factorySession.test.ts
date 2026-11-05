import { describe, expect, it, vi } from 'vitest';
import { axiosClient } from './axiosClient';

describe('shared tablet response ownership', () => {
  it('refuses a late response after another factory signs in', async () => {
    const session = (factory: string) => JSON.stringify({ access_token: factory, user: { id: 'same-user', tenant_id: 'company', factory_id: factory } });
    localStorage.setItem('date-harvest-hub-session', session('a'));
    let finish!: () => void;
    const request = axiosClient.get('/stock/lots', { adapter: async (config) => {
      await new Promise<void>((resolve) => { finish = resolve; });
      return { data: { data: [{ id: 'private-a' }] }, status: 200, statusText: 'OK', headers: {}, config };
    } });
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    localStorage.setItem('date-harvest-hub-session', session('b'));
    finish();
    await expect(request).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  });
});
