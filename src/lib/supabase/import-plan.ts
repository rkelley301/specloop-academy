import { CUSTOM_PATH_ID } from "../reducer";
import type { AppState, AudioAsset, Draft, Lesson, ReviewEvent, ReviewItem, Source } from "../types";

// Plans an explicit, non-destructive import of this browser's local demo data
// into a signed-in account:
//
// - Only adds rows. Nothing in the account is updated or deleted.
// - Learner-owned ids get fresh UUIDs (one shared map, so links between
//   drafts, lessons, questions and review items stay intact). Shared seed ids
//   (sl01, sl01-q1, …) are kept.
// - Conflicts are skipped and reported, never merged: a question that already
//   has a review schedule in the account, a lesson already completed, audio
//   for a lesson that already has audio.
// - Not imported: the local profile and settings (the account keeps its own),
//   and local edits to seed lesson scripts (seed content is shared in hosted mode).
// - The local data itself is left untouched.

export interface FileCopy {
  kind: "audio" | "source";
  localId: string;
  newId: string;
  contentType: string;
  label: string;
}

export interface ImportSummary {
  sources: number;
  drafts: number;
  lessons: number;
  attempts: number;
  completions: number;
  reviewItems: number;
  reviewEvents: number;
  audio: number;
  files: number;
  skipped: string[];
}

export interface ImportPlan {
  summary: ImportSummary;
  files: FileCopy[];
  additions: {
    sources: Source[];
    drafts: Draft[];
    lessons: Lesson[];
    attempts: AppState["attempts"];
    completions: AppState["completions"];
    reviewItems: ReviewItem[];
    reviewEvents: ReviewEvent[];
    audioAssets: AudioAsset[];
  };
}

export function hasImportableData(local: AppState): boolean {
  return (
    local.sources.length > 0 ||
    local.drafts.length > 0 ||
    local.attempts.length > 0 ||
    local.completions.length > 0 ||
    local.audioAssets.length > 0
  );
}

export function planImport(local: AppState, account: AppState, newId: () => string): ImportPlan {
  // Ids owned by the local learner (everything except shared seed content).
  const owned = new Set<string>();
  for (const l of Object.values(local.lessons)) {
    if (l.origin === "seed") continue;
    owned.add(l.id);
    l.concepts.forEach((c) => owned.add(c.id));
    l.questions.forEach((q) => owned.add(q.id));
    owned.add(l.scenario.id);
  }
  for (const d of local.drafts) {
    owned.add(d.id);
    d.concepts.forEach((c) => owned.add(c.id));
    d.questions.forEach((q) => owned.add(q.id));
    owned.add(d.scenario.id);
  }
  local.sources.forEach((s) => {
    owned.add(s.id);
    if (s.file) owned.add(s.file.blobId);
  });
  local.attempts.forEach((a) => owned.add(a.id));
  local.reviewItems.forEach((r) => owned.add(r.id));
  local.reviewEvents.forEach((e) => owned.add(e.id));
  local.audioAssets.forEach((a) => owned.add(a.id));

  const map = new Map<string, string>();
  const m = (id: string) => {
    if (!owned.has(id)) return id;
    let v = map.get(id);
    if (!v) {
      v = newId();
      map.set(id, v);
    }
    return v;
  };
  const mOpt = (id: string | undefined) => (id === undefined ? undefined : m(id));
  const skipped: string[] = [];
  const files: FileCopy[] = [];

  const remapQ = <T extends { id: string; conceptId: string }>(q: T): T => ({ ...q, id: m(q.id), conceptId: m(q.conceptId) });
  const remapAttr = (a: Draft["attributions"][number]) => ({ ...a, ...(a.sourceId ? { sourceId: m(a.sourceId) } : {}) });

  const sources = local.sources.map((s): Source => {
    const out: Source = { ...s, id: m(s.id) };
    if (s.file) {
      out.file = { ...s.file, blobId: m(s.file.blobId) };
      files.push({ kind: "source", localId: s.file.blobId, newId: out.file.blobId, contentType: s.file.mimeType || "application/pdf", label: s.file.name });
    }
    return out;
  });

  const drafts = local.drafts.map(
    (d): Draft => ({
      ...d,
      id: m(d.id),
      sourceIds: d.sourceIds.map(m),
      attributions: d.attributions.map(remapAttr),
      concepts: d.concepts.map((c) => ({ ...c, id: m(c.id) })),
      questions: d.questions.map(remapQ),
      scenario: remapQ(d.scenario),
      ...(d.publishedLessonId ? { publishedLessonId: m(d.publishedLessonId) } : {}),
    }),
  );

  const existingCustom = Object.values(account.lessons).filter((l) => l.origin !== "seed").length;
  const localCustom = Object.values(local.lessons)
    .filter((l) => l.origin !== "seed")
    .sort((a, b) => a.order - b.order);
  const lessons = localCustom.map(
    (l, i): Lesson => ({
      ...l,
      id: m(l.id),
      pathId: CUSTOM_PATH_ID,
      order: existingCustom + i + 1,
      concepts: l.concepts.map((c) => ({ ...c, id: m(c.id) })),
      questions: l.questions.map(remapQ),
      scenario: remapQ(l.scenario),
      sources: l.sources.map(remapAttr),
      ...(l.draftId ? { draftId: mOpt(l.draftId) } : {}),
    }),
  );
  const seedEdits = Object.values(local.lessons).filter((l) => l.origin === "seed" && l.scriptVersion > 1).length;
  if (seedEdits) skipped.push(`${seedEdits} edited seed lesson script${seedEdits === 1 ? "" : "s"} (seed content is shared in your account)`);

  const attempts = local.attempts.map((a) => ({ ...a, id: m(a.id), lessonId: m(a.lessonId), questionId: m(a.questionId) }));

  const done = new Set(account.completions.map((c) => c.lessonId));
  const completions = local.completions.filter((c) => !done.has(m(c.lessonId))).map((c) => ({ ...c, lessonId: m(c.lessonId) }));
  const dupCompletions = local.completions.length - completions.length;
  if (dupCompletions) skipped.push(`${dupCompletions} lesson completion${dupCompletions === 1 ? "" : "s"} already in your account`);

  const scheduled = new Set(account.reviewItems.map((r) => r.questionId));
  const keptItems = local.reviewItems.filter((r) => !scheduled.has(m(r.questionId)));
  const dupItems = local.reviewItems.length - keptItems.length;
  if (dupItems) skipped.push(`${dupItems} review schedule${dupItems === 1 ? "" : "s"} for questions your account already schedules (and their history)`);
  const keptItemIds = new Set(keptItems.map((r) => r.id));
  const reviewItems = keptItems.map((r) => ({ ...r, id: m(r.id), lessonId: m(r.lessonId), questionId: m(r.questionId), conceptId: m(r.conceptId) }));
  const reviewEvents = local.reviewEvents
    .filter((e) => keptItemIds.has(e.reviewItemId))
    .map((e) => ({ ...e, id: m(e.id), reviewItemId: m(e.reviewItemId), lessonId: m(e.lessonId), questionId: m(e.questionId) }));

  const withAudio = new Set(account.audioAssets.map((a) => a.lessonId));
  const audioAssets: AudioAsset[] = [];
  let dupAudio = 0;
  for (const a of local.audioAssets) {
    const lessonId = m(a.lessonId);
    if (withAudio.has(lessonId)) {
      dupAudio += 1;
      continue;
    }
    const asset = { ...a, id: m(a.id), lessonId };
    audioAssets.push(asset);
    files.push({ kind: "audio", localId: a.id, newId: asset.id, contentType: a.mimeType, label: a.fileName });
  }
  if (dupAudio) skipped.push(`${dupAudio} audio file${dupAudio === 1 ? "" : "s"} for lessons that already have audio in your account`);

  return {
    summary: {
      sources: sources.length,
      drafts: drafts.length,
      lessons: lessons.length,
      attempts: attempts.length,
      completions: completions.length,
      reviewItems: reviewItems.length,
      reviewEvents: reviewEvents.length,
      audio: audioAssets.length,
      files: files.length,
      skipped,
    },
    files,
    additions: { sources, drafts, lessons, attempts, completions, reviewItems, reviewEvents, audioAssets },
  };
}

/**
 * Builds the merged account state. Files that failed to copy are left out:
 * their audio asset is dropped, and a source keeps its text without the file.
 */
export function mergeImport(account: AppState, plan: ImportPlan, failedFileIds: Set<string> = new Set()): AppState {
  const a = plan.additions;
  const lessons = { ...account.lessons };
  for (const l of a.lessons) lessons[l.id] = l;
  let paths = account.paths;
  if (a.lessons.length) {
    const existing = paths.find((p) => p.id === CUSTOM_PATH_ID);
    const ids = [...(existing?.lessonIds ?? []), ...a.lessons.map((l) => l.id)];
    paths = existing
      ? paths.map((p) => (p.id === CUSTOM_PATH_ID ? { ...p, lessonIds: ids } : p))
      : [
          ...paths,
          {
            id: CUSTOM_PATH_ID,
            title: "My approved lessons",
            description: "Lessons you drafted from your own sources and approved after review.",
            lessonIds: ids,
            origin: "custom" as const,
          },
        ];
  }
  return {
    ...account,
    paths,
    lessons,
    sources: [
      ...account.sources,
      ...a.sources.map((s) => {
        if (!s.file || !failedFileIds.has(s.file.blobId)) return s;
        const { file, ...rest } = s;
        void file;
        return { ...rest, notes: [rest.notes, "(The attached file couldn't be copied during import.)"].filter(Boolean).join("\n") };
      }),
    ],
    drafts: [...account.drafts, ...a.drafts],
    attempts: [...account.attempts, ...a.attempts],
    completions: [...account.completions, ...a.completions],
    reviewItems: [...account.reviewItems, ...a.reviewItems],
    reviewEvents: [...account.reviewEvents, ...a.reviewEvents],
    audioAssets: [...account.audioAssets, ...a.audioAssets.filter((x) => !failedFileIds.has(x.id))],
  };
}
