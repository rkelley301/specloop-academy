import { describe, expect, it } from "vitest";
import { getBillingStatus } from "./billing";
import { validateAudioFile } from "./providers/tts";
import { countPauses, parseScript } from "./script";
import { GeneratedDraftSchema } from "./types";

describe("script cues", () => {
  it("parses seed-pack and short pause cues", () => {
    const parts = parseScript("Intro.\n\n[PAUSE 3 SECONDS]\n\nMore.[PAUSE 5s: Name the parts.] End.");
    expect(parts.map((p) => p.kind)).toEqual(["text", "pause", "text", "pause", "text"]);
    expect(parts[3]).toMatchObject({ kind: "pause", seconds: 5, prompt: "Name the parts." });
    expect(countPauses("[PAUSE 3 SECONDS] [pause 2s]")).toBe(2);
  });
});

describe("audio validation", () => {
  it("accepts mp3/wav under 50 MB and rejects others", () => {
    expect(validateAudioFile({ name: "a.mp3", type: "audio/mpeg", size: 1000 })).toBeNull();
    expect(validateAudioFile({ name: "a.wav", type: "", size: 1000 })).toBeNull();
    expect(validateAudioFile({ name: "a.ogg", type: "audio/ogg", size: 1000 })).toMatch(/MP3 or WAV/);
    expect(validateAudioFile({ name: "a.mp3", type: "audio/mpeg", size: 60 * 1024 * 1024 })).toMatch(/50 MB/);
  });
});

describe("billing", () => {
  it("is always disabled in this build", () => {
    expect(getBillingStatus({}).enabled).toBe(false);
    expect(getBillingStatus({ BILLING_ENABLED: "true", STRIPE_SECRET_KEY: "x", STRIPE_PRICE_ID: "y" }).enabled).toBe(false);
  });
});

describe("AI output contract", () => {
  it("requires review status and at least one recall question", () => {
    const ok = {
      title: "t",
      objective: "o",
      script: "s [PAUSE 3 SECONDS]",
      recallQuestions: [{ prompt: "p", answerKey: "a", concept: "c" }],
      scenario: { prompt: "p", answerKey: "a", concept: "c" },
      citedSources: ["src"],
      uncertainties: [],
      technicalReviewStatus: "requires_review",
    };
    expect(GeneratedDraftSchema.safeParse(ok).success).toBe(true);
    expect(GeneratedDraftSchema.safeParse({ ...ok, technicalReviewStatus: "approved" }).success).toBe(false);
    expect(GeneratedDraftSchema.safeParse({ ...ok, recallQuestions: [] }).success).toBe(false);
  });
});
