import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocalDraft, listLocalDrafts, saveLocalDraft } from './draftStore';
import { createIntakeDraft } from '@/lib/receptionIntake';

const database = vi.hoisted(() => ({ rows: new Map<string, any>() }));
vi.mock('@/lib/offline/idb', () => {
  const request = (result?: unknown) => {
    const pending: { result?: unknown; onsuccess?: () => void } = { result };
    queueMicrotask(() => pending.onsuccess?.());
    return pending;
  };
  const store = {
    get: (key: string) => request(database.rows.get(key)), getAll: () => request([...database.rows.values()]),
    put: (row: any) => { database.rows.set(row.storageId, row); return request(); },
  };
  return { openIndexedDb: async () => ({ transaction: () => ({ objectStore: () => store }), close: () => undefined }) };
});
const signIn = (factory: string, id = 'same-user') => localStorage.setItem('date-harvest-hub-session', JSON.stringify({
  access_token: `token-${factory}`, user: { id, tenant_id: 'company', factory_id: factory },
}));
beforeEach(() => { database.rows.clear(); localStorage.clear(); signIn('a'); });
afterEach(() => localStorage.clear());

describe('factory-owned tablet drafts', () => {
  it('keeps equal draft ids separate after a user moves factory and never falls back to an unknown owner', async () => {
    const draft = { ...createIntakeDraft(), id: 'same-draft', supplier_label: 'Private A' };
    await saveLocalDraft(draft, 'same-user');
    signIn('b');
    expect(await getLocalDraft('same-draft')).toBeUndefined();
    expect(await listLocalDrafts()).toEqual([]);
    await saveLocalDraft({ ...draft, supplier_label: 'Private B' }, 'same-user');
    expect((await getLocalDraft('same-draft'))?.draft.supplier_label).toBe('Private B');
    signIn('a');
    expect((await getLocalDraft('same-draft'))?.draft.supplier_label).toBe('Private A');
    signIn('a', 'other-user');
    expect(await getLocalDraft('same-draft')).toBeUndefined();
    expect(database.rows.size).toBe(2);
  });
  it('rejects an old form save instead of writing its content into a newly selected factory', async () => {
    const scope = JSON.stringify(['same-user', 'company', 'a']);
    signIn('b');
    await expect(saveLocalDraft(createIntakeDraft(), 'same-user', scope)).rejects.toThrow(/Factory session/);
    expect(database.rows.size).toBe(0);
  });
});
