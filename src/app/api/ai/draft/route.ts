import { NextResponse } from "next/server";
import { z } from "zod";
import { AiDraftError, generateDraftWithAnthropic } from "@/lib/ai/anthropic";
import { AI_MAX_SOURCE_CHARS } from "@/lib/ai/prompt";
import { aiConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

const Body = z.object({
  consent: z.literal(true),
  sourceTitle: z.string().min(1).max(300),
  citation: z.string().min(1).max(1000),
  sourceType: z.string().max(60),
  learnerGoal: z.string().max(400).default(""),
  text: z.string().min(50, "Add at least a paragraph of source text first."),
});

export async function POST(req: Request) {
  const cfg = aiConfig();
  if (!cfg.enabled) {
    return NextResponse.json({ error: "AI drafting isn't configured on this server." }, { status: 503 });
  }
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues[0]?.message : "Invalid request.";
    return NextResponse.json({ error: msg ?? "Invalid request." }, { status: 400 });
  }
  if (body.text.length > AI_MAX_SOURCE_CHARS) {
    // No silent truncation: ask the user to choose the relevant excerpt.
    return NextResponse.json(
      { error: `The source text is ${body.text.length.toLocaleString()} characters. Paste a focused excerpt under ${AI_MAX_SOURCE_CHARS.toLocaleString()}.` },
      { status: 413 },
    );
  }
  try {
    const result = await generateDraftWithAnthropic(body, cfg.model);
    return NextResponse.json(result);
  } catch (err) {
    // Don't log the source text or the model output; they may be private.
    if (err instanceof AiDraftError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("AI draft failed:", err instanceof Error ? err.name : "unknown error");
    return NextResponse.json({ error: "AI drafting failed unexpectedly." }, { status: 500 });
  }
}
