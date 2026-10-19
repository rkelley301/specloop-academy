"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

// Binary files (lesson audio, uploaded PDFs). Local demo mode keeps them in
// IndexedDB; hosted mode keeps them in private Supabase Storage buckets under
// the signed-in user's folder. Callers use getBlobStorage().

export type FileKind = "audio" | "source";

export interface BlobStorage {
  readonly mode: "local-indexeddb" | "supabase-storage";
  put(kind: FileKind, id: string, blob: Blob, contentType?: string): Promise<void>;
  get(kind: FileKind, id: string): Promise<Blob | null>;
  remove(kind: FileKind, id: string): Promise<void>;
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

// Local ids are unique across kinds, so IndexedDB ignores `kind`.
export const localBlobStorage: BlobStorage = {
  mode: "local-indexeddb",
  async put(_kind, id, blob) {
    await tx("readwrite", (s) => s.put(blob, id));
  },
  async get(_kind, id) {
    const v = await tx<unknown>("readonly", (s) => s.get(id));
    return v instanceof Blob ? v : null;
  },
  async remove(_kind, id) {
    await tx("readwrite", (s) => s.delete(id));
  },
  async clear() {
    await tx("readwrite", (s) => s.clear());
  },
};

const BUCKET: Record<FileKind, string> = { audio: "audio", source: "sources" };

export function supabaseBlobStorage(sb: SupabaseClient, uid: string): BlobStorage {
  const path = (id: string) => `${uid}/${id}`;
  return {
    mode: "supabase-storage",
    async put(kind, id, blob, contentType) {
      const { error } = await sb.storage.from(BUCKET[kind]).upload(path(id), blob, { contentType: contentType || blob.type || undefined, upsert: false });
      if (error) throw new Error(`Couldn't upload the file: ${error.message}`);
    },
    async get(kind, id) {
      const { data, error } = await sb.storage.from(BUCKET[kind]).download(path(id));
      if (error) {
        if (/not.?found|404/i.test(error.message)) return null;
        throw new Error(`Couldn't download the file: ${error.message}`);
      }
      return data;
    },
    async remove(kind, id) {
      const { error } = await sb.storage.from(BUCKET[kind]).remove([path(id)]);
      if (error) throw new Error(`Couldn't delete the file: ${error.message}`);
    },
    async clear() {
      for (const bucket of Object.values(BUCKET)) {
        for (;;) {
          const { data, error } = await sb.storage.from(bucket).list(uid, { limit: 1000 });
          if (error) throw new Error(`Couldn't list files: ${error.message}`);
          if (!data?.length) break;
          const { error: rmErr } = await sb.storage.from(bucket).remove(data.map((f) => `${uid}/${f.name}`));
          if (rmErr) throw new Error(`Couldn't delete files: ${rmErr.message}`);
          if (data.length < 1000) break;
        }
      }
    },
  };
}

let active: BlobStorage = localBlobStorage;
export function setBlobStorage(b: BlobStorage) {
  active = b;
}
export function getBlobStorage(): BlobStorage {
  return active;
}
