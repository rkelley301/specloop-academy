import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { GeneratedDraftSchema, type GeneratedDraft } from "../types";
import { DRAFT_SYSTEM_PROMPT, buildDraftUserMessage } from "./prompt";

// Anthropic adapter for lesson drafting. Only used when AI_PROVIDER=anthropic
// and ANTHROPIC_API_KEY are set. The server-side "default" fallback re-runs a
// request that a safety classifier declines on Anthropic's recommended
// fallback model.

export class AiDraftError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function generateDraftWithAnthropic(
  input: Parameters<typeof buildDraftUserMessage>[0],
  model: string,
): Promise<{ draft: GeneratedDraft; model: string }> {
  const client = new Anthropic();
  let response;
  try {
    response = await client.beta.messages.parse({
      model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(GeneratedDraftSchema) },
      system: DRAFT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildDraftUserMessage(input) }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new AiDraftError("The AI provider rejected the API key.", 502);
    if (err instanceof Anthropic.RateLimitError) throw new AiDraftError("The AI provider is rate limiting requests. Try again shortly.", 503);
    if (err instanceof Anthropic.BadRequestError) throw new AiDraftError("The AI provider rejected the request.", 502);
    if (err instanceof Anthropic.APIConnectionError) throw new AiDraftError("Couldn't reach the AI provider.", 502);
    if (err instanceof Anthropic.APIError) throw new AiDraftError("The AI provider returned an error.", 502);
    throw err;
  }
  if (response.stop_reason === "refusal") {
    throw new AiDraftError("The AI provider declined to draft from this source. Use the manual draft instead.", 422);
  }
  if (response.stop_reason === "max_tokens") {
    throw new AiDraftError("The AI draft was cut off before finishing. Try a shorter excerpt.", 422);
  }
  const parsed = GeneratedDraftSchema.safeParse(response.parsed_output);
  if (!parsed.success) throw new AiDraftError("The AI output didn't match the lesson draft format.", 502);
  return { draft: parsed.data, model: response.model };
}
