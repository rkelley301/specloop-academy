import type { SupabaseClient } from "@supabase/supabase-js";
import { SEED_LESSON_COUNT, SEED_PATH_ID } from "../seed/ccst-level1";
import type { AppState } from "../types";
import { rowsToState, type LoadedRows, type Row } from "./rows";
import type { SyncOp } from "./sync";

// Reads and writes an account's data. Every call goes through the signed-in
// user's client, so row-level security decides what is visible.

const PAGE = 1000;
const CHUNK = 500;

export class RemoteError extends Error {}

function fail(what: string, err: { message: string } | null): never {
  throw new RemoteError(`${what}: ${err?.message ?? "unknown error"}`);
}

async function selectAll(sb: SupabaseClient, table: string, filter?: (q: ReturnType<ReturnType<SupabaseClient["from"]>["select"]>) => unknown): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select("*");
    if (filter) q = filter(q) as typeof q;
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) fail(`Couldn't load ${table}`, error);
    out.push(...(data as Row[]));
    if (!data || data.length < PAGE) return out;
  }
}

export async function loadAccountState(sb: SupabaseClient, uid: string): Promise<AppState> {
  // The shared seed course must be installed (migration 0003); fail closed if not.
  const { count, error } = await sb.from("lessons").select("id", { count: "exact", head: true }).eq("path_id", SEED_PATH_ID).is("owner_id", null);
  if (error) fail("Couldn't reach the lesson tables", error);
  if ((count ?? 0) < SEED_LESSON_COUNT) {
    throw new RemoteError(
      `The seed course isn't installed in this Supabase project (found ${count ?? 0} of ${SEED_LESSON_COUNT} lessons). Run supabase/migrations/0003_seed_ccst_l1.sql.`,
    );
  }
  const own = (col: string) => (q: { eq: (c: string, v: string) => unknown }) => q.eq(col, uid);
  const [profiles, learning_paths, lessons, sources, lesson_drafts, audio_assets, attempts, lesson_completions, review_items, review_events] = await Promise.all([
    selectAll(sb, "profiles", own("user_id")),
    selectAll(sb, "learning_paths", own("owner_id")),
    selectAll(sb, "lessons", own("owner_id")),
    selectAll(sb, "sources", own("user_id")),
    selectAll(sb, "lesson_drafts", own("user_id")),
    selectAll(sb, "audio_assets", own("user_id")),
    selectAll(sb, "attempts", own("user_id")),
    selectAll(sb, "lesson_completions", own("user_id")),
    selectAll(sb, "review_items", own("user_id")),
    selectAll(sb, "review_events", own("user_id")),
  ]);
  const lessonIds = lessons.map((l) => String(l.id));
  const draftIds = lesson_drafts.map((d) => String(d.id));
  const inList = (col: string, ids: string[]) => (q: { in: (c: string, v: string[]) => unknown }) => q.in(col, ids);
  const [lesson_script_versions, concepts, questions, lessonAttr, draftAttr] = await Promise.all([
    lessonIds.length ? selectAll(sb, "lesson_script_versions", inList("lesson_id", lessonIds)) : [],
    lessonIds.length ? selectAll(sb, "concepts", inList("lesson_id", lessonIds)) : [],
    lessonIds.length ? selectAll(sb, "questions", inList("lesson_id", lessonIds)) : [],
    lessonIds.length ? selectAll(sb, "lesson_attributions", inList("lesson_id", lessonIds)) : [],
    draftIds.length ? selectAll(sb, "lesson_attributions", inList("draft_id", draftIds)) : [],
  ]);
  const rows: LoadedRows = {
    profiles,
    learning_paths,
    lessons,
    lesson_script_versions,
    concepts,
    questions,
    lesson_attributions: [...lessonAttr, ...draftAttr],
    sources,
    lesson_drafts,
    audio_assets,
    attempts,
    lesson_completions,
    review_items,
    review_events,
  };
  return rowsToState(rows, new Date().toISOString());
}

export async function applyOps(sb: SupabaseClient, ops: SyncOp[]): Promise<void> {
  for (const op of ops) {
    if (op.kind === "upsert") {
      for (let i = 0; i < op.rows.length; i += CHUNK) {
        const { error } = await sb.from(op.table).upsert(op.rows.slice(i, i + CHUNK), { onConflict: op.onConflict });
        if (error) fail(`Couldn't save ${op.table}`, error);
      }
    } else if (op.kind === "delete") {
      for (const key of op.keys) {
        let q = sb.from(op.table).delete();
        for (const [c, v] of Object.entries(key)) q = q.eq(c, v as string);
        const { error } = await q;
        if (error) fail(`Couldn't delete from ${op.table}`, error);
      }
    } else {
      const { error } = await sb.from("lesson_attributions").delete().eq(op.owner, op.ownerId);
      if (error) fail("Couldn't update attributions", error);
      if (op.rows.length) {
        const { error: insErr } = await sb.from("lesson_attributions").insert(op.rows);
        if (insErr) fail("Couldn't save attributions", insErr);
      }
    }
  }
}

/** Deletes all of this user's rows (not the auth account itself) in dependency order. */
export async function deleteAccountRows(sb: SupabaseClient, uid: string): Promise<void> {
  const steps: [string, string][] = [
    ["review_events", "user_id"],
    ["review_items", "user_id"],
    ["lesson_completions", "user_id"],
    ["attempts", "user_id"],
    ["audio_assets", "user_id"],
    ["lesson_drafts", "user_id"],
    ["lessons", "owner_id"],
    ["learning_paths", "owner_id"],
    ["sources", "user_id"],
    ["profiles", "user_id"],
  ];
  for (const [table, col] of steps) {
    const { error } = await sb.from(table).delete().eq(col, uid);
    if (error) fail(`Couldn't delete ${table}`, error);
  }
}
