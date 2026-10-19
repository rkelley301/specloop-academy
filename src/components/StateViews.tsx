"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { AppState } from "@/lib/types";
import { clearStoredState, useStore } from "@/lib/store";

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
  useEffect(() => {
    if (needsWelcome) router.replace("/welcome");
  }, [needsWelcome, router]);

  if (snap.status === "loading") return <LoadingView />;
  if (snap.status === "error") return <StoreErrorView message={snap.message} raw={snap.raw} />;
  if (needsWelcome) return <LoadingView label="Opening setup…" />;
  return (
    <>
      {!snap.persisted && (
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
