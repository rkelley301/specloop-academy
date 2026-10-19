import { addDays, daysBetween, localDateIn } from "./dates";
import type { AppState, Lesson, ReviewItem } from "./types";

export function today(state: AppState, now: Date = new Date()): string {
  return localDateIn(state.profile?.timezone ?? "UTC", now);
}

export function isCompleted(state: AppState, lessonId: string): boolean {
  return state.completions.some((c) => c.lessonId === lessonId);
}

export function orderedLessons(state: AppState, pathId: string): Lesson[] {
  const path = state.paths.find((p) => p.id === pathId);
  if (!path) return [];
  return path.lessonIds.map((id) => state.lessons[id]).filter((l): l is Lesson => Boolean(l));
}

export function nextLesson(state: AppState): Lesson | null {
  for (const path of state.paths) {
    for (const l of orderedLessons(state, path.id)) {
      if (!isCompleted(state, l.id)) return l;
    }
  }
  return null;
}

export function dueReviews(state: AppState, onDate: string): ReviewItem[] {
  return state.reviewItems
    .filter((r) => r.status === "active" && r.dueDate <= onDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function upcomingReviews(state: AppState, onDate: string, days = 7): ReviewItem[] {
  const end = addDays(onDate, days);
  return state.reviewItems
    .filter((r) => r.status === "active" && r.dueDate > onDate && r.dueDate <= end)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Upcoming review counts grouped by date. */
export function upcomingByDay(state: AppState, onDate: string, days = 7): { date: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of upcomingReviews(state, onDate, days)) map.set(r.dueDate, (map.get(r.dueDate) ?? 0) + 1);
  return [...map.entries()].map(([date, count]) => ({ date, count }));
}

/** Learner-local dates on which any learning activity happened. */
export function activityDates(state: AppState): Set<string> {
  const tz = state.profile?.timezone ?? "UTC";
  const dates = new Set<string>();
  for (const a of state.attempts) dates.add(localDateIn(tz, new Date(a.createdAt)));
  for (const c of state.completions) dates.add(localDateIn(tz, new Date(c.completedAt)));
  return dates;
}

/**
 * Consecutive days with activity, ending today (or yesterday, so the streak
 * isn't shown as broken before the learner has studied today).
 */
export function streak(state: AppState, onDate: string): number {
  const dates = activityDates(state);
  let cursor = dates.has(onDate) ? onDate : addDays(onDate, -1);
  let n = 0;
  while (dates.has(cursor)) {
    n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export interface ActivityEntry {
  at: string;
  kind: "completed" | "answered";
  lessonId: string;
  text: string;
}

export function recentActivity(state: AppState, limit = 6): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  for (const c of state.completions) {
    const l = state.lessons[c.lessonId];
    entries.push({ at: c.completedAt, kind: "completed", lessonId: c.lessonId, text: `Completed “${l?.title ?? c.lessonId}”` });
  }
  for (const a of state.attempts) {
    const l = state.lessons[a.lessonId];
    const what = a.kind === "scenario" ? "scenario" : "recall question";
    const where = a.context === "review" ? "Reviewed a" : "Answered a";
    entries.push({
      at: a.createdAt,
      kind: "answered",
      lessonId: a.lessonId,
      text: `${where} ${what} (${a.result === "correct" ? "got it" : "missed"}) in “${l?.title ?? a.lessonId}”`,
    });
  }
  return entries.sort((x, y) => y.at.localeCompare(x.at)).slice(0, limit);
}

export function findQuestion(state: AppState, lessonId: string, questionId: string) {
  const lesson = state.lessons[lessonId];
  if (!lesson) return null;
  const q = lesson.questions.find((x) => x.id === questionId);
  if (q) return { lesson, kind: "recall" as const, prompt: q.prompt, answerKey: q.answerKey, answerKeyMissing: false };
  if (lesson.scenario.id === questionId)
    return {
      lesson,
      kind: "scenario" as const,
      prompt: lesson.scenario.prompt,
      answerKey: lesson.scenario.answerKey,
      answerKeyMissing: Boolean(lesson.scenario.answerKeyMissing),
    };
  return null;
}

export function lessonProgress(state: AppState, lessonId: string) {
  const lesson = state.lessons[lessonId];
  if (!lesson) return { answered: 0, total: 0 };
  const ids = [...lesson.questions.map((q) => q.id), lesson.scenario.id];
  const answered = ids.filter((id) => state.attempts.some((a) => a.questionId === id && a.context === "lesson")).length;
  return { answered, total: ids.length };
}

export function reviewStatusForLesson(state: AppState, lessonId: string, onDate: string) {
  const items = state.reviewItems.filter((r) => r.lessonId === lessonId && r.status === "active");
  const due = items.filter((r) => r.dueDate <= onDate).length;
  const next = items.map((r) => r.dueDate).filter((d) => d > onDate).sort()[0] ?? null;
  return { active: items.length, due, next, daysToNext: next ? daysBetween(onDate, next) : null };
}
