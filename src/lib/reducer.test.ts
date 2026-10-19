import { describe, expect, it } from "vitest";
import { templateDraft } from "./ai/draft-builders";
import { CUSTOM_PATH_ID, createInitialState, reduce, type Action, type ReduceContext } from "./reducer";
import { dueReviews, nextLesson, streak } from "./selectors";
import { AppStateSchema, type AppState } from "./types";

function ctx(today: string, time = "12:00:00"): ReduceContext {
  let n = 0;
  return { nowIso: `${today}T${time}.000Z`, today, newId: (p) => `${p}_${today}_${++n}` };
}

function run(state: AppState, actions: Action[], c: ReduceContext) {
  return actions.reduce((s, a) => reduce(s, a, c), state);
}

const profile = {
  displayName: "Sam",
  experienceLevel: "apprentice" as const,
  goal: "Prepare for CCST Level 1",
  target: "ccst1" as const,
  targetTopic: "CCST Level 1",
  dailyMinutes: 15,
  timezone: "UTC",
};

describe("reducer", () => {
  it("seeds a valid state with 10 lessons and no profile", () => {
    const s = createInitialState("2026-10-19T00:00:00.000Z");
    expect(AppStateSchema.safeParse(s).success).toBe(true);
    expect(s.paths[0].lessonIds).toHaveLength(10);
    expect(s.profile).toBeNull();
  });

  it("onboarding then completing a lesson moves 'next lesson' forward", () => {
    let s = createInitialState("2026-10-19T00:00:00.000Z");
    s = run(s, [{ type: "saveProfile", profile }], ctx("2026-10-19"));
    expect(s.profile?.displayName).toBe("Sam");
    expect(nextLesson(s)?.id).toBe("sl01");
    s = run(s, [{ type: "completeLesson", lessonId: "sl01" }, { type: "completeLesson", lessonId: "sl01" }], ctx("2026-10-19"));
    expect(s.completions).toHaveLength(1);
    expect(nextLesson(s)?.id).toBe("sl02");
  });

  it("records attempts and schedules review items; the due queue can be completed", () => {
    let s = createInitialState("2026-10-19T00:00:00.000Z");
    s = run(
      s,
      [
        { type: "saveProfile", profile },
        { type: "answerQuestion", lessonId: "sl02", questionId: "sl02-q1", kind: "recall", context: "lesson", response: "50%", result: "correct" },
        { type: "answerQuestion", lessonId: "sl02", questionId: "sl02-q2", kind: "recall", context: "lesson", response: "?", result: "missed" },
      ],
      ctx("2026-10-19"),
    );
    expect(s.attempts).toHaveLength(2);
    const byQ = Object.fromEntries(s.reviewItems.map((r) => [r.questionId, r]));
    expect(byQ["sl02-q1"].dueDate).toBe("2026-10-22");
    expect(byQ["sl02-q2"].dueDate).toBe("2026-10-20");

    // Tomorrow only the missed item is due.
    expect(dueReviews(s, "2026-10-20").map((r) => r.questionId)).toEqual(["sl02-q2"]);
    s = reduce(
      s,
      { type: "answerQuestion", lessonId: "sl02", questionId: "sl02-q2", kind: "recall", context: "review", response: "live zero", result: "correct" },
      ctx("2026-10-20"),
    );
    expect(dueReviews(s, "2026-10-20")).toHaveLength(0);
    expect(s.reviewItems.find((r) => r.questionId === "sl02-q2")).toMatchObject({ step: 1, dueDate: "2026-10-23", status: "active" });
    expect(s.reviewEvents.at(-1)?.reason).toMatch(/3 days/);
    expect(streak(s, "2026-10-20")).toBe(2);
    expect(AppStateSchema.safeParse(s).success).toBe(true);
  });

  it("re-answering in a lesson restarts the schedule instead of climbing", () => {
    let s = createInitialState("2026-10-19T00:00:00.000Z");
    const a: Action = { type: "answerQuestion", lessonId: "sl03", questionId: "sl03-q1", kind: "recall", context: "lesson", response: "40", result: "correct" };
    s = reduce(s, a, ctx("2026-10-19"));
    s = reduce(s, a, ctx("2026-10-20"));
    expect(s.reviewItems).toHaveLength(1);
    expect(s.reviewItems[0]).toMatchObject({ step: 0, dueDate: "2026-10-23" });
  });

  it("source → draft → edit → approve publishes an attributed lesson", () => {
    let s = createInitialState("2026-10-19T00:00:00.000Z");
    const c = ctx("2026-10-19");
    s = reduce(
      s,
      {
        type: "addSource",
        id: "src_1",
        source: {
          title: "My loop notes",
          type: "own_notes",
          citation: "S. Tech, personal notes, 2026",
          notes: "",
          text: "Notes text",
          rightsConfirmed: true,
          confidentialityConfirmed: true,
        },
      },
      c,
    );
    const src = s.sources[0];
    s = reduce(s, { type: "createDraft", id: "drf_1", draft: templateDraft(src, c.nowIso, c.newId) }, c);
    expect(s.drafts[0]).toMatchObject({ reviewStatus: "draft", generatedBy: "template" });
    expect(s.drafts[0].attributions[0]).toMatchObject({ sourceId: "src_1", citation: "S. Tech, personal notes, 2026" });

    s = reduce(s, { type: "updateDraft", id: "drf_1", patch: { title: "Loop basics", objective: "Explain loops" } }, c);
    s = reduce(s, { type: "setDraftStatus", id: "drf_1", status: "in_review" }, c);
    // Approval can't be set directly; it has to go through publishDraft.
    expect(reduce(s, { type: "setDraftStatus", id: "drf_1", status: "approved" }, c)).toBe(s);
    s = reduce(s, { type: "publishDraft", id: "drf_1", reviewerName: "Lead Tech" }, c);

    const draft = s.drafts[0];
    expect(draft.reviewStatus).toBe("approved");
    const lesson = s.lessons[draft.publishedLessonId!];
    expect(lesson).toMatchObject({ title: "Loop basics", reviewStatus: "approved", pathId: CUSTOM_PATH_ID });
    expect(lesson.sources[0].sourceId).toBe("src_1");
    expect(s.paths.find((p) => p.id === CUSTOM_PATH_ID)?.lessonIds).toEqual([lesson.id]);

    // Editing an approved draft drops it back to draft.
    s = reduce(s, { type: "updateDraft", id: "drf_1", patch: { title: "Loop basics v2" } }, c);
    expect(s.drafts[0].reviewStatus).toBe("draft");
    expect(AppStateSchema.safeParse(s).success).toBe(true);
  });

  it("versions lesson scripts and keeps one audio asset per lesson", () => {
    let s = createInitialState("2026-10-19T00:00:00.000Z");
    const c = ctx("2026-10-19");
    const asset = { id: "aud_1", lessonId: "sl01", fileName: "a.mp3", mimeType: "audio/mpeg", sizeBytes: 10, scriptVersion: 1, provider: "manual_upload" as const };
    s = reduce(s, { type: "attachAudio", asset }, c);
    s = reduce(s, { type: "attachAudio", asset: { ...asset, id: "aud_2" } }, c);
    expect(s.audioAssets.map((a) => a.id)).toEqual(["aud_2"]);
    s = reduce(s, { type: "updateLessonScript", lessonId: "sl01", script: "New script [PAUSE 3 SECONDS]" }, c);
    expect(s.lessons.sl01.scriptVersion).toBe(2);
    expect(s.lessons.sl01.scriptHistory).toHaveLength(2);
    s = reduce(s, { type: "removeAudio", assetId: "aud_2" }, c);
    expect(s.audioAssets).toHaveLength(0);
  });
});
