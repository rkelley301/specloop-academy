import type { Attribution, Lesson, LearningPath } from "../types";
import seed from "./ccst-l1-seed.generated.json";
import type { ParsedSeedLesson } from "./parse-seed-lesson";

// Seed course: "SpecLoop Academy — CCST Level 1 Seed Course", Draft v0.1.
// Source markdown lives in content/ccst-l1-seed-v0.1 and is converted
// verbatim by `npm run seed:import`. Objectives, scripts, questions, scenarios,
// answer keys and review notes are not rewritten here; this file only adds
// ids, attribution and an estimated duration.

const pack = seed as { packVersion: string; lessons: ParsedSeedLesson[] };

export const SEED_VERSION = `ccst1-seed-v${pack.packVersion}`;
export const SEED_PACK_VERSION = pack.packVersion;
export const SEED_PATH_ID = "ccst-l1";
export const SEED_CREATED_AT = "2026-10-19T00:00:00.000Z";

export const SEED_RELEASE_GATE =
  "Do not publish, sell, assign to learners as approved technical training, or use to direct field work until an experienced I&C professional reviews and signs off on every lesson.";

export const MISSING_SCENARIO_ANSWER =
  "No scenario answer key is included for this lesson in seed pack v0.1. A technical reviewer must supply one before this lesson can be approved. Compare your response with the lesson script and the review note instead.";

/** Rough duration: narration at ~130 words/min, plus pauses, plus ~4 min of questions. */
export function estimateMinutes(script: string): number {
  const words = script.replace(/\[PAUSE[^\]]*\]/gi, " ").split(/\s+/).filter(Boolean).length;
  const pauseSeconds = [...script.matchAll(/\[PAUSE\s+(\d+)/gi)].reduce((n, m) => n + Number(m[1]), 0);
  return Math.max(3, Math.ceil(words / 130 + pauseSeconds / 60) + 4);
}

function lessonId(code: string) {
  return code.toLowerCase(); // "SL01" -> "sl01"
}

function attribution(l: ParsedSeedLesson): Attribution {
  return {
    title: `SpecLoop CCST Level 1 Seed Course, Draft v${pack.packVersion}, ${l.code}`,
    citation: `content/ccst-l1-seed-v${pack.packVersion}/lessons/${l.file}. Original instructional draft that used the public ISA CCST Body of Knowledge only as a broad topic-weighting reference. Not ISA material. Technical review required.`,
  };
}

export function buildSeedLessons(): Lesson[] {
  return pack.lessons.map((l, i) => {
    const id = lessonId(l.code);
    const questions = l.recall.map((prompt, qi) => ({
      id: `${id}-q${qi + 1}`,
      prompt,
      answerKey: l.answers[qi],
      conceptId: `${id}-c${qi + 1}`,
    }));
    const concepts = questions.map((q, qi) => ({ id: q.conceptId, label: `${l.code} recall ${qi + 1}` }));
    concepts.push({ id: `${id}-cs`, label: `${l.code} scenario` });
    const notes = [l.banner];
    if (l.reviewNote) notes.push(`Review note: ${l.reviewNote}`);
    return {
      id,
      pathId: SEED_PATH_ID,
      order: i + 1,
      title: l.title,
      objective: l.objective,
      estMinutes: estimateMinutes(l.script),
      script: l.script,
      scriptVersion: 1,
      scriptHistory: [{ version: 1, script: l.script, savedAt: SEED_CREATED_AT }],
      concepts,
      questions,
      scenario: {
        id: `${id}-s1`,
        prompt: l.scenario,
        answerKey: l.scenarioAnswer ?? MISSING_SCENARIO_ANSWER,
        conceptId: `${id}-cs`,
        ...(l.scenarioAnswer ? {} : { answerKeyMissing: true }),
      },
      sourceNote: notes.join("\n\n"),
      sources: [attribution(l)],
      reviewStatus: "draft" as const,
      origin: "seed" as const,
      createdAt: SEED_CREATED_AT,
      updatedAt: SEED_CREATED_AT,
    };
  });
}

export function buildSeedPath(): LearningPath {
  return {
    id: SEED_PATH_ID,
    title: "CCST Level 1 foundations (sample path)",
    description:
      "Ten short lessons on core instrumentation topics. Independent study support only: not endorsed by ISA, not a complete exam blueprint, and no guarantee of certification. Every lesson is a draft awaiting technical review.",
    lessonIds: pack.lessons.map((l) => lessonId(l.code)),
    origin: "seed",
  };
}

export const SEED_LESSON_COUNT = pack.lessons.length;
