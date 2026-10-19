import { buildSeedLessons, buildSeedPath, SEED_VERSION } from "./seed/ccst-level1";
import { scheduleAfterReview, scheduleInitial } from "./scheduler";
import {
  SCHEMA_VERSION,
  type AppState,
  type AudioAsset,
  type Attribution,
  type Draft,
  type Lesson,
  type Profile,
  type Result,
  type ReviewStatus,
  type Settings,
  type Source,
} from "./types";

export const CUSTOM_PATH_ID = "my-lessons";

export interface ReduceContext {
  nowIso: string;
  /** Learner-local calendar date (YYYY-MM-DD). */
  today: string;
  newId: (prefix: string) => string;
}

export type ProfileInput = Omit<Profile, "createdAt" | "updatedAt">;
export type SourceInput = Omit<Source, "id" | "createdAt" | "updatedAt">;
export type DraftInput = Omit<
  Draft,
  "id" | "updatedAt" | "reviewStatus" | "reviewNotes" | "reviewedAt" | "reviewerName" | "publishedLessonId"
>;
export type DraftEdit = Partial<
  Pick<Draft, "title" | "objective" | "estMinutes" | "script" | "questions" | "scenario" | "uncertainties" | "concepts">
>;

export type Action =
  | { type: "saveProfile"; profile: ProfileInput }
  | { type: "updateSettings"; settings: Partial<Settings> }
  | {
      type: "answerQuestion";
      lessonId: string;
      questionId: string;
      kind: "recall" | "scenario";
      context: "lesson" | "review";
      response: string;
      result: Result;
    }
  | { type: "completeLesson"; lessonId: string }
  | { type: "uncompleteLesson"; lessonId: string }
  | { type: "addSource"; source: SourceInput; id?: string }
  | { type: "updateSource"; id: string; patch: Partial<Pick<Source, "title" | "type" | "citation" | "url" | "notes" | "text">> }
  | { type: "deleteSource"; id: string }
  | { type: "createDraft"; draft: DraftInput; id?: string }
  | { type: "updateDraft"; id: string; patch: DraftEdit }
  | { type: "setDraftStatus"; id: string; status: ReviewStatus; notes?: string; reviewerName?: string }
  | { type: "publishDraft"; id: string; reviewerName: string }
  | { type: "deleteDraft"; id: string }
  | { type: "updateLessonScript"; lessonId: string; script: string }
  | { type: "attachAudio"; asset: Omit<AudioAsset, "createdAt"> }
  | { type: "removeAudio"; assetId: string }
  | { type: "replaceState"; state: AppState }
  | { type: "resetAll" };

export function createInitialState(nowIso: string): AppState {
  const lessons = buildSeedLessons();
  return {
    schemaVersion: SCHEMA_VERSION,
    seedVersion: SEED_VERSION,
    createdAt: nowIso,
    profile: null,
    settings: { notifications: "in_app", playbackRate: 1 },
    paths: [buildSeedPath()],
    lessons: Object.fromEntries(lessons.map((l) => [l.id, l])),
    sources: [],
    drafts: [],
    audioAssets: [],
    attempts: [],
    completions: [],
    reviewItems: [],
    reviewEvents: [],
  };
}

export function reduce(state: AppState, action: Action, ctx: ReduceContext): AppState {
  switch (action.type) {
    case "saveProfile": {
      const prev = state.profile;
      const profile: Profile = {
        ...action.profile,
        createdAt: prev?.createdAt ?? ctx.nowIso,
        updatedAt: ctx.nowIso,
      };
      return { ...state, profile };
    }

    case "updateSettings":
      return { ...state, settings: { ...state.settings, ...action.settings } };

    case "answerQuestion": {
      const attempt = {
        id: ctx.newId("att"),
        lessonId: action.lessonId,
        questionId: action.questionId,
        kind: action.kind,
        context: action.context,
        response: action.response,
        result: action.result,
        createdAt: ctx.nowIso,
      };
      const lesson = state.lessons[action.lessonId];
      const conceptId =
        lesson?.questions.find((q) => q.id === action.questionId)?.conceptId ??
        (lesson?.scenario.id === action.questionId ? lesson.scenario.conceptId : action.questionId);

      const existing = state.reviewItems.find((r) => r.questionId === action.questionId);
      // From a review session, an item advances along its ladder. From a
      // lesson (first answer, or a re-answer), the schedule starts fresh.
      const outcome =
        action.context === "review" && existing && existing.status === "active"
          ? scheduleAfterReview(existing, action.result, ctx.today)
          : scheduleInitial(action.result, ctx.today);

      const itemId = existing?.id ?? ctx.newId("rev");
      const item = {
        id: itemId,
        lessonId: action.lessonId,
        questionId: action.questionId,
        conceptId,
        track: outcome.track,
        step: outcome.step,
        dueDate: outcome.dueDate ?? existing?.dueDate ?? ctx.today,
        status: outcome.dueDate ? ("active" as const) : ("retired" as const),
        lastResult: action.result,
        createdAt: existing?.createdAt ?? ctx.nowIso,
        updatedAt: ctx.nowIso,
      };
      const event = {
        id: ctx.newId("evt"),
        reviewItemId: itemId,
        lessonId: action.lessonId,
        questionId: action.questionId,
        context: action.context,
        result: action.result,
        occurredOn: ctx.today,
        occurredAt: ctx.nowIso,
        nextDueDate: outcome.dueDate,
        reason: outcome.reason,
      };
      return {
        ...state,
        attempts: [...state.attempts, attempt],
        reviewItems: existing
          ? state.reviewItems.map((r) => (r.id === itemId ? item : r))
          : [...state.reviewItems, item],
        reviewEvents: [...state.reviewEvents, event],
      };
    }

    case "completeLesson": {
      if (state.completions.some((c) => c.lessonId === action.lessonId)) return state;
      return {
        ...state,
        completions: [...state.completions, { lessonId: action.lessonId, completedAt: ctx.nowIso }],
      };
    }

    case "uncompleteLesson":
      return { ...state, completions: state.completions.filter((c) => c.lessonId !== action.lessonId) };

    case "addSource": {
      const source: Source = {
        ...action.source,
        id: action.id ?? ctx.newId("src"),
        createdAt: ctx.nowIso,
        updatedAt: ctx.nowIso,
      };
      return { ...state, sources: [...state.sources, source] };
    }

    case "updateSource":
      return {
        ...state,
        sources: state.sources.map((s) => (s.id === action.id ? { ...s, ...action.patch, updatedAt: ctx.nowIso } : s)),
      };

    case "deleteSource":
      return { ...state, sources: state.sources.filter((s) => s.id !== action.id) };

    case "createDraft": {
      const draft: Draft = {
        ...action.draft,
        id: action.id ?? ctx.newId("drf"),
        updatedAt: ctx.nowIso,
        reviewStatus: "draft",
        reviewNotes: "",
      };
      return { ...state, drafts: [...state.drafts, draft] };
    }

    case "updateDraft":
      return {
        ...state,
        drafts: state.drafts.map((d) => {
          if (d.id !== action.id) return d;
          // Editing an approved draft sends it back for review.
          const reviewStatus = d.reviewStatus === "approved" ? "draft" : d.reviewStatus;
          return { ...d, ...action.patch, reviewStatus, updatedAt: ctx.nowIso };
        }),
      };

    case "setDraftStatus":
      if (action.status === "approved") return state; // approval goes through publishDraft
      return {
        ...state,
        drafts: state.drafts.map((d) =>
          d.id === action.id
            ? {
                ...d,
                reviewStatus: action.status,
                reviewNotes: action.notes ?? d.reviewNotes,
                reviewerName: action.reviewerName ?? d.reviewerName,
                reviewedAt: action.status === "draft" ? d.reviewedAt : ctx.nowIso,
                updatedAt: ctx.nowIso,
              }
            : d,
        ),
      };

    case "publishDraft": {
      const draft = state.drafts.find((d) => d.id === action.id);
      if (!draft) return state;
      return publishDraft(state, draft, action.reviewerName, ctx);
    }

    case "deleteDraft":
      return { ...state, drafts: state.drafts.filter((d) => d.id !== action.id) };

    case "updateLessonScript": {
      const lesson = state.lessons[action.lessonId];
      if (!lesson || lesson.script === action.script) return state;
      const version = lesson.scriptVersion + 1;
      const updated: Lesson = {
        ...lesson,
        script: action.script,
        scriptVersion: version,
        scriptHistory: [...lesson.scriptHistory, { version, script: action.script, savedAt: ctx.nowIso }],
        updatedAt: ctx.nowIso,
      };
      return { ...state, lessons: { ...state.lessons, [lesson.id]: updated } };
    }

    case "attachAudio":
      return {
        ...state,
        // One active audio asset per lesson; attaching replaces the old one.
        audioAssets: [
          ...state.audioAssets.filter((a) => a.lessonId !== action.asset.lessonId),
          { ...action.asset, createdAt: ctx.nowIso },
        ],
      };

    case "removeAudio":
      return { ...state, audioAssets: state.audioAssets.filter((a) => a.id !== action.assetId) };

    case "replaceState":
      return action.state;

    case "resetAll":
      return createInitialState(ctx.nowIso);
  }
}

function publishDraft(state: AppState, draft: Draft, reviewerName: string, ctx: ReduceContext): AppState {
  const lessonId = draft.publishedLessonId ?? ctx.newId("les");
  const existing = state.lessons[lessonId];
  let path = state.paths.find((p) => p.id === CUSTOM_PATH_ID);
  if (!path) {
    path = {
      id: CUSTOM_PATH_ID,
      title: "My approved lessons",
      description: "Lessons you drafted from your own sources and approved after review.",
      lessonIds: [],
      origin: "custom",
    };
  }
  const scriptChanged = existing ? existing.script !== draft.script : false;
  const scriptVersion = existing ? existing.scriptVersion + (scriptChanged ? 1 : 0) : 1;
  const sources: Attribution[] = draft.attributions;
  const lesson: Lesson = {
    id: lessonId,
    pathId: CUSTOM_PATH_ID,
    order: existing?.order ?? path.lessonIds.length + 1,
    title: draft.title,
    objective: draft.objective,
    estMinutes: draft.estMinutes,
    script: draft.script,
    scriptVersion,
    scriptHistory: existing
      ? scriptChanged
        ? [...existing.scriptHistory, { version: scriptVersion, script: draft.script, savedAt: ctx.nowIso }]
        : existing.scriptHistory
      : [{ version: 1, script: draft.script, savedAt: ctx.nowIso }],
    concepts: draft.concepts,
    questions: draft.questions,
    scenario: draft.scenario,
    sourceNote: draft.uncertainties.length
      ? `Approved by ${reviewerName}. Open uncertainties: ${draft.uncertainties.join("; ")}`
      : `Approved by ${reviewerName} after technical review against the cited sources.`,
    sources,
    reviewStatus: "approved",
    origin: "draft",
    draftId: draft.id,
    createdAt: existing?.createdAt ?? ctx.nowIso,
    updatedAt: ctx.nowIso,
  };
  const newPath = path.lessonIds.includes(lessonId) ? path : { ...path, lessonIds: [...path.lessonIds, lessonId] };
  return {
    ...state,
    lessons: { ...state.lessons, [lessonId]: lesson },
    paths: state.paths.some((p) => p.id === CUSTOM_PATH_ID)
      ? state.paths.map((p) => (p.id === CUSTOM_PATH_ID ? newPath : p))
      : [...state.paths, newPath],
    drafts: state.drafts.map((d) =>
      d.id === draft.id
        ? {
            ...d,
            reviewStatus: "approved",
            reviewerName,
            reviewedAt: ctx.nowIso,
            publishedLessonId: lessonId,
            updatedAt: ctx.nowIso,
          }
        : d,
    ),
  };
}
