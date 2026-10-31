const OPEN_TIMEOUT_MS = 4000;

/**
 * A stuck open never settles on its own, and nothing that depends on local
 * storage may hang a confirmation: past the delay it fails like any other error.
 */
export const openIndexedDb = (name: string, version: number, upgrade: (db: IDBDatabase) => void) =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, version);
    const timer = window.setTimeout(() => reject(new Error('Stockage local indisponible.')), OPEN_TIMEOUT_MS);
    let settledLate = false;
    window.setTimeout(() => { settledLate = true; }, OPEN_TIMEOUT_MS);
    request.onupgradeneeded = () => upgrade(request.result);
    request.onsuccess = () => {
      window.clearTimeout(timer);
      if (settledLate) request.result.close();
      else resolve(request.result);
    };
    request.onerror = () => {
      window.clearTimeout(timer);
      reject(request.error);
    };
  });
