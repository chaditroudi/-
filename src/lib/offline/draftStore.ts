import { openIndexedDb } from '@/lib/offline/idb';
import type { IntakeDraft } from '@/lib/receptionIntake';

export type LocalIntakeDraft = {
  draft: IntakeDraft;
  ownerUserId: string | null;
  savedAt: string;
};

const DB_NAME = 'royal-palm-reception-drafts';
const STORE = 'drafts';

const openDb = () =>
  openIndexedDb(DB_NAME, 1, (db) => {
    db.createObjectStore(STORE, { keyPath: 'draft.id' });
  });

const run = async <T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) => {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = operation(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
};

/** Survives a reload, a closed tablet and an expired session. Photos included. */
export const saveLocalDraft = (draft: IntakeDraft, ownerUserId: string | null) =>
  run('readwrite', (store) => store.put({ draft, ownerUserId, savedAt: new Date().toISOString() } satisfies LocalIntakeDraft));

export const listLocalDrafts = () => run<LocalIntakeDraft[]>('readonly', (store) => store.getAll());

export const getLocalDraft = (id: string) => run<LocalIntakeDraft | undefined>('readonly', (store) => store.get(id));

export const deleteLocalDraft = (id: string) => run('readwrite', (store) => store.delete(id));
