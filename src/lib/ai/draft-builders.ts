import type { DraftInput } from "../reducer";
import type { Attribution, GeneratedDraft, Source } from "../types";

// Builders for lesson drafts. Every draft carries attribution for the source
// it came from and starts in "draft" review status. Nothing becomes a lesson
// until a person approves it.

export function attributionFor(source: Source): Attribution {
  return { sourceId: source.id, title: source.title, citation: source.citation, url: source.url || undefined };
}

type IdFn = (prefix: string) => string;

/**
 * Deterministic template used when no AI provider is configured. It
 * deliberately doesn't summarize or quote the source text. It gives the author
 * a structured skeleton to fill in from their own reading.
 */
export function templateDraft(source: Source, nowIso: string, newId: IdFn): DraftInput {
  const c1 = newId("con");
  const c2 = newId("con");
  return {
    sourceIds: [source.id],
    attributions: [attributionFor(source)],
    title: `Draft: ${source.title}`,
    objective: "[EDIT] After this lesson the learner can …",
    estMinutes: 8,
    script: [
      "[EDIT] Open with the practical problem this topic solves, in your own words.",
      "",
      "[PAUSE 3 SECONDS]",
      "",
      "[EDIT] Explain the core idea. Paraphrase the source; keep any quotation short and cite it.",
      "",
      "[PAUSE 5s: Ask the learner to recall the key idea before you restate it.]",
      "",
      "[EDIT] Restate the idea and connect it to a field situation.",
      "",
      "Field note: field tasks follow site procedures, permits, isolation and lockout where applicable, and qualified supervision.",
    ].join("\n"),
    concepts: [
      { id: c1, label: "Key idea" },
      { id: c2, label: "Applied scenario" },
    ],
    questions: [
      { id: newId("q"), prompt: "[EDIT] Recall question about the key idea", answerKey: "[EDIT] Answer key, with a source reference", conceptId: c1 },
    ],
    scenario: {
      id: newId("q"),
      prompt: "[EDIT] A short field scenario that applies the idea",
      answerKey: "[EDIT] The key points a good answer covers",
      conceptId: c2,
    },
    uncertainties: ["[VERIFY] Every technical claim in this draft against the cited source before approval."],
    generatedBy: "template",
    generatedAt: nowIso,
  };
}

export function blankDraft(nowIso: string, newId: IdFn): DraftInput {
  const c1 = newId("con");
  const c2 = newId("con");
  return {
    sourceIds: [],
    attributions: [],
    title: "Untitled lesson draft",
    objective: "",
    estMinutes: 8,
    script: "",
    concepts: [
      { id: c1, label: "Key idea" },
      { id: c2, label: "Applied scenario" },
    ],
    questions: [{ id: newId("q"), prompt: "", answerKey: "", conceptId: c1 }],
    scenario: { id: newId("q"), prompt: "", answerKey: "", conceptId: c2 },
    uncertainties: [],
    generatedBy: "manual",
    generatedAt: nowIso,
  };
}

/** Converts validated AI output into an editable draft. */
export function draftFromGenerated(
  gen: GeneratedDraft,
  source: Source,
  model: string,
  nowIso: string,
  newId: IdFn,
): DraftInput {
  const concepts: { id: string; label: string }[] = [];
  const conceptFor = (label: string) => {
    const existing = concepts.find((c) => c.label === label);
    if (existing) return existing.id;
    const id = newId("con");
    concepts.push({ id, label });
    return id;
  };
  const questions = gen.recallQuestions.map((q) => ({
    id: newId("q"),
    prompt: q.prompt,
    answerKey: q.answerKey,
    conceptId: conceptFor(q.concept),
  }));
  const scenario = {
    id: newId("q"),
    prompt: gen.scenario.prompt,
    answerKey: gen.scenario.answerKey,
    conceptId: conceptFor(gen.scenario.concept),
  };
  const attributions = [attributionFor(source)];
  for (const c of gen.citedSources) {
    if (c.trim() && c.trim() !== source.citation.trim()) attributions.push({ sourceId: source.id, title: source.title, citation: c.trim() });
  }
  return {
    sourceIds: [source.id],
    attributions,
    title: gen.title,
    objective: gen.objective,
    estMinutes: 8,
    script: gen.script,
    concepts,
    questions,
    scenario,
    uncertainties: gen.uncertainties.length ? gen.uncertainties : ["[VERIFY] Review every technical claim against the source."],
    generatedBy: "ai",
    aiModel: model,
    generatedAt: nowIso,
  };
}
