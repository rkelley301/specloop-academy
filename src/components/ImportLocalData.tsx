"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { getBlobStorage, localBlobStorage } from "@/lib/blob-store";
import { commitImport, newClientId, readLocalState } from "@/lib/store";
import { hasImportableData, mergeImport, planImport, type ImportPlan } from "@/lib/supabase/import-plan";
import { AppStateSchema, type AppState } from "@/lib/types";

const markerKey = (uid: string) => `specloop:imported:${uid}`;

type Phase =
  | { step: "idle"; error: string | null }
  | { step: "review"; plan: ImportPlan; origin: string; previous: string | null }
  | { step: "running"; done: number; total: number }
  | { step: "done"; plan: ImportPlan; failed: string[] }
  | { step: "failed"; message: string };

function readMarker(uid: string): string | null {
  try {
    return window.localStorage.getItem(markerKey(uid));
  } catch {
    return null;
  }
}

export function ImportLocalData({ account, uid }: { account: AppState; uid: string }) {
  const [phase, setPhase] = useState<Phase>({ step: "idle", error: null });
  const [confirmed, setConfirmed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const local = readLocalState();
  const localState = local.ok ? local.state : null;
  const localAvailable = Boolean(localState && hasImportableData(localState));

  const review = (source: AppState, origin: string) => {
    if (!hasImportableData(source)) {
      setPhase({ step: "idle", error: `${origin} has no progress, sources, drafts or audio to import.` });
      return;
    }
    setConfirmed(false);
    setPhase({ step: "review", plan: planImport(source, account, () => newClientId()), origin, previous: readMarker(uid) });
  };

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const parsed = AppStateSchema.safeParse(json?.state ?? json);
      if (!parsed.success) {
        setPhase({ step: "idle", error: "That file isn't a valid SpecLoop export." });
        return;
      }
      review(parsed.data, `The file “${file.name}”`);
    } catch {
      setPhase({ step: "idle", error: "Couldn't read that file as JSON." });
    }
  }

  async function run(plan: ImportPlan) {
    const failed = new Set<string>();
    const failedLabels: string[] = [];
    setPhase({ step: "running", done: 0, total: plan.files.length });
    try {
      // Files first: a row is only written for files that actually copied.
      for (const [i, f] of plan.files.entries()) {
        const blob = await localBlobStorage.get(f.kind, f.localId).catch(() => null);
        if (!blob) {
          failed.add(f.newId);
          failedLabels.push(`${f.label} (not found in this browser)`);
        } else {
          try {
            await getBlobStorage().put(f.kind, f.newId, blob, f.contentType);
          } catch (err) {
            failed.add(f.newId);
            failedLabels.push(`${f.label} (${err instanceof Error ? err.message : "upload failed"})`);
          }
        }
        setPhase({ step: "running", done: i + 1, total: plan.files.length });
      }
      await commitImport(mergeImport(account, plan, failed));
      try {
        window.localStorage.setItem(markerKey(uid), new Date().toISOString());
      } catch {
        /* marker is only a duplicate warning */
      }
      setPhase({ step: "done", plan, failed: failedLabels });
    } catch (err) {
      setPhase({ step: "failed", message: err instanceof Error ? err.message : "Import failed." });
    }
  }

  return (
    <div>
      <h3>Import demo data into this account</h3>
      <p className="small muted">
        Adds progress, sources, drafts, approved lessons and audio from local demo mode. It only adds: nothing already in
        your account is changed or removed, and the local copy stays in this browser.
      </p>

      {phase.step === "idle" && (
        <>
          {phase.error && (
            <p className="error-text" role="alert">
              {phase.error}
            </p>
          )}
          <div className="row">
            <button type="button" className="btn" disabled={!localAvailable} onClick={() => localState && review(localState, "This browser's demo data")}>
              Review this browser&apos;s demo data
            </button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              Review an export file…
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="visually-hidden" tabIndex={-1} aria-label="Export file to import" onChange={onFile} />
          </div>
          {!localAvailable && <p className="small muted mt-1 mb-0">No local demo data found in this browser.</p>}
        </>
      )}

      {phase.step === "review" && (
        <div className="notice">
          <strong>{phase.origin} will add:</strong>
          <ul className="small" style={{ margin: "0.25rem 0 0.5rem", paddingLeft: "1.2rem" }}>
            <li>{phase.plan.summary.sources} sources, {phase.plan.summary.drafts} drafts, {phase.plan.summary.lessons} approved lessons</li>
            <li>
              {phase.plan.summary.attempts} answers, {phase.plan.summary.completions} lesson completions, {phase.plan.summary.reviewItems} review
              schedules ({phase.plan.summary.reviewEvents} history entries)
            </li>
            <li>
              {phase.plan.summary.audio} audio files; {phase.plan.summary.files} files to copy to private storage
            </li>
          </ul>
          {phase.plan.summary.skipped.length > 0 && (
            <>
              <strong className="small">Skipped (your account&apos;s version is kept):</strong>
              <ul className="small" style={{ margin: "0.25rem 0 0.5rem", paddingLeft: "1.2rem" }}>
                {phase.plan.summary.skipped.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </>
          )}
          <p className="small mb-0">Your profile and settings in this account aren&apos;t changed.</p>
          {phase.previous && (
            <p className="small error-text">
              You already imported into this account from this browser on {new Date(phase.previous).toLocaleString()}. Importing again
              adds duplicate sources, drafts and answers.
            </p>
          )}
          <label className="choice mt-1">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span className="small">Add this data to my account.</span>
          </label>
          <div className="row" style={{ marginTop: "0.6rem" }}>
            <button type="button" className="btn btn-primary" disabled={!confirmed} onClick={() => run(phase.plan)}>
              Import into my account
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPhase({ step: "idle", error: null })}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase.step === "running" && (
        <p role="status">
          Importing… {phase.total > 0 && `copied ${phase.done} of ${phase.total} files`}
        </p>
      )}

      {phase.step === "done" && (
        <div className="notice notice-success" role="status">
          <strong>Import complete</strong>
          Added {phase.plan.summary.sources} sources, {phase.plan.summary.drafts} drafts, {phase.plan.summary.lessons} lessons and{" "}
          {phase.plan.summary.attempts} answers.
          {phase.failed.length > 0 && (
            <>
              <p className="small mb-0 mt-1">These files couldn&apos;t be copied, so their records were left out or kept without the file:</p>
              <ul className="small" style={{ margin: 0, paddingLeft: "1.2rem" }}>
                {phase.failed.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </>
          )}
          <p className="small mb-0 mt-1">The local demo copy is still in this browser. You can remove it below.</p>
        </div>
      )}

      {phase.step === "failed" && (
        <div className="notice notice-danger" role="alert">
          <strong>Import stopped</strong>
          {phase.message} Reload to see exactly what your account contains before trying again.
        </div>
      )}
    </div>
  );
}
