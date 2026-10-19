// Which persistence backend the app uses. Fails closed: local demo mode only
// when BOTH Supabase variables are absent. A partial or invalid configuration
// is an error the user sees, never a silent fallback to browser storage.

export type BackendMode =
  | { mode: "local" }
  | { mode: "supabase"; url: string; anonKey: string }
  | { mode: "misconfigured"; problem: string };

export function resolveBackendMode(url: string | undefined, anonKey: string | undefined): BackendMode {
  const u = url?.trim() ?? "";
  const k = anonKey?.trim() ?? "";
  if (!u && !k) return { mode: "local" };
  if (!u) return { mode: "misconfigured", problem: "NEXT_PUBLIC_SUPABASE_ANON_KEY is set but NEXT_PUBLIC_SUPABASE_URL is missing." };
  if (!k) return { mode: "misconfigured", problem: "NEXT_PUBLIC_SUPABASE_URL is set but NEXT_PUBLIC_SUPABASE_ANON_KEY is missing." };
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return { mode: "misconfigured", problem: "NEXT_PUBLIC_SUPABASE_URL isn't a valid URL." };
  }
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
    return { mode: "misconfigured", problem: "NEXT_PUBLIC_SUPABASE_URL must use https (http is allowed only for localhost)." };
  }
  return { mode: "supabase", url: u.replace(/\/+$/, ""), anonKey: k };
}

// NEXT_PUBLIC_* values are inlined at build time, so this is the same on the
// server and in the browser. Read them by literal name so Next can inline them.
export const BACKEND: BackendMode = resolveBackendMode(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
