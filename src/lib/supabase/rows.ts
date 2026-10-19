import { CUSTOM_PATH_ID } from "../reducer";
import { SEED_VERSION, buildSeedLessons, buildSeedPath } from "../seed/ccst-level1";
import {
  SCHEMA_VERSION,
  type AppState,
  type Attribution,
  type Draft,
  type Lesson,
  type ReviewItem,
} from "../types";

// Pure mapping between the app's AppState and the hosted tables in
// supabase/migrations/0001_init.sql. Seed content is never written by the app
// (it's installed by migration 0003); only learner-owned rows are mapped.

export type Row = Record<string, unknown>;

/** Tables whose rows are upserted/deleted individually, in dependency order. */
export const KEYED_TABLES = [
  "profiles",
  "learning_paths",
  "lessons",
  "lesson_script_versions",
  "concepts",
  "questions",
  "sources",
  "lesson_drafts",
  "audio_assets",
  "attempts",
  "lesson_completions",
  "review_items",
  "review_events",
] as const;
export type KeyedTable = (typeof KEYED_TABLES)[number];

/** Primary-key columns per table (used for upsert conflict targets and deletes). */
export const TABLE_KEYS: Record<KeyedTable, string[]> = {
  profiles: ["user_id"],
  learning_paths: ["id"],
  lessons: ["id"],
  lesson_script_versions: ["lesson_id", "version"],
  concepts: ["id"],
  questions: ["id"],
  sources: ["id"],
  lesson_drafts: ["id"],
  audio_assets: ["id"],
  attempts: ["id"],
  lesson_completions: ["user_id", "lesson_id"],
  review_items: ["id"],
  review_events: ["id"],
};

/** lesson_attributions has no natural key, so it's replaced per owner (lesson or draft). */
export interface AttributionGroups {
  byLesson: Record<string, Row[]>;
  byDraft: Record<string, Row[]>;
}

export interface Rows {
  tables: Record<KeyedTable, Row[]>;
  attributions: AttributionGroups;
}

export function dbPathId(stateId: string, uid: string) {
  return stateId === CUSTOM_PATH_ID ? `${CUSTOM_PATH_ID}:${uid}` : stateId;
}
export function statePathId(dbId: string) {
  return dbId.startsWith(`${CUSTOM_PATH_ID}:`) ? CUSTOM_PATH_ID : dbId;
}
export function storagePath(uid: string, fileId: string) {
  return `${uid}/${fileId}`;
}

const n = <T,>(v: T | undefined): T | null => (v === undefined ? null : v);

export function rowKey(table: KeyedTable, row: Row): string {
  return TABLE_KEYS[table].map((k) => String(row[k])).join("|");
}

function attributionRows(list: Attribution[], owner: { lesson_id: string | null; draft_id: string | null }, sourceIds: Set<string>): Row[] {
  return list.map((a) => ({
    ...owner,
    source_id: a.sourceId && sourceIds.has(a.sourceId) ? a.sourceId : null,
    title: a.title,
    citation: a.citation,
    url: n(a.url),
  }));
}

export function stateToRows(state: AppState, uid: string): Rows {
  const t: Record<KeyedTable, Row[]> = Object.fromEntries(KEYED_TABLES.map((k) => [k, []])) as unknown as Record<KeyedTable, Row[]>;
  const byLesson: Record<string, Row[]> = {};
  const byDraft: Record<string, Row[]> = {};
  const sourceIds = new Set(state.sources.map((s) => s.id));

  if (state.profile) {
    const p = state.profile;
    t.profiles.push({
      user_id: uid,
      display_name: p.displayName,
      experience_level: p.experienceLevel,
      goal: p.goal,
      target: p.target,
      target_topic: p.targetTopic,
      daily_minutes: p.dailyMinutes,
      timezone: p.timezone,
      notifications: state.settings.notifications,
      playback_rate: state.settings.playbackRate,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    });
  }

  for (const path of state.paths) {
    if (path.origin !== "custom") continue;
    t.learning_paths.push({ id: dbPathId(path.id, uid), owner_id: uid, title: path.title, description: path.description, origin: "custom" });
  }

  for (const l of Object.values(state.lessons)) {
    if (l.origin === "seed") continue;
    t.lessons.push({
      id: l.id,
      owner_id: uid,
      path_id: dbPathId(l.pathId, uid),
      position: l.order,
      title: l.title,
      objective: l.objective,
      est_minutes: l.estMinutes,
      script: l.script,
      script_version: l.scriptVersion,
      source_note: l.sourceNote,
      review_status: l.reviewStatus,
      origin: "draft",
      draft_id: n(l.draftId),
      created_at: l.createdAt,
      updated_at: l.updatedAt,
    });
    for (const v of l.scriptHistory) {
      t.lesson_script_versions.push({ lesson_id: l.id, version: v.version, script: v.script, saved_by: uid, saved_at: v.savedAt });
    }
    for (const c of l.concepts) t.concepts.push({ id: c.id, lesson_id: l.id, label: c.label });
    l.questions.forEach((q, i) =>
      t.questions.push({ id: q.id, lesson_id: l.id, concept_id: q.conceptId, kind: "recall", position: i + 1, prompt: q.prompt, answer_key: q.answerKey, answer_key_missing: false }),
    );
    t.questions.push({
      id: l.scenario.id,
      lesson_id: l.id,
      concept_id: l.scenario.conceptId,
      kind: "scenario",
      position: l.questions.length + 1,
      prompt: l.scenario.prompt,
      answer_key: l.scenario.answerKey,
      answer_key_missing: Boolean(l.scenario.answerKeyMissing),
    });
    byLesson[l.id] = attributionRows(l.sources, { lesson_id: l.id, draft_id: null }, sourceIds);
  }

  for (const s of state.sources) {
    t.sources.push({
      id: s.id,
      user_id: uid,
      title: s.title,
      type: s.type,
      citation: s.citation,
      url: n(s.url),
      notes: s.notes,
      body_text: s.text,
      file_path: s.file ? storagePath(uid, s.file.blobId) : null,
      file_name: s.file?.name ?? null,
      file_mime: s.file?.mimeType ?? null,
      file_size: s.file?.sizeBytes ?? null,
      rights_confirmed: true,
      confidentiality_confirmed: true,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
    });
  }

  for (const d of state.drafts) {
    t.lesson_drafts.push({
      id: d.id,
      user_id: uid,
      title: d.title,
      objective: d.objective,
      est_minutes: d.estMinutes,
      script: d.script,
      content: { concepts: d.concepts, questions: d.questions, scenario: d.scenario },
      uncertainties: d.uncertainties,
      generated_by: d.generatedBy,
      ai_model: n(d.aiModel),
      generated_at: d.generatedAt,
      review_status: d.reviewStatus,
      review_notes: d.reviewNotes,
      reviewer_name: n(d.reviewerName),
      reviewed_at: n(d.reviewedAt),
      published_lesson_id: n(d.publishedLessonId),
      updated_at: d.updatedAt,
    });
    byDraft[d.id] = attributionRows(d.attributions, { lesson_id: null, draft_id: d.id }, sourceIds);
  }

  for (const a of state.audioAssets) {
    t.audio_assets.push({
      id: a.id,
      user_id: uid,
      lesson_id: a.lessonId,
      storage_path: storagePath(uid, a.id),
      file_name: a.fileName,
      mime_type: a.mimeType,
      size_bytes: a.sizeBytes,
      script_version: a.scriptVersion,
      provider: a.provider,
      created_at: a.createdAt,
    });
  }

  for (const a of state.attempts) {
    t.attempts.push({
      id: a.id,
      user_id: uid,
      lesson_id: a.lessonId,
      question_id: a.questionId,
      kind: a.kind,
      context: a.context,
      response: a.response,
      result: a.result,
      created_at: a.createdAt,
    });
  }
  for (const c of state.completions) t.lesson_completions.push({ user_id: uid, lesson_id: c.lessonId, completed_at: c.completedAt });
  for (const r of state.reviewItems) {
    t.review_items.push({
      id: r.id,
      user_id: uid,
      lesson_id: r.lessonId,
      question_id: r.questionId,
      concept_id: r.conceptId,
      track: r.track,
      step: r.step,
      due_date: r.dueDate,
      status: r.status,
      last_result: r.lastResult,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    });
  }
  for (const e of state.reviewEvents) {
    t.review_events.push({
      id: e.id,
      user_id: uid,
      review_item_id: e.reviewItemId,
      lesson_id: e.lessonId,
      question_id: e.questionId,
      context: e.context,
      result: e.result,
      occurred_on: e.occurredOn,
      occurred_at: e.occurredAt,
      next_due_date: e.nextDueDate,
      reason: e.reason,
    });
  }
  return { tables: t, attributions: { byLesson, byDraft } };
}

// ---------------------------------------------------------------------------
// Rows → state (used when loading an account)

export interface LoadedRows {
  profiles: Row[];
  learning_paths: Row[];
  lessons: Row[];
  lesson_script_versions: Row[];
  concepts: Row[];
  questions: Row[];
  lesson_attributions: Row[];
  sources: Row[];
  lesson_drafts: Row[];
  audio_assets: Row[];
  attempts: Row[];
  lesson_completions: Row[];
  review_items: Row[];
  review_events: Row[];
}

const s = (v: unknown) => String(v);
const opt = (v: unknown) => (v === null || v === undefined ? undefined : String(v));
const num = (v: unknown) => Number(v);
const lastSegment = (p: string) => p.split("/").pop() ?? p;

function toAttribution(r: Row): Attribution {
  const a: Attribution = { title: s(r.title), citation: s(r.citation) };
  if (r.source_id) a.sourceId = s(r.source_id);
  if (r.url) a.url = s(r.url);
  return a;
}

export function rowsToState(rows: LoadedRows, nowIso: string): AppState {
  const p = rows.profiles[0];
  const seedLessons = buildSeedLessons();
  const lessons: Record<string, Lesson> = Object.fromEntries(seedLessons.map((l) => [l.id, l]));

  const byLessonId = <T extends Row>(list: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of list) {
      const k = s(r.lesson_id);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return m;
  };
  const versions = byLessonId(rows.lesson_script_versions);
  const concepts = byLessonId(rows.concepts);
  const questions = byLessonId(rows.questions);
  const lessonAttr = byLessonId(rows.lesson_attributions.filter((r) => r.lesson_id));

  const custom = rows.lessons.slice().sort((a, b) => num(a.position) - num(b.position));
  for (const r of custom) {
    const id = s(r.id);
    const qs = (questions.get(id) ?? []).slice().sort((a, b) => num(a.position) - num(b.position));
    const scen = qs.find((q) => q.kind === "scenario");
    if (!scen) throw new Error(`Lesson ${id} has no scenario row.`);
    const lesson: Lesson = {
      id,
      pathId: statePathId(s(r.path_id)),
      order: num(r.position),
      title: s(r.title),
      objective: s(r.objective),
      estMinutes: num(r.est_minutes),
      script: s(r.script),
      scriptVersion: num(r.script_version),
      scriptHistory: (versions.get(id) ?? [])
        .slice()
        .sort((a, b) => num(a.version) - num(b.version))
        .map((v) => ({ version: num(v.version), script: s(v.script), savedAt: s(v.saved_at) })),
      concepts: (concepts.get(id) ?? []).map((c) => ({ id: s(c.id), label: s(c.label) })),
      questions: qs
        .filter((q) => q.kind === "recall")
        .map((q) => ({ id: s(q.id), prompt: s(q.prompt), answerKey: s(q.answer_key), conceptId: s(q.concept_id) })),
      scenario: {
        id: s(scen.id),
        prompt: s(scen.prompt),
        answerKey: s(scen.answer_key),
        conceptId: s(scen.concept_id),
        ...(scen.answer_key_missing ? { answerKeyMissing: true } : {}),
      },
      sourceNote: s(r.source_note),
      sources: (lessonAttr.get(id) ?? []).map(toAttribution),
      reviewStatus: r.review_status as Lesson["reviewStatus"],
      origin: "draft",
      createdAt: s(r.created_at),
      updatedAt: s(r.updated_at),
    };
    if (r.draft_id) lesson.draftId = s(r.draft_id);
    lessons[id] = lesson;
  }

  const paths = [buildSeedPath()];
  for (const r of rows.learning_paths) {
    const id = statePathId(s(r.id));
    paths.push({
      id,
      title: s(r.title),
      description: s(r.description),
      lessonIds: custom.filter((l) => statePathId(s(l.path_id)) === id).map((l) => s(l.id)),
      origin: "custom",
    });
  }

  const draftAttr = new Map<string, Row[]>();
  for (const r of rows.lesson_attributions) {
    if (!r.draft_id) continue;
    const k = s(r.draft_id);
    draftAttr.set(k, [...(draftAttr.get(k) ?? []), r]);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    seedVersion: SEED_VERSION,
    createdAt: p ? s(p.created_at) : nowIso,
    profile: p
      ? {
          displayName: s(p.display_name),
          experienceLevel: p.experience_level as NonNullable<AppState["profile"]>["experienceLevel"],
          goal: s(p.goal),
          target: p.target as "ccst1" | "general",
          targetTopic: s(p.target_topic),
          dailyMinutes: num(p.daily_minutes),
          timezone: s(p.timezone),
          createdAt: s(p.created_at),
          updatedAt: s(p.updated_at),
        }
      : null,
    settings: p
      ? { notifications: p.notifications as "off" | "in_app", playbackRate: num(p.playback_rate) }
      : { notifications: "in_app", playbackRate: 1 },
    paths,
    lessons,
    sources: rows.sources.map((r) => {
      const src: AppState["sources"][number] = {
        id: s(r.id),
        title: s(r.title),
        type: r.type as AppState["sources"][number]["type"],
        citation: s(r.citation),
        notes: s(r.notes),
        text: s(r.body_text),
        rightsConfirmed: true,
        confidentialityConfirmed: true,
        createdAt: s(r.created_at),
        updatedAt: s(r.updated_at),
      };
      if (r.url) src.url = s(r.url);
      if (r.file_path) {
        src.file = { blobId: lastSegment(s(r.file_path)), name: s(r.file_name), mimeType: s(r.file_mime), sizeBytes: num(r.file_size) };
      }
      return src;
    }),
    drafts: rows.lesson_drafts.map((r) => {
      const content = r.content as Pick<Draft, "concepts" | "questions" | "scenario">;
      const d: Draft = {
        id: s(r.id),
        sourceIds: [],
        attributions: (draftAttr.get(s(r.id)) ?? []).map(toAttribution),
        title: s(r.title),
        objective: s(r.objective),
        estMinutes: num(r.est_minutes),
        script: s(r.script),
        concepts: content.concepts,
        questions: content.questions,
        scenario: content.scenario,
        uncertainties: (r.uncertainties as string[]) ?? [],
        generatedBy: r.generated_by as Draft["generatedBy"],
        generatedAt: s(r.generated_at),
        updatedAt: s(r.updated_at),
        reviewStatus: r.review_status as Draft["reviewStatus"],
        reviewNotes: s(r.review_notes),
      };
      d.sourceIds = [...new Set(d.attributions.map((a) => a.sourceId).filter((x): x is string => Boolean(x)))];
      const aiModel = opt(r.ai_model);
      if (aiModel) d.aiModel = aiModel;
      const reviewer = opt(r.reviewer_name);
      if (reviewer) d.reviewerName = reviewer;
      const reviewedAt = opt(r.reviewed_at);
      if (reviewedAt) d.reviewedAt = reviewedAt;
      const pub = opt(r.published_lesson_id);
      if (pub) d.publishedLessonId = pub;
      return d;
    }),
    audioAssets: rows.audio_assets.map((r) => ({
      id: s(r.id),
      lessonId: s(r.lesson_id),
      fileName: s(r.file_name),
      mimeType: s(r.mime_type),
      sizeBytes: num(r.size_bytes),
      scriptVersion: num(r.script_version),
      provider: r.provider as "manual_upload" | "onestudio",
      createdAt: s(r.created_at),
    })),
    attempts: rows.attempts
      .map((r) => ({
        id: s(r.id),
        lessonId: s(r.lesson_id),
        questionId: s(r.question_id),
        kind: r.kind as "recall" | "scenario",
        context: r.context as "lesson" | "review",
        response: s(r.response),
        result: r.result as "correct" | "missed",
        createdAt: s(r.created_at),
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    completions: rows.lesson_completions.map((r) => ({ lessonId: s(r.lesson_id), completedAt: s(r.completed_at) })),
    reviewItems: rows.review_items.map(
      (r): ReviewItem => ({
        id: s(r.id),
        lessonId: s(r.lesson_id),
        questionId: s(r.question_id),
        conceptId: s(r.concept_id),
        track: r.track as ReviewItem["track"],
        step: num(r.step),
        dueDate: s(r.due_date),
        status: r.status as ReviewItem["status"],
        lastResult: r.last_result as ReviewItem["lastResult"],
        createdAt: s(r.created_at),
        updatedAt: s(r.updated_at),
      }),
    ),
    reviewEvents: rows.review_events
      .map((r) => ({
        id: s(r.id),
        reviewItemId: s(r.review_item_id),
        lessonId: s(r.lesson_id),
        questionId: s(r.question_id),
        context: r.context as "lesson" | "review",
        result: r.result as "correct" | "missed",
        occurredOn: s(r.occurred_on),
        occurredAt: s(r.occurred_at),
        nextDueDate: r.next_due_date === null ? null : s(r.next_due_date),
        reason: s(r.reason),
      }))
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
  };
}
