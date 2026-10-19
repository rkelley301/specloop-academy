"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { AppState } from "@/lib/types";
import { clearStoredState, useStore, type StoreSnapshot } from "@/lib/store";

export function LoadingView({ label = "Loading your study data…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="stack">
      <span className="visually-hidden">{label}</span>
      <div className="skeleton" style={{ width: "40%", height: "1.6rem" }} />
      <div className="card">
        <div className="skeleton" style={{ width: "70%" }} />
        <div className="skeleton" style={{ width: "90%", marginTop: "0.6rem" }} />
        <div className="skeleton" style={{ width: "55%", marginTop: "0.6rem" }} />
      </div>
      <div className="card">
        <div className="skeleton" style={{ width: "60%" }} />
        <div className="skeleton" style={{ width: "80%", marginTop: "0.6rem" }} />
      </div>
    </div>
  );
}

export function StoreErrorView({ message, raw }: { message: string; raw: string | null }) {
  const download = () => {
    if (!raw) return;
    const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "specloop-unreadable-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="card" role="alert">
      <h1>We couldn&apos;t read your saved data</h1>
      <p>{message}</p>
      <p className="muted">
        This can happen if browser storage was edited or saved by an incompatible version. You can download the
        unreadable data for safekeeping, then start fresh with the seeded demo.
      </p>
      <div className="row">
        {raw && (
          <button type="button" className="btn" onClick={download}>
            Download unreadable data
          </button>
        )}
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            if (window.confirm("Replace the unreadable data with a fresh demo? This can't be undone.")) clearStoredState();
          }}
        >
          Reset to fresh demo
        </button>
      </div>
    </div>
  );
}

export function ConfigErrorView({ message }: { message: string }) {
  return (
    <div className="card" role="alert">
      <h1>SpecLoop isn&apos;t configured correctly</h1>
      <p>{message}</p>
      <p className="muted">
        Set both <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> for hosted mode,
        or remove both for local demo mode. Then rebuild or restart the app. SpecLoop won&apos;t fall back to browser
        storage while the configuration is incomplete.
      </p>
    </div>
  );
}

export function RemoteErrorView({ message }: { message: string }) {
  return (
    <div className="card" role="alert">
      <h1>Can&apos;t reach your SpecLoop account</h1>
      <p>{message}</p>
      <p className="muted">Nothing was saved to this browser as a substitute. Check your connection, then reload.</p>
      <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  );
}

/** Renders the error/loading view for a non-ready snapshot, or null when ready. */
export function NotReadyView({ snap }: { snap: StoreSnapshot }) {
  if (snap.status === "loading" || snap.status === "signed-out") return <LoadingView />;
  if (snap.status === "error") {
    if (snap.kind === "local-data") return <StoreErrorView message={snap.message} raw={snap.raw} />;
    if (snap.kind === "config") return <ConfigErrorView message={snap.message} />;
    return <RemoteErrorView message={snap.message} />;
  }
  return null;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/**
 * Renders children only once the store is loaded and (by default) the
 * learner has finished onboarding; otherwise shows loading/error views or
 * sends them to /welcome.
 */
export function WithState({
  children,
  requireProfile = true,
}: {
  children: (state: AppState) => ReactNode;
  requireProfile?: boolean;
}) {
  const snap = useStore();
  const router = useRouter();
  const needsWelcome = requireProfile && snap.status === "ready" && !snap.state.profile;
  const signedOut = snap.status === "signed-out";
  useEffect(() => {
    if (signedOut) router.replace(`/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    else if (needsWelcome) router.replace("/welcome");
  }, [needsWelcome, signedOut, router]);

  if (snap.status !== "ready") return <NotReadyView snap={snap} />;
  if (needsWelcome) return <LoadingView label="Opening setup…" />;
  return (
    <>
      {snap.backend === "local" && !snap.persisted && (
        <div className="notice notice-warning" role="status" style={{ marginBottom: "1rem" }}>
          <strong>Your progress isn&apos;t being saved.</strong>
          This browser blocked local storage (private browsing or a storage limit). Your changes will be lost when you
          close the tab. <Link href="/settings#data">Export your data</Link> before leaving.
        </div>
      )}
      {children(snap.state)}
    </>
  );
}
