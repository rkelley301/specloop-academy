import { templateDraft } from "../ai/draft-builders";
import { createInitialState, reduce, type Action, type ReduceContext } from "../reducer";
import type { AppState } from "../types";

export const UID = "11111111-1111-4111-8111-111111111111";
let n = 0;
export const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
export const ctx = (today = "2026-10-19"): ReduceContext => ({ nowIso: `${today}T12:00:00.000Z`, today, newId: () => uuid() });
export const run = (s: AppState, actions: Action[], c = ctx()) => actions.reduce((acc, a) => reduce(acc, a, c), s);

export const profile = {
  displayName: "Sam",
  experienceLevel: "apprentice" as const,
  goal: "CCST",
  target: "ccst1" as const,
  targetTopic: "CCST Level 1",
  dailyMinutes: 15,
  timezone: "UTC",
};

/** A state that touches every table: profile, answers, review, completion, source with PDF, AI-ish draft, published lesson, audio. */
export function richState(): AppState {
  const c = ctx();
  let s = createInitialState(c.nowIso);
  s = run(s, [
    { type: "saveProfile", profile },
    { type: "updateSettings", settings: { playbackRate: 1.25 } },
    { type: "answerQuestion", lessonId: "sl02", questionId: "sl02-q1", kind: "recall", context: "lesson", response: "50%", result: "missed" },
    { type: "answerQuestion", lessonId: "sl02", questionId: "sl02-s1", kind: "scenario", context: "lesson", response: "50 deg", result: "correct" },
    { type: "completeLesson", lessonId: "sl02" },
    {
      type: "addSource",
      id: uuid(),
      source: {
        title: "Notes",
        type: "own_notes",
        citation: "Me, 2026",
        url: "https://example.com/notes",
        notes: "",
        text: "text",
        file: { blobId: uuid(), name: "notes.pdf", mimeType: "application/pdf", sizeBytes: 1000 },
        rightsConfirmed: true,
        confidentialityConfirmed: true,
      },
    },
  ]);
  const src = s.sources[0];
  const draftId = uuid();
  s = reduce(s, { type: "createDraft", id: draftId, draft: { ...templateDraft(src, c.nowIso, uuid), generatedBy: "ai", aiModel: "claude-opus-5-5" } }, c);
  s = run(s, [
    { type: "updateDraft", id: draftId, patch: { title: "DP basics", objective: "obj", script: "script v1" } },
    { type: "publishDraft", id: draftId, reviewerName: "Lead" },
  ]);
  const lessonId = s.drafts[0].publishedLessonId!;
  s = run(s, [
    { type: "updateLessonScript", lessonId, script: "script v2" },
    { type: "answerQuestion", lessonId, questionId: s.lessons[lessonId].questions[0].id, kind: "recall", context: "lesson", response: "x", result: "correct" },
    { type: "attachAudio", asset: { id: uuid(), lessonId: "sl01", fileName: "a.mp3", mimeType: "audio/mpeg", sizeBytes: 10, scriptVersion: 1, provider: "manual_upload" } },
  ]);
  return s;
}

