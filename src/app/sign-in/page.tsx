"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { IndependenceNote } from "@/components/Notes";
import { BACKEND } from "@/lib/backend-mode";
import { getBrowserSupabase } from "@/lib/supabase/browser";

function SignInForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/today";
  const linkError = params.get("error");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ phase: "idle" | "sending" | "sent"; error: string | null }>({ phase: "idle", error: null });

  if (BACKEND.mode === "local") {
    return (
      <div className="card">
        <h1>Sign-in isn&apos;t enabled</h1>
        <p>This copy of SpecLoop runs in local demo mode, with no accounts. Your data stays in this browser.</p>
        <Link href="/today" className="btn btn-primary">
          Continue
        </Link>
      </div>
    );
  }
  if (BACKEND.mode === "misconfigured") {
    return (
      <div className="card" role="alert">
        <h1>Sign-in is unavailable</h1>
        <p>{BACKEND.problem}</p>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setState({ phase: "idle", error: "Enter a valid email address." });
      return;
    }
    setState({ phase: "sending", error: null });
    const redirect = new URL("/auth/callback", window.location.origin);
    redirect.searchParams.set("next", next);
    const { error } = await getBrowserSupabase().auth.signInWithOtp({
      email: value,
      options: { emailRedirectTo: redirect.toString(), shouldCreateUser: true },
    });
    if (error) {
      setState({
        phase: "idle",
        error: /rate|too many/i.test(error.message) ? "Too many sign-in emails were requested. Wait a minute and try again." : `Couldn't send the link: ${error.message}`,
      });
      return;
    }
    setState({ phase: "sent", error: null });
  }

  return (
    <div className="card">
      <h1>Sign in to SpecLoop</h1>
      {linkError && (
        <div className="notice notice-danger" role="alert" style={{ marginBottom: "1rem" }}>
          {linkError}
        </div>
      )}
      {state.phase === "sent" ? (
        <div role="status">
          <p>
            <strong>Check your email.</strong> We sent a sign-in link to {email.trim()}. Open it in this browser. The link
            expires after a short time.
          </p>
          <button type="button" className="btn" onClick={() => setState({ phase: "idle", error: null })}>
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <p className="muted">We&apos;ll email you a one-time sign-in link. No password needed.</p>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="text"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(state.error)}
              aria-describedby={state.error ? "email-err" : undefined}
            />
            {state.error && (
              <div className="error-text" id="email-err" role="alert">
                {state.error}
              </div>
            )}
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={state.phase === "sending"}>
            {state.phase === "sending" ? "Sending…" : "Email me a sign-in link"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function SignInPage() {
  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
      <div className="mt-1">
        <IndependenceNote />
      </div>
    </div>
  );
}
