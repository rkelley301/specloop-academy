import type { AppState } from "../types";
import { KEYED_TABLES, TABLE_KEYS, rowKey, stateToRows, type KeyedTable, type Row } from "./rows";

// Turns a state change into ordered database operations. Upserts run parents
// first (lessons before questions, sources before drafts); deletes run in
// reverse so foreign keys are never violated.

export type SyncOp =
  | { kind: "upsert"; table: KeyedTable; rows: Row[]; onConflict: string }
  | { kind: "delete"; table: KeyedTable; keys: Record<string, unknown>[] }
  | { kind: "replaceAttributions"; owner: "lesson_id" | "draft_id"; ownerId: string; rows: Row[] };

const stable = (v: unknown) => JSON.stringify(v);

export function diffStates(prev: AppState, next: AppState, uid: string): SyncOp[] {
  const a = stateToRows(prev, uid);
  const b = stateToRows(next, uid);
  const upserts: SyncOp[] = [];
  const deletes: SyncOp[] = [];

  for (const table of KEYED_TABLES) {
    const before = new Map(a.tables[table].map((r) => [rowKey(table, r), r]));
    const after = new Map(b.tables[table].map((r) => [rowKey(table, r), r]));
    const changed = [...after.entries()].filter(([k, r]) => !before.has(k) || stable(before.get(k)) !== stable(r)).map(([, r]) => r);
    if (changed.length) upserts.push({ kind: "upsert", table, rows: changed, onConflict: TABLE_KEYS[table].join(",") });
    const removed = [...before.entries()].filter(([k]) => !after.has(k)).map(([, r]) => Object.fromEntries(TABLE_KEYS[table].map((c) => [c, r[c]])));
    if (removed.length) deletes.unshift({ kind: "delete", table, keys: removed });
  }

  const attr: SyncOp[] = [];
  for (const [owner, prevGroups, nextGroups] of [
    ["lesson_id", a.attributions.byLesson, b.attributions.byLesson],
    ["draft_id", a.attributions.byDraft, b.attributions.byDraft],
  ] as const) {
    for (const [id, rows] of Object.entries(nextGroups)) {
      if (stable(prevGroups[id]) !== stable(rows)) attr.push({ kind: "replaceAttributions", owner, ownerId: id, rows });
    }
    // Removed owners: attributions cascade with the lesson/draft delete.
  }

  // Attributions reference lessons, drafts and sources, so they go after every upsert.
  return [...deletes, ...upserts, ...attr];
}

/** True when ops only add new rows (used to prove an import is non-destructive). */
export function isInsertOnly(prev: AppState, ops: SyncOp[], uid: string): boolean {
  const existing = stateToRows(prev, uid);
  for (const op of ops) {
    if (op.kind === "delete") return false;
    if (op.kind === "replaceAttributions") {
      const groups = op.owner === "lesson_id" ? existing.attributions.byLesson : existing.attributions.byDraft;
      if (groups[op.ownerId]) return false;
      continue;
    }
    const keys = new Set(existing.tables[op.table].map((r) => rowKey(op.table, r)));
    if (op.rows.some((r) => keys.has(rowKey(op.table, r)))) return false;
  }
  return true;
}
