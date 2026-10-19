# Data model

Source of truth: `src/lib/types.ts` (Zod schemas; the persisted state is
validated on every load). Hosted equivalent: `supabase/migrations/0001_init.sql`
(tables and RLS), `0002_storage.sql` (private buckets), `0003_seed_ccst_l1.sql`
(generated seed course), `0004_lesson_path_ownership.sql` (lessons only in
paths the writer owns). Mapping between the two: `src/lib/supabase/rows.ts`.

| Entity | Purpose | Key fields |
| --- | --- | --- |
| `Profile` | Learner setup | displayName, experienceLevel, goal, target (`ccst1`/`general`), targetTopic, dailyMinutes, timezone |
| `Settings` | Preferences | notifications (`off`/`in_app`), playbackRate |
| `LearningPath` | Ordered lesson list | id, title, lessonIds, origin (`seed`/`custom`) |
| `Lesson` | Playable lesson | objective, script + scriptVersion + scriptHistory, concepts, questions, scenario, sourceNote, sources (attribution), reviewStatus, origin |
| `Question` / `Scenario` | Recall item / applied scenario | prompt, answerKey, conceptId, `answerKeyMissing` (scenario only) |
| `Source` | Learner-added material | title, type, citation, url, notes, text, file (blob ref), rightsConfirmed, confidentialityConfirmed |
| `Draft` | Editable lesson draft | attributions, content fields, uncertainties, generatedBy (`manual`/`template`/`ai`), aiModel, generatedAt, reviewStatus, reviewerName, reviewedAt, publishedLessonId |
| `AudioAsset` | Narration attached to a lesson | fileName, mimeType, sizeBytes, scriptVersion, provider |
| `Attempt` | Every answer | questionId, kind, context (`lesson`/`review`), response, result |
| `Completion` | Lesson marked complete | lessonId, completedAt |
| `ReviewItem` | One per question | track (`missed`/`correct`), step, dueDate (local date), status |
| `ReviewEvent` | Audit trail for "why is this due" | result, occurredOn, nextDueDate, reason |

## Review schedule

`src/lib/scheduler.ts`. A fixed ladder, not FSRS or SM-2:

- Missed → due in 1 day, then 3, then 7.
- Correct → due in 3 days, then 7.
- A correct review climbs one rung. A miss restarts the missed ladder at 1 day.
  Clearing the last rung retires the item.
- Answering in a lesson (first time or again) starts the schedule fresh.
- Due dates are calendar dates in the learner's timezone.

## Hosted storage

- Each state change is diffed (`src/lib/supabase/sync.ts`) into upserts and
  deletes on the user's rows, in foreign-key order; attributions are replaced
  per lesson or draft. Seed content is never written by the app.
- The per-user custom path is stored as `my-lessons:{user_id}`.
- Files: buckets `audio` and `sources`, object path `{user_id}/{file_id}`.

## Local demo storage

- State JSON → `localStorage["specloop:v1"]`.
- Audio and PDF blobs → IndexedDB database `specloop-files`, behind the
  `BlobStorage` interface in `src/lib/blob-store.ts`.
- Lessons, drafts, attempts and review data are created by a pure reducer
  (`src/lib/reducer.ts`). That keeps them unit-testable and lets a hosted
  repository replay the same actions.

## Approval rule

A draft becomes a lesson only through `publishDraft`, which the UI enables only
after the draft is saved, has no `[EDIT]` placeholders or empty fields, has a
reviewer name, and has all three checklist items ticked. `setDraftStatus` refuses
to set `approved` directly. Editing an approved draft sends it back to `draft`.
