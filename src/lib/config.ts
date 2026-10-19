import "server-only";
import { getBillingStatus } from "./billing";

// Server-side view of which integrations are configured. Never returns secret
// values, only booleans and non-secret labels.

export const DEFAULT_AI_MODEL = "claude-opus-5-5";

export interface PublicConfig {
  auth: "local-demo";
  storage: "local";
  ai: { enabled: boolean; provider: "anthropic" | null; model: string | null };
  tts: { onestudioConfigured: boolean };
  supabase: { configured: boolean; wired: false };
  billing: ReturnType<typeof getBillingStatus>;
}

export function aiConfig(env = process.env) {
  const enabled = env.AI_PROVIDER === "anthropic" && Boolean(env.ANTHROPIC_API_KEY);
  return { enabled, model: env.ANTHROPIC_MODEL || DEFAULT_AI_MODEL };
}

export function publicConfig(env = process.env): PublicConfig {
  const ai = aiConfig(env);
  return {
    auth: "local-demo",
    storage: "local",
    ai: { enabled: ai.enabled, provider: ai.enabled ? "anthropic" : null, model: ai.enabled ? ai.model : null },
    // Always false until a verified OneStudio adapter exists.
    tts: { onestudioConfigured: false },
    supabase: { configured: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY), wired: false },
    billing: getBillingStatus(env),
  };
}
