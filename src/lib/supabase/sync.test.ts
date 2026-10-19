import { describe, expect, it } from "vitest";
import { templateDraft } from "../ai/draft-builders";
import { createInitialState, reduce } from "../reducer";
import type { AppState } from "../types";
import { rowsToState, stateToRows, type LoadedRows } from "./rows";
import { diffStates } from "./sync";
import { UID, ctx, profile, richState, run, uuid } from "./sync-fixture";

/** Simulates loading what stateToRows wrote, the way the database would return it. */
function asLoaded(s: AppState): LoadedRows {
  const r = stateToRows(s, UID);
  const attributions = [...Object.values(r.attributions.byLesson).flat(), ...Object.values(r.attributions.byDraft).flat()];
  return { ...r.tables, lesson_attributions: attributions } as LoadedRows;
}

describe("row mapping", () => {
  it("round-trips every entity through table rows", () => {
    const s = richState();
    const back = rowsToState(asLoaded(s), "2026-10-19T00:00:00.000Z");
    expect(JSON.parse(JSON.stringify(back))).toEqual(JSON.parse(JSON.stringify(s)));
  });

  it("never maps seed lessons, and scopes the custom path id to the user", () => {
    const r = stateToRows(richState(), UID);
    expect(r.tables.lessons.every((l) => l.owner_id === UID && l.origin === "draft")).toBe(true);
    expect(r.tables.learning_paths).toEqual([expect.objectContaining({ id: `my-lessons:${UID}`, owner_id: UID })]);
    expect(r.tables.sources[0].file_path).toMatch(new RegExp(`^${UID}/`));
    expect(r.tables.audio_assets[0].storage_path).toMatch(new RegExp(`^${UID}/`));
  });
});

describe("diffStates", () => {
  it("answering a question writes one attempt, one review item and one event", () => {
    const s = richState();
    const next = reduce(s, { type: "answerQuestion", lessonId: "sl03", questionId: "sl03-q1", kind: "recall", context: "lesson", response: "40", result: "correct" }, ctx());
    const ops = diffStates(s, next, UID);
    expect(ops.map((o) => (o.kind === "upsert" ? `${o.table}:${o.rows.length}` : o.kind))).toEqual(["attempts:1", "review_items:1", "review_events:1"]);
  });

  it("no-op actions produce no writes", () => {
    const s = richState();
    expect(diffStates(s, reduce(s, { type: "completeLesson", lessonId: "sl02" }, ctx()), UID)).toEqual([]);
  });

  it("deletes come first and in reverse dependency order", () => {
    const s = richState();
    const next = run(s, [
      { type: "uncompleteLesson", lessonId: "sl02" },
      { type: "removeAudio", assetId: s.audioAssets[0].id },
    ]);
    const ops = diffStates(s, next, UID);
    expect(ops).toEqual([
      { kind: "delete", table: "lesson_completions", keys: [{ user_id: UID, lesson_id: "sl02" }] },
      { kind: "delete", table: "audio_assets", keys: [{ id: s.audioAssets[0].id }] },
    ]);
  });

  it("publishing writes parents before children and attributions last", () => {
    const c = ctx();
    let s = run(createInitialState(c.nowIso), [{ type: "saveProfile", profile }]);
    s = reduce(s, { type: "addSource", id: uuid(), source: { title: "N", type: "own_notes", citation: "C", notes: "", text: "t", rightsConfirmed: true, confidentialityConfirmed: true } }, c);
    const d = uuid();
    s = reduce(s, { type: "createDraft", id: d, draft: templateDraft(s.sources[0], c.nowIso, uuid) }, c);
    const next = reduce(s, { type: "publishDraft", id: d, reviewerName: "Lead" }, c);
    const ops = diffStates(s, next, UID);
    const names = ops.map((o) => (o.kind === "upsert" ? o.table : o.kind === "replaceAttributions" ? `attr:${o.owner}` : `del:${o.table}`));
    expect(names).toEqual(["learning_paths", "lessons", "lesson_script_versions", "concepts", "questions", "lesson_drafts", "attr:lesson_id"]);
  });
});
