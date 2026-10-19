import { z } from "zod";

// All persisted data is validated against these schemas on load, so a corrupt
// or hand-edited localStorage payload produces a clear error state instead of
// a half-working app. Dates are ISO strings; due dates are local calendar
// dates (YYYY-MM-DD) in the learner's timezone.

export const isoDateTime = z.string().min(10);
export const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const ExperienceLevel = z.enum(["new", "apprentice", "technician", "senior"]);
export type ExperienceLevel = z.infer<typeof ExperienceLevel>;

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  new: "New to I&C",
  apprentice: "Apprentice / trainee",
  technician: "Working technician",
  senior: "Senior tech / lead",
};

export const ProfileSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a display name").max(60),
  experienceLevel: ExperienceLevel,
  goal: z.string().trim().min(1, "Describe your learning goal").max(400),
  target: z.enum(["ccst1", "general"]),
  targetTopic: z.string().trim().max(120),
  dailyMinutes: z.number().int().min(5).max(120),
  timezone: z.string().min(1),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type Profile = z.infer<typeof ProfileSchema>;

export const SettingsSchema = z.object({
  notifications: z.enum(["off", "in_app"]),
  playbackRate: z.number().min(0.5).max(2),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const ReviewStatus = z.enum(["draft", "in_review", "changes_requested", "approved"]);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
};

export const ConceptSchema = z.object({ id: z.string(), label: z.string() });
export type Concept = z.infer<typeof ConceptSchema>;

export const QuestionSchema = z.object({
  id: z.string(),
  prompt: z.string().min(1),
  answerKey: z.string().min(1),
  conceptId: z.string(),
});
export type Question = z.infer<typeof QuestionSchema>;

export const ScenarioSchema = z.object({
  id: z.string(),
  prompt: z.string().min(1),
  answerKey: z.string().min(1),
  conceptId: z.string(),
  /** True when the source content has no answer key; answerKey then holds a notice. */
  answerKeyMissing: z.boolean().optional(),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const AttributionSchema = z.object({
  sourceId: z.string().optional(),
  title: z.string(),
  citation: z.string(),
  url: z.string().optional(),
});
export type Attribution = z.infer<typeof AttributionSchema>;

export const ScriptVersionSchema = z.object({
  version: z.number().int().min(1),
  script: z.string(),
  savedAt: isoDateTime,
});
export type ScriptVersion = z.infer<typeof ScriptVersionSchema>;

export const LessonSchema = z.object({
  id: z.string(),
  pathId: z.string(),
  order: z.number().int(),
  title: z.string(),
  objective: z.string(),
  estMinutes: z.number().int().min(1),
  script: z.string(),
  scriptVersion: z.number().int().min(1),
  scriptHistory: z.array(ScriptVersionSchema),
  concepts: z.array(ConceptSchema),
  questions: z.array(QuestionSchema),
  scenario: ScenarioSchema,
  sourceNote: z.string(),
  sources: z.array(AttributionSchema),
  reviewStatus: ReviewStatus,
  origin: z.enum(["seed", "draft"]),
  draftId: z.string().optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type Lesson = z.infer<typeof LessonSchema>;

export const LearningPathSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  lessonIds: z.array(z.string()),
  origin: z.enum(["seed", "custom"]),
});
export type LearningPath = z.infer<typeof LearningPathSchema>;

export const SourceType = z.enum([
  "own_notes",
  "textbook",
  "manufacturer_manual",
  "standard_public",
  "site_training",
  "website",
  "other",
]);
export type SourceType = z.infer<typeof SourceType>;

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  own_notes: "My own notes",
  textbook: "Textbook / book",
  manufacturer_manual: "Manufacturer manual / datasheet",
  standard_public: "Public standard or summary",
  site_training: "Site training material (authorized)",
  website: "Website / article",
  other: "Other",
};

export const SourceFileSchema = z.object({
  blobId: z.string(),
  name: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().min(0),
});

export const SourceSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  type: SourceType,
  citation: z.string().min(1),
  url: z.string().optional(),
  notes: z.string(),
  text: z.string(),
  file: SourceFileSchema.optional(),
  rightsConfirmed: z.literal(true),
  confidentialityConfirmed: z.literal(true),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type Source = z.infer<typeof SourceSchema>;

export const DraftSchema = z.object({
  id: z.string(),
  sourceIds: z.array(z.string()),
  attributions: z.array(AttributionSchema),
  title: z.string(),
  objective: z.string(),
  estMinutes: z.number().int().min(1),
  script: z.string(),
  concepts: z.array(ConceptSchema),
  questions: z.array(QuestionSchema),
  scenario: ScenarioSchema,
  uncertainties: z.array(z.string()),
  generatedBy: z.enum(["manual", "template", "ai"]),
  aiModel: z.string().optional(),
  generatedAt: isoDateTime,
  updatedAt: isoDateTime,
  reviewStatus: ReviewStatus,
  reviewNotes: z.string(),
  reviewerName: z.string().optional(),
  reviewedAt: isoDateTime.optional(),
  publishedLessonId: z.string().optional(),
});
export type Draft = z.infer<typeof DraftSchema>;

export const AudioAssetSchema = z.object({
  id: z.string(),
  lessonId: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().min(0),
  scriptVersion: z.number().int().min(1),
  provider: z.enum(["manual_upload", "onestudio"]),
  createdAt: isoDateTime,
});
export type AudioAsset = z.infer<typeof AudioAssetSchema>;

export const Result = z.enum(["correct", "missed"]);
export type Result = z.infer<typeof Result>;

export const AttemptSchema = z.object({
  id: z.string(),
  lessonId: z.string(),
  questionId: z.string(),
  kind: z.enum(["recall", "scenario"]),
  context: z.enum(["lesson", "review"]),
  response: z.string(),
  result: Result,
  createdAt: isoDateTime,
});
export type Attempt = z.infer<typeof AttemptSchema>;

export const CompletionSchema = z.object({
  lessonId: z.string(),
  completedAt: isoDateTime,
});
export type Completion = z.infer<typeof CompletionSchema>;

export const ReviewItemSchema = z.object({
  id: z.string(),
  lessonId: z.string(),
  questionId: z.string(),
  conceptId: z.string(),
  // "missed" ladder: 1 → 3 → 7 days. "correct" ladder: 3 → 7 days.
  track: Result,
  // Index into the track's interval list for the review that is now due.
  step: z.number().int().min(0),
  dueDate: localDate,
  status: z.enum(["active", "retired"]),
  lastResult: Result,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type ReviewItem = z.infer<typeof ReviewItemSchema>;

export const ReviewEventSchema = z.object({
  id: z.string(),
  reviewItemId: z.string(),
  lessonId: z.string(),
  questionId: z.string(),
  context: z.enum(["lesson", "review"]),
  result: Result,
  occurredOn: localDate,
  occurredAt: isoDateTime,
  nextDueDate: localDate.nullable(),
  reason: z.string(),
});
export type ReviewEvent = z.infer<typeof ReviewEventSchema>;

export const SCHEMA_VERSION = 1;

export const AppStateSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  seedVersion: z.string(),
  createdAt: isoDateTime,
  profile: ProfileSchema.nullable(),
  settings: SettingsSchema,
  paths: z.array(LearningPathSchema),
  lessons: z.record(z.string(), LessonSchema),
  sources: z.array(SourceSchema),
  drafts: z.array(DraftSchema),
  audioAssets: z.array(AudioAssetSchema),
  attempts: z.array(AttemptSchema),
  completions: z.array(CompletionSchema),
  reviewItems: z.array(ReviewItemSchema),
  reviewEvents: z.array(ReviewEventSchema),
});
export type AppState = z.infer<typeof AppStateSchema>;

/** Structured output contract for AI-generated drafts (also validated server side). */
export const GeneratedDraftSchema = z.object({
  title: z.string(),
  objective: z.string(),
  script: z.string().describe("Original-wording narration script. Use [PAUSE 3s] or [PAUSE 5s: prompt] cues."),
  recallQuestions: z
    .array(z.object({ prompt: z.string(), answerKey: z.string(), concept: z.string() }))
    .min(1)
    .max(5),
  scenario: z.object({ prompt: z.string(), answerKey: z.string(), concept: z.string() }),
  citedSources: z.array(z.string()).describe("Citations for source-derived claims"),
  uncertainties: z.array(z.string()).describe("Claims to verify; mirror every [VERIFY] marker"),
  technicalReviewStatus: z.literal("requires_review"),
});
export type GeneratedDraft = z.infer<typeof GeneratedDraftSchema>;
