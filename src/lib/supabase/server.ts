import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { BACKEND } from "../backend-mode";

/** Server-side client acting as the signed-in user (anon key + session cookie). */
export async function getServerSupabase(): Promise<SupabaseClient> {
  if (BACKEND.mode !== "supabase") throw new Error("Supabase isn't configured.");
  const store = await cookies();
  return createServerClient(BACKEND.url, BACKEND.anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component; the middleware refreshes cookies instead.
        }
      },
    },
  });
}

/** Only same-origin relative paths are allowed as post-sign-in destinations. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/today";
  return next;
}
