"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ReviewStatusBadge } from "@/components/Notes";
import { EmptyState, WithState } from "@/components/StateViews";
import { blankDraft, draftFromGenerated, templateDraft } from "@/lib/ai/draft-builders";
import type { DraftRefusal } from "@/lib/ai/interpret";
import { AI_MAX_SOURCE_CHARS } from "@/lib/ai/prompt";
import { getBlobStorage } from "@/lib/blob-store";
import { dispatch, newClientId } from "@/lib/store";
import { SOURCE_TYPE_LABELS, type AppState, type GeneratedDraft, type Source } from "@/lib/types";
import { useServerConfig } from "@/lib/use-config";

function AiDraftPanel({ state, source, onCreated }: { state: AppState; source: Source; onCreated: (id: string) => void }) {
  const cfg = useServerConfig();
  const [open, setOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<DraftRefusal | null>(null);

  if (cfg.status === "loading") return <p className="small muted">Checking AI configuration…</p>;
  if (cfg.status === "error" || !cfg.config.ai.enabled) {
    return (
      <div className="notice small">
        <strong>AI drafting isn&apos;t configured</strong>
        Use the template or a blank draft. To enable AI drafting, set <code>AI_PROVIDER=anthropic</code> and{" "}
        <code>ANTHROPIC_API_KEY</code> in <code>.env.local</code>. See the README.
      </div>
    );
  }
  const tooShort = source.text.trim().length < 50;
  const tooLong = source.text.length > AI_MAX_SOURCE_CHARS;

  async function run() {
    setBusy(true);
    setError(null);
    setRefusal(null);
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          consent: true,
          sourceTitle: source.title,
          citation: source.citation,
          sourceType: SOURCE_TYPE_LABELS[source.type],
          learnerGoal: state.profile?.goal ?? "",
          text: source.text,
        }),
      });
      const body = (await res.json()) as { draft?: GeneratedDraft; model?: string; error?: string; refusal?: DraftRefusal };
      if (body.refusal) {
        setRefusal(body.refusal);
        return;
      }
      if (!res.ok || !body.draft) throw new Error(body.error ?? `Request failed (${res.status}).`);
      const id = newClientId();
      dispatch({ type: "createDraft", id, draft: draftFromGenerated(body.draft, source, body.model ?? "unknown", new Date().toISOString(), newClientId) });
      onCreated(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI drafting failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <button type="button" className="btn" onClick={() => setOpen(true)} disabled={tooShort}>
        Draft with AI…
      </button>
    );
  return (
    <div className="notice notice-warning">
      <strong>Send this source to an external AI provider?</strong>
      <p className="small">
        Clicking the button below sends this source&apos;s text ({source.text.length.toLocaleString()} characters), title
        and citation to Anthropic (model <code>{cfg.config.ai.model}</code>) to generate a draft. Nothing is sent until
        you click it. The result is an unapproved draft with [VERIFY] markers that a qualified person must review.
      </p>
      {tooLong && (
        <p className="small error-text">
          This text is over {AI_MAX_SOURCE_CHARS.toLocaleString()} characters. Edit the source down to the relevant excerpt first.
        </p>
      )}
      <label className="choice">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span className="small">I understand the text will be processed by an external provider, and it contains nothing confidential.</span>
      </label>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {refusal && (
        <div className="notice notice-danger small" role="alert" style={{ marginTop: "0.6rem" }}>
          <strong>The AI model declined this request</strong>
          <p>
            {refusal.explanation ?? "No explanation was given."}
            {refusal.category && (
              <>
                {" "}
                (category: <code>{refusal.category}</code>, model: <code>{refusal.model}</code>)
              </>
            )}
          </p>
          <p className="mb-0">
            SpecLoop doesn&apos;t resend declined requests to a different model. Start from the template and write the
            draft yourself, or edit the source text if it contains material that shouldn&apos;t be here.
          </p>
        </div>
      )}
      <div className="row" style={{ marginTop: "0.6rem" }}>
        <button type="button" className="btn btn-primary" disabled={!consent || busy || tooLong || Boolean(refusal)} onClick={run}>
          {busy ? "Generating draft…" : "Send and generate draft"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function SourceView({ state, source }: { state: AppState; source: Source }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(source.text);
  const [notes, setNotes] = useState(source.notes);
  const drafts = state.drafts.filter((d) => d.sourceIds.includes(source.id));
  const now = () => new Date().toISOString();

  const create = (kind: "template" | "blank") => {
    const id = newClientId();
    const draft =
      kind === "template"
        ? templateDraft(source, now(), newClientId)
        : { ...blankDraft(now(), newClientId), sourceIds: [source.id], attributions: [{ sourceId: source.id, title: source.title, citation: source.citation, url: source.url }] };
    dispatch({ type: "createDraft", id, draft });
    router.push(`/drafts/${id}`);
  };

  const openFile = async () => {
    if (!source.file) return;
    const blob = await getBlobStorage().get("source", source.file.blobId);
    if (!blob) {
      window.alert("The file isn't in this browser's storage any more.");
      return;
    }
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const remove = async () => {
    if (!window.confirm(`Delete “${source.title}”? Drafts made from it keep their citation.`)) return;
    if (source.file) await getBlobStorage().remove("source", source.file.blobId).catch(() => undefined);
    dispatch({ type: "deleteSource", id: source.id });
    router.push("/library");
  };

  return (
    <>
      <nav aria-label="Breadcrumb" className="small" style={{ marginBottom: "0.5rem" }}>
        <Link href="/library">Library</Link> <span aria-hidden="true">/</span> Source
      </nav>
      <div className="page-head">
        <div className="eyebrow">{SOURCE_TYPE_LABELS[source.type]}</div>
        <h1>{source.title}</h1>
        <p>{source.citation}</p>
        {source.url && (
          <a href={source.url} target="_blank" rel="noreferrer noopener" className="small">
            {source.url}
          </a>
        )}
      </div>

      <section className="card card-accent" aria-labelledby="mk-h">
        <h2 id="mk-h">Create a lesson draft</h2>
        <p className="small muted">
          Drafts stay unapproved until a reviewer approves them. Every draft keeps this source&apos;s citation.
        </p>
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={() => create("template")}>
            Start from template
          </button>
          <button type="button" className="btn" onClick={() => create("blank")}>
            Blank draft
          </button>
        </div>
        <div style={{ marginTop: "0.75rem" }}>
          <AiDraftPanel key={source.updatedAt} state={state} source={source} onCreated={(id) => router.push(`/drafts/${id}`)} />
        </div>
      </section>

      <section className="card" aria-labelledby="dr-h">
        <h2 id="dr-h">Drafts from this source</h2>
        {drafts.length === 0 ? (
          <p className="muted small mb-0">None yet.</p>
        ) : (
          <ul className="list">
            {drafts.map((d) => (
              <li key={d.id} className="row-between">
                <Link href={`/drafts/${d.id}`}>{d.title}</Link>
                <ReviewStatusBadge status={d.reviewStatus} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="ct-h">
        <div className="row-between">
          <h2 id="ct-h" className="mb-0">
            Source content
          </h2>
          {!editing && (
            <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>
              Edit text &amp; notes
            </button>
          )}
        </div>
        <p className="small muted">Private to this browser. Not logged or sent anywhere unless you choose AI drafting.</p>
        {source.file && (
          <p className="small">
            Attached file: <strong>{source.file.name}</strong> ({(source.file.sizeBytes / 1024).toFixed(0)} KB){" "}
            <button type="button" className="btn btn-sm" onClick={openFile}>
              Open file
            </button>
          </p>
        )}
        {editing ? (
          <>
            <div className="field">
              <label htmlFor="sv-text">Source text</label>
              <textarea id="sv-text" rows={10} value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="sv-notes">Notes</label>
              <textarea id="sv-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 80 }} />
            </div>
            <div className="row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  dispatch({ type: "updateSource", id: source.id, patch: { text, notes } });
                  setEditing(false);
                }}
              >
                Save
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setText(source.text);
                  setNotes(source.notes);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            {source.text ? (
              <details>
                <summary>Show text ({source.text.length.toLocaleString()} characters)</summary>
                <pre className="plain small">{source.text}</pre>
              </details>
            ) : (
              <p className="muted small">No text yet. Paste the excerpts you want to draft from.</p>
            )}
            {source.notes && (
              <>
                <h3 className="mt-1">Notes</h3>
                <p className="prewrap small">{source.notes}</p>
              </>
            )}
          </>
        )}
        <p className="small muted mt-1 mb-0">
          Rights and confidentiality confirmed when added on {new Date(source.createdAt).toLocaleDateString()}.
        </p>
      </section>

      <div className="mt-1">
        <button type="button" className="btn btn-danger" onClick={remove}>
          Delete source
        </button>
      </div>
    </>
  );
}

export default function SourcePage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params?.id ?? "");
  return (
    <WithState>
      {(state) => {
        const source = state.sources.find((s) => s.id === id);
        if (!source)
          return (
            <div className="card">
              <EmptyState title="Source not found" action={<Link href="/library" className="btn">Back to Library</Link>} />
            </div>
          );
        return <SourceView key={source.id} state={state} source={source} />;
      }}
    </WithState>
  );
}
