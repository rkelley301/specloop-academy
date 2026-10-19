"use client";

import { useSyncExternalStore } from "react";
import { BACKEND } from "./backend-mode";
import { localBlobStorage, setBlobStorage, supabaseBlobStorage } from "./blob-store";
import { localDateIn } from "./dates";
import { createInitialState, reduce, type Action } from "./reducer";
import { getBrowserSupabase } from "./supabase/browser";
import { applyOps, deleteAccountRows, loadAccountState } from "./supabase/remote";
import { diffStates, isInsertOnly } from "./supabase/sync";
import { AppStateSchema, type AppState } from "./types";

// App state store with two backends:
//
// - Local demo mode (both Supabase variables absent): one JSON document in
//   localStorage, files in IndexedDB. Single user, no auth.
// - Hosted mode (Supabase configured): state is loaded from the signed-in
//   user's rows; every change is diffed into database writes.
//
// Hosted mode fails closed. A missing variable, an unreachable project, or a
// failed write puts the app in an error state. It never falls back to
// browser storage.

export const STORAGE_KEY = "specloop:v1";

export type Account = { userId: string; email: string | null };

export type StoreSnapshot =
  | { status: "loading" }
  | { status: "signed-out" }
  | {
      status: "ready";
      state: AppState;
      backend: "local" | "supabase";
      /** Local mode: whether localStorage accepted the write. */
      persisted: boolean;
      account: Account | null;
      saving: boolean;
    }
  | { status: "error"; kind: "local-data"; message: string; raw: string | null }
  | { status: "error"; kind: "config" | "remote"; message: string };

const LOADING: StoreSnapshot = { status: "loading" };
let snapshot: StoreSnapshot = LOADING;
let started = false;
const listeners = new Set<() => void>();

function set(next: StoreSnapshot) {
  snapshot = next;
  for (const l of listeners) l();
}

/** Plain UUIDs, so ids are valid in uuid columns in hosted mode. */
export function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback (very old browsers): RFC 4122 v4 from Math.random.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ---------------------------------------------------------------- local mode

/** Reads the local demo document without touching the store (also used by import). */
export function readLocalState():
  | { ok: true; state: AppState | null }
  | { ok: false; message: string; raw: string | null; blocked?: boolean } {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return { ok: false, message: "This browser blocked local storage.", raw: null, blocked: true };
  }
  if (!raw) return { ok: true, state: null };
  try {
    const parsed = AppStateSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { ok: false, message: `Saved data didn't pass validation (${issue?.path.join(".") || "root"}: ${issue?.message}).`, raw };
    }
    return { ok: true, state: parsed.data };
  } catch {
    return { ok: false, message: "Saved data isn't valid JSON.", raw };
  }
}

function startLocal() {
  setBlobStorage(localBlobStorage);
  const r = readLocalState();
  if (r.ok) {
    set({ status: "ready", state: r.state ?? createInitialState(new Date().toISOString()), backend: "local", persisted: true, account: null, saving: false });
  } else if (r.blocked) {
    set({ status: "ready", state: createInitialState(new Date().toISOString()), backend: "local", persisted: false, account: null, saving: false });
  } else {
    set({ status: "error", kind: "local-data", message: r.message, raw: r.raw });
  }
}

function persistLocal(state: AppState): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

// --------------------------------------------------------------- hosted mode

let writeQueue: Promise<void> = Promise.resolve();
let pendingWrites = 0;
/** Set after a failed write: no further writes are attempted until reload. */
let halted = false;

async function loadAccount() {
  set(LOADING);
  try {
    const sb = getBrowserSupabase();
    const { data, error } = await sb.auth.getUser();
    if (error || !data.user) {
      set({ status: "signed-out" });
      return;
    }
    const uid = data.user.id;
    setBlobStorage(supabaseBlobStorage(sb, uid));
    const state = await loadAccountState(sb, uid);
    set({ status: "ready", state, backend: "supabase", persisted: true, account: { userId: uid, email: data.user.email ?? null }, saving: false });
  } catch (e) {
    set({
      status: "error",
      kind: "remote",
      message: `Couldn't load your account data. ${e instanceof Error ? e.message : ""} Nothing has been saved to this browser instead.`.trim(),
    });
  }
}

function startHosted() {
  void loadAccount();
  const sb = getBrowserSupabase();
  sb.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") set({ status: "signed-out" });
    if (event === "SIGNED_IN" && snapshot.status === "signed-out") void loadAccount();
  });
}

function ensureStarted() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (BACKEND.mode === "local") startLocal();
  else if (BACKEND.mode === "misconfigured") set({ status: "error", kind: "config", message: BACKEND.problem });
  else startHosted();
}

/** Runs remote writes one at a time; the first failure stops the app (fail closed). */
function enqueue(work: () => Promise<void>) {
  if (halted) return;
  pendingWrites += 1;
  writeQueue = writeQueue
    .then(() => (halted ? undefined : work()))
    .then(() => {
      pendingWrites -= 1;
      if (snapshot.status === "ready" && pendingWrites === 0) set({ ...snapshot, saving: false });
    })
    .catch((e: unknown) => {
      halted = true;
      pendingWrites = 0;
      set({
        status: "error",
        kind: "remote",
        message: `Your last change couldn't be saved to the server. ${e instanceof Error ? e.message : ""} Reload to see what's saved.`.trim(),
      });
    });
}

// ---------------------------------------------------------------- dispatch

export class HostedModeRestriction extends Error {}

export function dispatch(action: Action) {
  ensureStarted();
  if (halted) return;
  if (snapshot.status !== "ready") {
    if (BACKEND.mode === "local" && (action.type === "resetAll" || action.type === "replaceState")) {
      const now = new Date();
      const base = createInitialState(now.toISOString());
      const next = reduce(base, action, { nowIso: now.toISOString(), today: localDateIn("UTC", now), newId: newClientId });
      set({ status: "ready", state: next, backend: "local", persisted: persistLocal(next), account: null, saving: false });
    }
    return;
  }
  const current = snapshot.state;
  if (snapshot.backend === "supabase") {
    // Destructive whole-state actions don't exist in hosted mode; use
    // deleteMyData() or importLocalData() instead.
    if (action.type === "resetAll" || action.type === "replaceState") return;
    // Seed lessons are shared, read-only content in hosted mode.
    if (action.type === "updateLessonScript" && current.lessons[action.lessonId]?.origin === "seed") return;
  }
  const now = new Date();
  const next = reduce(current, action, {
    nowIso: now.toISOString(),
    today: localDateIn(current.profile?.timezone ?? "UTC", now),
    newId: newClientId,
  });
  if (next === current) return;

  if (snapshot.backend === "local") {
    set({ ...snapshot, state: next, persisted: persistLocal(next) });
    return;
  }
  const account = snapshot.account!;
  const ops = diffStates(current, next, account.userId);
  set({ ...snapshot, state: next, saving: ops.length > 0 });
  if (ops.length) enqueue(() => applyOps(getBrowserSupabase(), ops));
}

// ------------------------------------------------------- account operations

/** Resolves once every queued remote write has finished (or failed). */
export function flushWrites(): Promise<void> {
  return writeQueue;
}

export async function signOut() {
  if (BACKEND.mode !== "supabase") return;
  await flushWrites();
  await getBrowserSupabase().auth.signOut();
  set({ status: "signed-out" });
}

/** Local mode: wipe this browser's demo data. */
export function clearStoredState() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  if (BACKEND.mode === "local") {
    set({ status: "ready", state: createInitialState(new Date().toISOString()), backend: "local", persisted: true, account: null, saving: false });
  }
}

/** Hosted mode: delete this user's rows and files. The sign-in account itself remains. */
export async function deleteMyHostedData() {
  if (snapshot.status !== "ready" || snapshot.backend !== "supabase" || !snapshot.account) return;
  const sb = getBrowserSupabase();
  const uid = snapshot.account.userId;
  await flushWrites();
  await supabaseBlobStorage(sb, uid).clear();
  await deleteAccountRows(sb, uid);
  await loadAccount();
}

/**
 * Hosted mode: adds already-planned import data to the account. Refuses
 * anything that would update or delete existing rows.
 */
export async function commitImport(merged: AppState) {
  if (snapshot.status !== "ready" || snapshot.backend !== "supabase" || !snapshot.account) throw new Error("Sign in first.");
  const uid = snapshot.account.userId;
  await flushWrites();
  if (halted) throw new Error("A previous save failed. Reload before importing.");
  if (snapshot.status !== "ready") throw new Error("Account data isn't loaded.");
  const current = snapshot.state;
  const ops = diffStates(current, merged, uid);
  if (!isInsertOnly(current, ops, uid)) throw new Error("Import aborted: it would have changed existing account data.");
  await applyOps(getBrowserSupabase(), ops);
  if (snapshot.status === "ready" && snapshot.account?.userId === uid) set({ ...snapshot, state: merged, saving: false });
}

export function retryLoad() {
  if (BACKEND.mode === "supabase") void loadAccount();
}

// ---------------------------------------------------------------- React hook

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (BACKEND.mode === "local" && e.key === STORAGE_KEY) {
      started = false;
      ensureStarted();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): StoreSnapshot {
  ensureStarted();
  return snapshot;
}

function getServerSnapshot(): StoreSnapshot {
  return LOADING;
}

export function useStore(): StoreSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
