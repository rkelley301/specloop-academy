"use client";

import { useSyncExternalStore } from "react";
import { localDateIn } from "./dates";
import { createInitialState, reduce, type Action } from "./reducer";
import { AppStateSchema, type AppState } from "./types";

// Local demo-mode persistence. The whole learner state is one JSON document
// in localStorage (audio and PDF files live in IndexedDB; see blob-store.ts).
// This is single-user, unauthenticated storage on this device only. It is
// not secure multi-user auth.

export const STORAGE_KEY = "specloop:v1";

export type StoreSnapshot =
  | { status: "loading" }
  | { status: "ready"; state: AppState; persisted: boolean }
  | { status: "error"; message: string; raw: string | null };

const LOADING: StoreSnapshot = { status: "loading" };
let snapshot: StoreSnapshot = LOADING;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${rand}`;
}

function load(): StoreSnapshot {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage blocked (private mode, policy). Run in memory.
    return { status: "ready", state: createInitialState(new Date().toISOString()), persisted: false };
  }
  if (!raw) return { status: "ready", state: createInitialState(new Date().toISOString()), persisted: true };
  try {
    const parsed = AppStateSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return {
        status: "error",
        message: `Saved data didn't pass validation (${issue?.path.join(".") || "root"}: ${issue?.message}).`,
        raw,
      };
    }
    return { status: "ready", state: parsed.data, persisted: true };
  } catch {
    return { status: "error", message: "Saved data isn't valid JSON.", raw };
  }
}

function ensureLoaded() {
  if (snapshot.status === "loading" && typeof window !== "undefined") snapshot = load();
}

function persist(state: AppState): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function dispatch(action: Action) {
  ensureLoaded();
  let current: AppState;
  if (snapshot.status === "ready") current = snapshot.state;
  else if (action.type === "resetAll" || action.type === "replaceState") current = createInitialState(new Date().toISOString());
  else return;
  const now = new Date();
  const next = reduce(current, action, {
    nowIso: now.toISOString(),
    today: localDateIn(current.profile?.timezone ?? "UTC", now),
    newId,
  });
  snapshot = { status: "ready", state: next, persisted: persist(next) };
  emit();
}

/** Wipes everything in localStorage for this app (used by "Delete my data"). */
export function clearStoredState() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  snapshot = { status: "ready", state: createInitialState(new Date().toISOString()), persisted: true };
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      snapshot = load();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): StoreSnapshot {
  ensureLoaded();
  return snapshot;
}

function getServerSnapshot(): StoreSnapshot {
  return LOADING;
}

export function useStore(): StoreSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function newClientId(prefix: string) {
  return newId(prefix);
}
