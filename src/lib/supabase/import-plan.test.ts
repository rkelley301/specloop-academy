import { describe, expect, it } from "vitest";
import { createInitialState, reduce } from "../reducer";
import { AppStateSchema } from "../types";
import { hasImportableData, mergeImport, planImport } from "./import-plan";
import { diffStates, isInsertOnly } from "./sync";
import { UID, ctx, profile, richState, run, uuid } from "./sync-fixture";

function accountWithOverlap() {
  const c = ctx("2026-10-25");
  let acc = run(createInitialState(c.nowIso), [{ type: "saveProfile", profile: { ...profile, displayName: "Account" } }], c);
  acc = run(
    acc,
    [
      { type: "completeLesson", lessonId: "sl02" },
      { type: "answerQuestion", lessonId: "sl02", questionId: "sl02-q1", kind: "recall", context: "lesson", response: "acc", result: "correct" },
      { type: "attachAudio", asset: { id: uuid(), lessonId: "sl01", fileName: "acc.mp3", mimeType: "audio/mpeg", sizeBytes: 5, scriptVersion: 1, provider: "manual_upload" } },
    ],
    c,
  );
  return acc;
}

describe("planImport / mergeImport", () => {
  it("is insert-only, keeps links intact, and reports skipped conflicts", () => {
    const local = reduce(richState(), { type: "updateLessonScript", lessonId: "sl03", script: "edited seed script" }, ctx());
    const localBefore = JSON.stringify(local);
    const account = accountWithOverlap();
    const plan = planImport(local, account, uuid);
    const merged = mergeImport(account, plan);

    expect(JSON.stringify(local)).toBe(localBefore); // local data untouched
    expect(AppStateSchema.safeParse(merged).success).toBe(true);
    expect(merged.profile?.displayName).toBe("Account"); // account profile kept

    const ops = diffStates(account, merged, UID);
    expect(ops.length).toBeGreaterThan(0);
    expect(isInsertOnly(account, ops, UID)).toBe(true);

    // Skipped: sl02 completion, sl02-q1 schedule, sl01 audio.
    expect(plan.summary.completions).toBe(0);
    expect(plan.summary.audio).toBe(0);
    expect(plan.summary.skipped.join("\n")).toMatch(/1 lesson completion/);
    expect(plan.summary.skipped.join("\n")).toMatch(/1 review schedule/);
    expect(plan.summary.skipped.join("\n")).toMatch(/1 audio file/);
    expect(plan.summary.skipped.join("\n")).toMatch(/1 edited seed lesson script/);
    expect(merged.reviewItems.filter((r) => r.questionId === "sl02-q1")).toHaveLength(1);

    // Ids: learner-owned remapped, seed ids preserved, cross-links consistent.
    const draft = merged.drafts.find((d) => d.generatedBy === "ai")!;
    const localDraft = local.drafts[0];
    expect(draft.id).not.toBe(localDraft.id);
    const lesson = merged.lessons[draft.publishedLessonId!];
    expect(lesson.draftId).toBe(draft.id);
    expect(lesson.questions.map((q) => q.id)).toEqual(draft.questions.map((q) => q.id));
    expect(lesson.sources[0].sourceId).toBe(merged.sources[0].id);
    expect(merged.sources[0].file!.blobId).not.toBe(local.sources[0].file!.blobId);
    expect(plan.files).toEqual([expect.objectContaining({ kind: "source", localId: local.sources[0].file!.blobId, newId: merged.sources[0].file!.blobId })]);
    const allQuestionIds = new Set(Object.values(merged.lessons).flatMap((l) => [...l.questions.map((q) => q.id), l.scenario.id]));
    for (const r of merged.reviewItems) expect(allQuestionIds.has(r.questionId)).toBe(true);
    for (const e of merged.reviewEvents) expect(merged.reviewItems.some((r) => r.id === e.reviewItemId)).toBe(true);
    expect(merged.attempts.some((a) => a.questionId === "sl02-s1")).toBe(true);
  });

  it("imports audio when the account has none, and drops files that failed to copy", () => {
    const local = richState();
    const account = run(createInitialState(ctx().nowIso), [{ type: "saveProfile", profile }]);
    const plan = planImport(local, account, uuid);
    expect(plan.summary.audio).toBe(1);
    const failed = new Set(plan.files.map((f) => f.newId));
    const merged = mergeImport(account, plan, failed);
    expect(merged.audioAssets).toHaveLength(0);
    expect(merged.sources[0].file).toBeUndefined();
    expect(merged.sources[0].notes).toMatch(/couldn't be copied/);
    expect(isInsertOnly(account, diffStates(account, merged, UID), UID)).toBe(true);
  });

  it("appends imported custom lessons after the account's own", () => {
    const local = richState();
    let account = run(createInitialState(ctx().nowIso), [{ type: "saveProfile", profile }]);
    const accPlan = planImport(local, account, uuid);
    account = mergeImport(account, accPlan); // account now has one custom lesson
    const merged = mergeImport(account, planImport(local, account, uuid));
    const custom = merged.paths.find((p) => p.id === "my-lessons")!;
    expect(custom.lessonIds).toHaveLength(2);
    expect(custom.lessonIds.map((id) => merged.lessons[id].order)).toEqual([1, 2]);
  });

  it("detects whether there's anything to import", () => {
    expect(hasImportableData(createInitialState(ctx().nowIso))).toBe(false);
    expect(hasImportableData(reduce(createInitialState(ctx().nowIso), { type: "completeLesson", lessonId: "sl01" }, ctx()))).toBe(true);
  });
});
