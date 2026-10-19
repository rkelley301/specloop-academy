import { GeneratedDraftSchema, type GeneratedDraft } from "../types";

// Maps a Messages API response to a draft, a refusal, or an error. A refusal
// is a result to show the user, not something to work around: SpecLoop never
// retries a declined request on a different model.

export interface DraftRefusal {
  category: string | null;
  explanation: string | null;
  model: string;
}

export type DraftOutcome =
  | { kind: "draft"; draft: GeneratedDraft; model: string }
  | { kind: "refusal"; refusal: DraftRefusal }
  | { kind: "error"; message: string; status: number };

export interface DraftResponseLike {
  model: string;
  stop_reason: string | null;
  stop_details?: { category?: string | null; explanation?: string | null } | null;
  parsed_output?: unknown;
}

export function interpretDraftResponse(res: DraftResponseLike): DraftOutcome {
  if (res.stop_reason === "refusal") {
    return {
      kind: "refusal",
      refusal: {
        category: res.stop_details?.category ?? null,
        explanation: res.stop_details?.explanation ?? null,
        model: res.model,
      },
    };
  }
  if (res.stop_reason === "max_tokens") {
    return { kind: "error", message: "The AI draft was cut off before finishing. Try a shorter excerpt.", status: 422 };
  }
  const parsed = GeneratedDraftSchema.safeParse(res.parsed_output);
  if (!parsed.success) return { kind: "error", message: "The AI output didn't match the lesson draft format.", status: 502 };
  return { kind: "draft", draft: parsed.data, model: res.model };
}
