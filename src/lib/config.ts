import "server-only";
import { BACKEND } from "./backend-mode";
import { getBillingStatus } from "./billing";

// Server-side view of which integrations are configured. Never returns secret
// values, only booleans and non-secret labels.

export const DEFAULT_AI_MODEL = "claude-opus-5-5";

export interface PublicConfig {
  backend: { mode: "local" | "supabase" | "misconfigured"; problem: string | null };
  ai: { enabled: boolean; provider: "anthropic" | null; model: string | null };
  tts: { onestudioConfigured: boolean };
  billing: ReturnType<typeof getBillingStatus>;
}

export function aiConfig(env = process.env) {
  const enabled = env.AI_PROVIDER === "anthropic" && Boolean(env.ANTHROPIC_API_KEY);
  return { enabled, model: env.ANTHROPIC_MODEL || DEFAULT_AI_MODEL };
}

export function publicConfig(env = process.env): PublicConfig {
  const ai = aiConfig(env);
  return {
    backend: { mode: BACKEND.mode, problem: BACKEND.mode === "misconfigured" ? BACKEND.problem : null },
    ai: { enabled: ai.enabled, provider: ai.enabled ? "anthropic" : null, model: ai.enabled ? ai.model : null },
    // Always false until a verified OneStudio adapter exists.
    tts: { onestudioConfigured: false },
    billing: getBillingStatus(env),
  };
}
