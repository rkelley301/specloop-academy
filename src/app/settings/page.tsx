"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import { ProfileForm } from "@/components/ProfileForm";
import { WithState } from "@/components/StateViews";
import { useToast } from "@/components/Toast";
import { blobStorage } from "@/lib/blob-store";
import { clearStoredState, dispatch } from "@/lib/store";
import { AppStateSchema, type AppState } from "@/lib/types";
import { useServerConfig } from "@/lib/use-config";

function exportData(state: AppState) {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: "SpecLoop Academy",
    note: "Local demo export. Audio and uploaded PDF files aren't included; their metadata is.",
    state,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `specloop-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function SettingsView({ state }: { state: AppState }) {
  const router = useRouter();
  const toast = useToast();
  const cfg = useServerConfig();
  const importRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function onImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const parsed = AppStateSchema.safeParse(json?.state ?? json);
      if (!parsed.success) {
        setImportError("That file isn't a valid SpecLoop export.");
        return;
      }
      if (!window.confirm("Replace all current data on this device with the imported file?")) return;
      dispatch({ type: "replaceState", state: parsed.data });
      setImportError(null);
      toast.show("Data imported. Audio files must be re-uploaded.");
    } catch {
      setImportError("Couldn't read that file as JSON.");
    }
  }

  async function deleteAll() {
    if (!window.confirm("Delete all SpecLoop data in this browser: profile, progress, sources, drafts and audio? This can't be undone.")) return;
    await blobStorage.clear().catch(() => undefined);
    clearStoredState();
    router.replace("/welcome");
  }

  return (
    <>
      <div className="page-head">
        <h1>Settings</h1>
        <p>Your profile, preferences, and data.</p>
      </div>

      <section className="card" aria-labelledby="prof-h">
        <h2 id="prof-h">Profile &amp; goal</h2>
        <ProfileForm
          initial={state.profile}
          submitLabel="Save profile"
          showTimezone
          onSubmit={(profile) => {
            dispatch({ type: "saveProfile", profile });
            toast.show("Profile saved.");
          }}
        />
      </section>

      <section className="card" aria-labelledby="pref-h">
        <h2 id="pref-h">Preferences</h2>
        <fieldset>
          <legend>Review reminders</legend>
          <label className="choice">
            <input
              type="radio"
              name="notif"
              checked={state.settings.notifications === "in_app"}
              onChange={() => dispatch({ type: "updateSettings", settings: { notifications: "in_app" } })}
            />
            <span>
              In-app badge
              <span className="hint">Shows a count on Review when items are due. No email or push notifications are sent.</span>
            </span>
          </label>
          <label className="choice">
            <input
              type="radio"
              name="notif"
              checked={state.settings.notifications === "off"}
              onChange={() => dispatch({ type: "updateSettings", settings: { notifications: "off" } })}
            />
            <span>Off</span>
          </label>
        </fieldset>
        <div className="field" style={{ maxWidth: 240 }}>
          <label htmlFor="rate">Default playback speed</label>
          <select
            id="rate"
            value={state.settings.playbackRate}
            onChange={(e) => dispatch({ type: "updateSettings", settings: { playbackRate: Number(e.target.value) } })}
          >
            {[0.75, 1, 1.25, 1.5].map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="card" aria-labelledby="acct-h">
        <h2 id="acct-h">Account &amp; integrations</h2>
        <table className="simple">
          <tbody>
            <tr>
              <th scope="row">Sign-in</th>
              <td>Local demo mode. No account; data stays in this browser. Not secure multi-user auth.</td>
            </tr>
            <tr>
              <th scope="row">Plan</th>
              <td>{cfg.status === "ready" ? cfg.config.billing.message : "Local demo (free). Payments aren't enabled."}</td>
            </tr>
            <tr>
              <th scope="row">AI drafting</th>
              <td>
                {cfg.status === "loading"
                  ? "Checking…"
                  : cfg.status === "ready" && cfg.config.ai.enabled
                    ? `Configured (Anthropic, ${cfg.config.ai.model}). Text is sent only when you choose "Draft with AI" and confirm.`
                    : "Not configured. Template drafts only."}
              </td>
            </tr>
            <tr>
              <th scope="row">OneStudio</th>
              <td>Manual upload workflow. Direct generation isn&apos;t configured.</td>
            </tr>
            <tr>
              <th scope="row">Hosted backend</th>
              <td>
                {cfg.status === "ready" && cfg.config.supabase.configured
                  ? "Supabase variables are set, but this release doesn't use them yet. Data stays local."
                  : "Not configured. Data stays local."}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="card" aria-labelledby="data-h" id="data">
        <h2 id="data-h">Your data</h2>
        <p className="small muted">
          Everything is stored in this browser: {Object.keys(state.lessons).length} lessons, {state.attempts.length} answers,{" "}
          {state.reviewItems.length} review items, {state.sources.length} sources, {state.drafts.length} drafts,{" "}
          {state.audioAssets.length} audio files.
        </p>
        <div className="row">
          <button type="button" className="btn" onClick={() => exportData(state)}>
            Export data (JSON)
          </button>
          <button type="button" className="btn" onClick={() => importRef.current?.click()}>
            Import export file
          </button>
          <input ref={importRef} type="file" accept="application/json,.json" className="visually-hidden" onChange={onImport} aria-label="Import export file" tabIndex={-1} />
        </div>
        {importError && (
          <p className="error-text" role="alert">
            {importError}
          </p>
        )}
        <hr />
        <h3>Delete all data</h3>
        <p className="small muted">Removes your profile, progress, sources, drafts and audio from this browser, then starts setup again.</p>
        <button type="button" className="btn btn-danger" onClick={deleteAll}>
          Delete all my data
        </button>
      </section>
      {toast.node}
    </>
  );
}

export default function SettingsPage() {
  return <WithState>{(state) => <SettingsView state={state} />}</WithState>;
}
