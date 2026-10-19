"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ReviewStatusBadge, SafetyNote } from "@/components/Notes";
import { EmptyState, WithState } from "@/components/StateViews";
import { Transcript } from "@/components/Transcript";
import { useToast } from "@/components/Toast";
import { countPauses, wordCount } from "@/lib/script";
import { dispatch, newClientId } from "@/lib/store";
import type { AppState, Draft, Question } from "@/lib/types";

type Form = Pick<Draft, "title" | "objective" | "estMinutes" | "script" | "questions" | "scenario" | "uncertainties" | "concepts">;

function toForm(d: Draft): Form {
  return {
    title: d.title,
    objective: d.objective,
    estMinutes: d.estMinutes,
    script: d.script,
    questions: d.questions,
    scenario: d.scenario,
    uncertainties: d.uncertainties,
    concepts: d.concepts,
  };
}

function problems(f: Form): string[] {
  const out: string[] = [];
  if (!f.title.trim()) out.push("Add a title.");
  if (!f.objective.trim()) out.push("Add an objective.");
  if (!f.script.trim()) out.push("Write the narration script.");
  if (f.questions.length === 0) out.push("Add at least one recall question.");
  f.questions.forEach((q, i) => {
    if (!q.prompt.trim() || !q.answerKey.trim()) out.push(`Recall question ${i + 1} needs a prompt and an answer key.`);
  });
  if (!f.scenario.prompt.trim() || !f.scenario.answerKey.trim()) out.push("The scenario needs a prompt and an answer key.");
  const all = [f.title, f.objective, f.script, f.scenario.prompt, f.scenario.answerKey, ...f.questions.flatMap((q) => [q.prompt, q.answerKey])].join("\n");
  if (/\[EDIT\]/.test(all)) out.push("Replace every [EDIT] placeholder.");
  return out;
}

function DraftEditor({ state, draft }: { state: AppState; draft: Draft }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => toForm(draft));
  const [reviewer, setReviewer] = useState(draft.reviewerName ?? state.profile?.displayName ?? "");
  const [notes, setNotes] = useState(draft.reviewNotes);
  const [checks, setChecks] = useState({ accuracy: false, copyright: false, safety: false });
  const [preview, setPreview] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(draft));
  const issues = problems(form);
  const verifyCount = (form.script.match(/\[VERIFY\]/g) ?? []).length;
  const canApprove = !dirty && issues.length === 0 && reviewer.trim() && checks.accuracy && checks.copyright && checks.safety;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setQ = (i: number, patch: Partial<Question>) => set("questions", form.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const addQ = () => {
    const cid = newClientId();
    setForm((f) => ({
      ...f,
      concepts: [...f.concepts, { id: cid, label: `Recall ${f.questions.length + 1}` }],
      questions: [...f.questions, { id: newClientId(), prompt: "", answerKey: "", conceptId: cid }],
    }));
  };

  const save = () => {
    const clean = { ...form, uncertainties: form.uncertainties.map((u) => u.trim()).filter(Boolean) };
    setForm(clean);
    dispatch({ type: "updateDraft", id: draft.id, patch: clean });
    toast.show(draft.reviewStatus === "approved" ? "Saved. The edit sent this draft back to Draft status." : "Draft saved.");
  };

  return (
    <>
      <nav aria-label="Breadcrumb" className="small" style={{ marginBottom: "0.5rem" }}>
        <Link href="/library">Library</Link> <span aria-hidden="true">/</span> Draft
      </nav>
      <div className="page-head">
        <div className="row" style={{ marginBottom: "0.35rem" }}>
          <ReviewStatusBadge status={draft.reviewStatus} />
          <span className="small muted">
            {draft.generatedBy === "ai" ? `AI-generated (${draft.aiModel})` : draft.generatedBy === "template" ? "Template draft" : "Manual draft"} ·
            created {new Date(draft.generatedAt).toLocaleString()}
          </span>
        </div>
        <h1>{form.title || "Untitled draft"}</h1>
      </div>

      <section className="card" aria-labelledby="attr-h">
        <h2 id="attr-h">Source attribution</h2>
        {draft.attributions.length === 0 ? (
          <p className="small muted mb-0">No source attached. Lessons without a source are your own original content and should say so in the script.</p>
        ) : (
          <ul className="list small">
            {draft.attributions.map((a, i) => (
              <li key={i}>
                {a.sourceId && state.sources.some((s) => s.id === a.sourceId) ? (
                  <Link href={`/library/${a.sourceId}`}>
                    <strong>{a.title}</strong>
                  </Link>
                ) : (
                  <strong>{a.title}</strong>
                )}
                <div className="muted">{a.citation}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {draft.publishedLessonId && state.lessons[draft.publishedLessonId] && (
        <div className="notice notice-success mt-1">
          <strong>Published</strong>
          Approved by {draft.reviewerName} on {draft.reviewedAt ? new Date(draft.reviewedAt).toLocaleDateString() : "?"}.{" "}
          <Link href={`/lessons/${draft.publishedLessonId}`}>Open the lesson</Link>
          {draft.reviewStatus !== "approved" && " (this draft has edits since, so re-approve to update the lesson)"}.
        </div>
      )}

      <section className="card" aria-labelledby="ed-h">
        <div className="row-between">
          <h2 id="ed-h" className="mb-0">
            Lesson content
          </h2>
          <button type="button" className="btn btn-sm" aria-pressed={preview} onClick={() => setPreview(!preview)}>
            {preview ? "Edit script" : "Preview transcript"}
          </button>
        </div>
        <div className="field mt-1">
          <label htmlFor="d-title">Title</label>
          <input id="d-title" type="text" value={form.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="d-obj">Objective</label>
          <textarea id="d-obj" rows={2} style={{ minHeight: 70 }} value={form.objective} onChange={(e) => set("objective", e.target.value)} />
        </div>
        <div className="field" style={{ maxWidth: 200 }}>
          <label htmlFor="d-min">Estimated minutes</label>
          <input id="d-min" type="number" min={1} max={60} value={form.estMinutes} onChange={(e) => set("estMinutes", Math.max(1, Number(e.target.value) || 1))} />
        </div>
        <div className="field">
          <label htmlFor="d-script">Narration script</label>
          {preview ? (
            <div className="card" style={{ background: "var(--surface-2)" }}>
              <Transcript script={form.script} />
            </div>
          ) : (
            <textarea id="d-script" className="script-editor" value={form.script} onChange={(e) => set("script", e.target.value)} aria-describedby="d-script-hint" />
          )}
          <span className="hint" id="d-script-hint">
            {wordCount(form.script)} words · {countPauses(form.script)} pause cues. Add pauses as <code>[PAUSE 3 SECONDS]</code> or{" "}
            <code>[PAUSE 5s: recall prompt]</code>.
            {verifyCount > 0 && ` ${verifyCount} [VERIFY] marker${verifyCount === 1 ? "" : "s"} still in the script.`}
          </span>
        </div>
      </section>

      <section className="card" aria-labelledby="q-h">
        <h2 id="q-h">Recall questions</h2>
        {form.questions.map((q, i) => (
          <fieldset key={q.id} className="question">
            <legend>Question {i + 1}</legend>
            <div className="field">
              <label htmlFor={`q-${q.id}-p`}>Prompt</label>
              <textarea id={`q-${q.id}-p`} rows={2} style={{ minHeight: 70 }} value={q.prompt} onChange={(e) => setQ(i, { prompt: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor={`q-${q.id}-a`}>Answer key</label>
              <textarea id={`q-${q.id}-a`} rows={2} style={{ minHeight: 70 }} value={q.answerKey} onChange={(e) => setQ(i, { answerKey: e.target.value })} />
            </div>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              disabled={form.questions.length <= 1}
              onClick={() => set("questions", form.questions.filter((_, j) => j !== i))}
            >
              Remove question {i + 1}
            </button>
          </fieldset>
        ))}
        <button type="button" className="btn btn-sm mt-1" onClick={addQ} disabled={form.questions.length >= 6}>
          Add question
        </button>
      </section>

      <section className="card" aria-labelledby="s-h">
        <h2 id="s-h">Applied scenario</h2>
        <div className="field">
          <label htmlFor="s-p">Scenario prompt</label>
          <textarea id="s-p" rows={3} value={form.scenario.prompt} onChange={(e) => set("scenario", { ...form.scenario, prompt: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="s-a">Answer key (key points a good answer covers)</label>
          <textarea id="s-a" rows={3} value={form.scenario.answerKey} onChange={(e) => set("scenario", { ...form.scenario, answerKey: e.target.value })} />
        </div>
      </section>

      <section className="card" aria-labelledby="u-h">
        <h2 id="u-h">Uncertainties to verify</h2>
        <label htmlFor="u-list" className="small muted">
          One per line. These are published with the lesson&apos;s source note.
        </label>
        <textarea
          id="u-list"
          rows={3}
          value={form.uncertainties.join("\n")}
          onChange={(e) => set("uncertainties", e.target.value.split("\n"))}
        />
      </section>

      <div className="row mt-1">
        <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty}>
          {dirty ? "Save draft" : "Saved"}
        </button>
        {dirty && (
          <button type="button" className="btn btn-ghost" onClick={() => setForm(toForm(draft))}>
            Discard changes
          </button>
        )}
      </div>

      <section className="card mt-1" aria-labelledby="rv-h">
        <h2 id="rv-h">Technical review</h2>
        <p className="small muted">
          Status: <ReviewStatusBadge status={draft.reviewStatus} />
          {draft.reviewedAt && ` · last updated ${new Date(draft.reviewedAt).toLocaleString()}`}
          {draft.reviewerName && ` by ${draft.reviewerName}`}
        </p>
        {issues.length > 0 && (
          <div className="notice notice-warning small" style={{ marginBottom: "0.75rem" }}>
            <strong>Not ready for approval</strong>
            <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
              {issues.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {dirty && <p className="small error-text">Save your changes before changing the review status.</p>}
        <div className="field">
          <label htmlFor="rv-name">Reviewer name</label>
          <input id="rv-name" type="text" value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="rv-notes">Review notes</label>
          <textarea id="rv-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 80 }} />
        </div>
        <div className="row">
          <button
            type="button"
            className="btn"
            disabled={dirty || draft.reviewStatus === "in_review"}
            onClick={() => {
              dispatch({ type: "setDraftStatus", id: draft.id, status: "in_review", notes, reviewerName: reviewer || undefined });
              toast.show("Marked as in review.");
            }}
          >
            Mark in review
          </button>
          <button
            type="button"
            className="btn btn-bad"
            disabled={dirty || !notes.trim()}
            title={!notes.trim() ? "Add review notes describing the changes needed" : undefined}
            onClick={() => {
              dispatch({ type: "setDraftStatus", id: draft.id, status: "changes_requested", notes, reviewerName: reviewer || undefined });
              toast.show("Changes requested.");
            }}
          >
            Request changes
          </button>
        </div>

        <fieldset className="mt-1">
          <legend>Approval checklist</legend>
          <label className="choice">
            <input type="checkbox" checked={checks.accuracy} onChange={(e) => setChecks({ ...checks, accuracy: e.target.checked })} />
            <span className="small">I checked the technical statements, formulas and answer keys against the cited sources, and resolved or listed every [VERIFY] item.</span>
          </label>
          <label className="choice">
            <input type="checkbox" checked={checks.copyright} onChange={(e) => setChecks({ ...checks, copyright: e.target.checked })} />
            <span className="small">It summarizes in original wording and contains no long copyrighted passages, exam questions, or confidential procedures.</span>
          </label>
          <label className="choice">
            <input type="checkbox" checked={checks.safety} onChange={(e) => setChecks({ ...checks, safety: e.target.checked })} />
            <span className="small">It doesn&apos;t authorize live work, and its safety language fits the audience.</span>
          </label>
        </fieldset>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canApprove}
          onClick={() => {
            if (notes !== draft.reviewNotes) dispatch({ type: "setDraftStatus", id: draft.id, status: "in_review", notes, reviewerName: reviewer });
            dispatch({ type: "publishDraft", id: draft.id, reviewerName: reviewer.trim() });
            setChecks({ accuracy: false, copyright: false, safety: false });
            toast.show("Approved and published to “My approved lessons.”");
          }}
        >
          Approve &amp; publish lesson
        </button>
      </section>

      <div className="mt-1">
        <SafetyNote />
      </div>
      <div className="mt-1">
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            if (window.confirm("Delete this draft? A lesson already published from it stays in your path.")) {
              dispatch({ type: "deleteDraft", id: draft.id });
              router.push("/library");
            }
          }}
        >
          Delete draft
        </button>
      </div>
      {toast.node}
    </>
  );
}

export default function DraftPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params?.id ?? "");
  return (
    <WithState>
      {(state) => {
        const draft = state.drafts.find((d) => d.id === id);
        if (!draft)
          return (
            <div className="card">
              <EmptyState title="Draft not found" action={<Link href="/library" className="btn">Back to Library</Link>} />
            </div>
          );
        return <DraftEditor key={draft.id} state={state} draft={draft} />;
      }}
    </WithState>
  );
}
