import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GeneratedDraftSchema } from "../types";
import { interpretDraftResponse, type DraftOutcome } from "./interpret";
import { DRAFT_SYSTEM_PROMPT, buildDraftUserMessage } from "./prompt";

// Anthropic adapter for lesson drafting. Only used when AI_PROVIDER=anthropic
// and ANTHROPIC_API_KEY are set. Exactly one request goes to the configured
// model; a refusal is returned to the user as-is, with no fallback model.

export async function generateDraftWithAnthropic(
  input: Parameters<typeof buildDraftUserMessage>[0],
  model: string,
): Promise<DraftOutcome> {
  const client = new Anthropic();
  try {
    const response = await client.messages.parse({
      model,
      max_tokens: 16000,
      output_config: { effort: "medium", format: zodOutputFormat(GeneratedDraftSchema) },
      system: DRAFT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildDraftUserMessage(input) }],
    });
    return interpretDraftResponse(response);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { kind: "error", message: "The AI provider rejected the API key.", status: 502 };
    if (err instanceof Anthropic.RateLimitError) return { kind: "error", message: "The AI provider is rate limiting requests. Try again shortly.", status: 503 };
    if (err instanceof Anthropic.BadRequestError) return { kind: "error", message: "The AI provider rejected the request.", status: 502 };
    if (err instanceof Anthropic.APIConnectionError) return { kind: "error", message: "Couldn't reach the AI provider.", status: 502 };
    if (err instanceof Anthropic.APIError) return { kind: "error", message: "The AI provider returned an error.", status: 502 };
    throw err;
  }
}
