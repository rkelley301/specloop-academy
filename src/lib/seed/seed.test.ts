import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MISSING_SCENARIO_ANSWER, buildSeedLessons, buildSeedPath } from "./ccst-level1";
import generated from "./ccst-l1-seed.generated.json";
import { parseSeedLesson } from "./parse-seed-lesson";
import { LessonSchema } from "../types";

const dir = join(import.meta.dirname, "../../../content/ccst-l1-seed-v0.1/lessons");

describe("seed pack import", () => {
  it("generated JSON is in sync with the pack markdown (run `npm run seed:import` if this fails)", () => {
    const files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
    const parsed = files.map((f) => parseSeedLesson(f, readFileSync(join(dir, f), "utf8")));
    expect(parsed).toEqual(generated.lessons);
  });

  it("builds 10 valid lessons in the brief's order, preserving pack text", () => {
    const lessons = buildSeedLessons();
    expect(lessons.map((l) => l.title)).toEqual([
      "The measurement loop: process to operator display",
      "What a 4–20 mA signal tells you",
      "Range, zero, span, and engineering units",
      "Pressure measurement: gauge, absolute, and differential",
      "RTD versus thermocouple",
      "Calibration versus verification",
      "Troubleshoot from symptom to cause",
      "Control valve position and feedback",
      "Loop checks and commissioning evidence",
      "Close the work order with useful records",
    ]);
    for (const l of lessons) {
      expect(LessonSchema.safeParse(l).success).toBe(true);
      expect(l.questions).toHaveLength(3);
      expect(l.reviewStatus).toBe("draft");
      expect(l.sourceNote).toMatch(/TECHNICAL REVIEW REQUIRED/);
      expect(l.sources[0].citation).toMatch(/Not ISA material/);
    }
    const sl02 = lessons[1];
    expect(sl02.questions[0].answerKey).toBe("50% of span: (12−4)/16 = 0.5.");
    expect(sl02.scenario.answerKey).toMatch(/^50 degrees/);
    expect(buildSeedPath().lessonIds).toEqual(lessons.map((l) => l.id));
  });

  it("flags SL01's missing scenario answer instead of inventing one, and keeps its review note", () => {
    const sl01 = buildSeedLessons()[0];
    expect(sl01.scenario.answerKeyMissing).toBe(true);
    expect(sl01.scenario.answerKey).toBe(MISSING_SCENARIO_ANSWER);
    expect(sl01.sourceNote).toMatch(/Review note: A local indicator is not guaranteed/);
  });

  it("rejects malformed lessons", () => {
    expect(() => parseSeedLesson("x.md", "# SL99 — T\n**Objective:** o\n## Audio script\ns")).toThrow();
  });
});
