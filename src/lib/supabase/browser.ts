"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BACKEND } from "../backend-mode";

// Browser client: only ever sees the public URL and anon key. Access control
// is enforced by row-level security and storage policies, not by hiding keys.

let client: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (BACKEND.mode !== "supabase") throw new Error("Supabase isn't configured.");
  client ??= createBrowserClient(BACKEND.url, BACKEND.anonKey);
  return client;
}
