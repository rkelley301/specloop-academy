import { describe, expect, it } from "vitest";
import { addDays, daysBetween, localDateIn } from "./dates";
import { scheduleAfterReview, scheduleInitial } from "./scheduler";

const T = "2026-10-19";

describe("dates", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-29", 7)).toBe("2027-01-05");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(daysBetween("2026-10-19", "2026-10-26")).toBe(7);
  });
  it("uses the learner's timezone for 'today'", () => {
    const instant = new Date("2026-10-20T02:00:00Z");
    expect(localDateIn("UTC", instant)).toBe("2026-10-20");
    expect(localDateIn("America/Chicago", instant)).toBe("2026-10-19");
  });
});

describe("initial schedule", () => {
  it("missed → tomorrow", () => {
    const s = scheduleInitial("missed", T);
    expect(s).toMatchObject({ track: "missed", step: 0, dueDate: "2026-10-20" });
  });
  it("correct → 3 days", () => {
    const s = scheduleInitial("correct", T);
    expect(s).toMatchObject({ track: "correct", step: 0, dueDate: "2026-10-22" });
  });
});

describe("review ladder", () => {
  it("missed item answered correctly climbs 1 → 3 → 7 then retires", () => {
    let item = { track: "missed" as const, step: 0 };
    let day = addDays(T, 1);
    let s = scheduleAfterReview(item, "correct", day);
    expect(s).toMatchObject({ step: 1, dueDate: addDays(day, 3) });
    item = { track: "missed", step: s.step };
    day = s.dueDate!;
    s = scheduleAfterReview(item, "correct", day);
    expect(s).toMatchObject({ step: 2, dueDate: addDays(day, 7) });
    item = { track: "missed", step: s.step };
    s = scheduleAfterReview(item, "correct", s.dueDate!);
    expect(s.dueDate).toBeNull();
  });
  it("correct item climbs 3 → 7 then retires", () => {
    const s1 = scheduleAfterReview({ track: "correct", step: 0 }, "correct", "2026-10-22");
    expect(s1).toMatchObject({ step: 1, dueDate: "2026-10-29" });
    const s2 = scheduleAfterReview({ track: "correct", step: 1 }, "correct", "2026-10-29");
    expect(s2.dueDate).toBeNull();
  });
  it("a miss at any step restarts the missed ladder at 1 day", () => {
    const s = scheduleAfterReview({ track: "correct", step: 1 }, "missed", "2026-10-29");
    expect(s).toMatchObject({ track: "missed", step: 0, dueDate: "2026-10-30" });
  });
});
