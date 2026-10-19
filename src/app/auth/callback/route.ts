import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { BACKEND } from "@/lib/backend-mode";
import { getServerSupabase, safeNext } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Magic-link landing. Supports both the PKCE `code` link (the default email
// template) and the `token_hash` link (custom templates).
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const back = (msg: string) => NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(msg)}&next=${encodeURIComponent(next)}`, url.origin));
  if (BACKEND.mode !== "supabase") return back("Sign-in isn't enabled on this server.");

  const supabase = await getServerSupabase();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const remoteError = url.searchParams.get("error_description");
  if (remoteError) return back(remoteError);

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return back("That sign-in link is invalid or expired. Request a new one, and open it in the same browser.");
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return back("That sign-in link is invalid or expired. Request a new one.");
  } else {
    return back("The sign-in link was incomplete.");
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
