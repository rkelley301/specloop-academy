import { addDays } from "./dates";
import type { Result, ReviewItem } from "./types";

// SpecLoop's review schedule is a fixed ladder, deliberately simple so a
// learner can see exactly why something is due. It is not FSRS or SM-2.
//
//   Missed  → review in 1 day, then 3 days, then 7 days.
//   Correct → review in 3 days, then 7 days.
//
// Each correct review climbs one rung. A miss at any point restarts the
// missed ladder (back to 1 day). Clearing the last rung retires the item.

export const LADDERS: Record<Result, readonly number[]> = {
  missed: [1, 3, 7],
  correct: [3, 7],
};

export interface ScheduleOutcome {
  track: Result;
  step: number;
  dueDate: string | null; // null = retired
  reason: string;
}

function ladderText(track: Result): string {
  return LADDERS[track].map((d) => `${d}d`).join(" → ");
}

/** First result for a question (from a lesson), or a re-answer in a lesson. */
export function scheduleInitial(result: Result, today: string): ScheduleOutcome {
  const interval = LADDERS[result][0];
  return {
    track: result,
    step: 0,
    dueDate: addDays(today, interval),
    reason:
      result === "missed"
        ? `Missed, so it comes back in ${interval} day (missed ladder ${ladderText("missed")}).`
        : `Correct, so the first check-in is in ${interval} days (correct ladder ${ladderText("correct")}).`,
  };
}

/** Result of reviewing an item that was due. */
export function scheduleAfterReview(
  item: Pick<ReviewItem, "track" | "step">,
  result: Result,
  today: string,
): ScheduleOutcome {
  if (result === "missed") {
    const out = scheduleInitial("missed", today);
    return { ...out, reason: `Missed on review, so the missed ladder restarts: back in 1 day (${ladderText("missed")}).` };
  }
  const ladder = LADDERS[item.track];
  const nextStep = item.step + 1;
  if (nextStep >= ladder.length) {
    return {
      track: item.track,
      step: item.step,
      dueDate: null,
      reason: `Correct on the final ${ladder[ladder.length - 1]}-day review. Ladder complete, so the item is retired.`,
    };
  }
  const interval = ladder[nextStep];
  return {
    track: item.track,
    step: nextStep,
    dueDate: addDays(today, interval),
    reason: `Correct on review ${nextStep} of ${ladder.length}, so the next check is in ${interval} days (${ladderText(item.track)}).`,
  };
}

/** Plain-language description of where an item sits on its ladder. */
export function describePosition(item: Pick<ReviewItem, "track" | "step" | "status">): string {
  if (item.status === "retired") return "Ladder complete. No more reviews scheduled.";
  const ladder = LADDERS[item.track];
  const label = item.track === "missed" ? "Missed ladder" : "Correct ladder";
  return `${label}, review ${item.step + 1} of ${ladder.length} (${ladder[item.step]}-day interval; full ladder ${ladderText(item.track)}).`;
}
