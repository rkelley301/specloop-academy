import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const parse = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {}
  class Anthropic {
    static APIError = APIError;
    static AuthenticationError = class extends APIError {};
    static RateLimitError = class extends APIError {};
    static BadRequestError = class extends APIError {};
    static APIConnectionError = class extends APIError {};
    messages = { parse };
  }
  return { default: Anthropic };
});

const { generateDraftWithAnthropic } = await import("./anthropic");
const { interpretDraftResponse } = await import("./interpret");

const input = { sourceTitle: "t", citation: "c", sourceType: "My own notes", learnerGoal: "", text: "x".repeat(60) };

describe("AI drafting adapter", () => {
  beforeEach(() => parse.mockReset());

  it("sends one request to the configured model with no fallback or beta parameters", async () => {
    parse.mockResolvedValue({ model: "claude-opus-5-5", stop_reason: "refusal", stop_details: { category: "general_harms", explanation: "Declined." } });
    await generateDraftWithAnthropic(input, "claude-opus-5-5");
    expect(parse).toHaveBeenCalledTimes(1);
    const params = parse.mock.calls[0][0];
    expect(params.model).toBe("claude-opus-5-5");
    expect(params).not.toHaveProperty("fallbacks");
    expect(params).not.toHaveProperty("betas");
  });

  it("returns a refusal unchanged instead of retrying", async () => {
    parse.mockResolvedValue({ model: "claude-opus-5-5", stop_reason: "refusal", stop_details: { category: "general_harms", explanation: "Declined." } });
    const out = await generateDraftWithAnthropic(input, "claude-opus-5-5");
    expect(out).toEqual({ kind: "refusal", refusal: { category: "general_harms", explanation: "Declined.", model: "claude-opus-5-5" } });
    expect(parse).toHaveBeenCalledTimes(1);
  });
});

describe("interpretDraftResponse", () => {
  it("handles refusal without stop details, truncation, and invalid output", () => {
    expect(interpretDraftResponse({ model: "m", stop_reason: "refusal", stop_details: null })).toEqual({
      kind: "refusal",
      refusal: { category: null, explanation: null, model: "m" },
    });
    expect(interpretDraftResponse({ model: "m", stop_reason: "max_tokens" })).toMatchObject({ kind: "error", status: 422 });
    expect(interpretDraftResponse({ model: "m", stop_reason: "end_turn", parsed_output: { title: 1 } })).toMatchObject({ kind: "error", status: 502 });
  });
});
