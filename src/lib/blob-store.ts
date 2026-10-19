"use client";

// Binary files (lesson audio, uploaded PDFs) are kept in IndexedDB in local
// demo mode. Everything goes through BlobStorage so a hosted store (for
// example Supabase Storage with per-user private buckets) can replace it.

export interface BlobStorage {
  readonly mode: "local-indexeddb";
  put(id: string, blob: Blob): Promise<void>;
  get(id: string): Promise<Blob | null>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

const DB_NAME = "specloop-files";
const STORE = "blobs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser doesn't support IndexedDB, so files can't be stored."));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Couldn't open file storage."));
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    t.onerror = () => {
      db.close();
      reject(t.error ?? new Error("File storage error."));
    };
    t.onabort = () => {
      db.close();
      reject(t.error ?? new Error("File storage was aborted. The browser may be out of space."));
    };
  });
}

export const localBlobStorage: BlobStorage = {
  mode: "local-indexeddb",
  async put(id, blob) {
    await tx("readwrite", (s) => s.put(blob, id));
  },
  async get(id) {
    const v = await tx<unknown>("readonly", (s) => s.get(id));
    return v instanceof Blob ? v : null;
  },
  async remove(id) {
    await tx("readwrite", (s) => s.delete(id));
  },
  async clear() {
    await tx("readwrite", (s) => s.clear());
  },
};

export const blobStorage: BlobStorage = localBlobStorage;
