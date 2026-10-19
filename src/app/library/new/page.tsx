"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { WithState } from "@/components/StateViews";
import { getBlobStorage } from "@/lib/blob-store";
import { dispatch, newClientId } from "@/lib/store";
import { SOURCE_TYPE_LABELS, SourceType } from "@/lib/types";

const TEXT_MAX_BYTES = 2 * 1024 * 1024;
const PDF_MAX_BYTES = 25 * 1024 * 1024;

function NewSourceForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<SourceType>("own_notes");
  const [citation, setCitation] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileMsg, setFileMsg] = useState<string | null>(null);
  const [rights, setRights] = useState(false);
  const [confidential, setConfidential] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFileMsg(null);
    setFile(null);
    if (!f) return;
    const name = f.name.toLowerCase();
    if (name.endsWith(".pdf") || f.type === "application/pdf") {
      if (f.size > PDF_MAX_BYTES) {
        setFileMsg("That PDF is over 25 MB.");
        return;
      }
      setFile(f);
      setFileMsg(
        "The PDF will be stored privately with this source. This build can't extract text from PDFs, so paste the passages you'll draft from into the text box below.",
      );
      if (!title) setTitle(f.name.replace(/\.pdf$/i, ""));
      return;
    }
    if (name.endsWith(".txt") || name.endsWith(".md") || f.type.startsWith("text/")) {
      if (f.size > TEXT_MAX_BYTES) {
        setFileMsg("That text file is over 2 MB. Paste the relevant excerpt instead.");
        return;
      }
      setText(await f.text());
      setFileMsg(`Loaded text from ${f.name}. Review it below.`);
      if (!title) setTitle(f.name.replace(/\.(txt|md)$/i, ""));
      return;
    }
    setFileMsg("Choose a .txt, .md, or .pdf file.");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Give the source a title.";
    if (!citation.trim()) errs.citation = "Add a citation (author, title, edition, date or document number).";
    if (url && !/^https?:\/\//i.test(url.trim())) errs.url = "Use a full URL starting with http:// or https://.";
    if (!text.trim() && !file) errs.text = "Paste source text or attach a file.";
    if (!rights) errs.rights = "Confirm you have the right to use this material.";
    if (!confidential) errs.confidential = "Confirm the material contains nothing confidential you aren't authorized to share.";
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`ns-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    setSaving(true);
    const id = newClientId();
    let fileMeta;
    if (file) {
      const blobId = newClientId();
      try {
        await getBlobStorage().put("source", blobId, file, "application/pdf");
        fileMeta = { blobId, name: file.name, mimeType: file.type || "application/pdf", sizeBytes: file.size };
      } catch (err) {
        setSaving(false);
        setErrors({ text: err instanceof Error ? err.message : "Couldn't store the file." });
        return;
      }
    }
    dispatch({
      type: "addSource",
      id,
      source: {
        title: title.trim(),
        type,
        citation: citation.trim(),
        url: url.trim() || undefined,
        notes: notes.trim(),
        text,
        file: fileMeta,
        rightsConfirmed: true,
        confidentialityConfirmed: true,
      },
    });
    router.push(`/library/${id}`);
  }

  const err = (k: string) =>
    errors[k] ? (
      <div className="error-text" id={`ns-${k}-err`}>
        {errors[k]}
      </div>
    ) : null;
  const described = (k: string, hint?: string) => (errors[k] ? `ns-${k}-err` : hint);

  return (
    <form onSubmit={submit} noValidate className="card">
      <div className="field">
        <label htmlFor="ns-title">Title</label>
        <input id="ns-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={Boolean(errors.title)} aria-describedby={described("title")} />
        {err("title")}
      </div>
      <div className="field">
        <label htmlFor="ns-type">Type</label>
        <select id="ns-type" value={type} onChange={(e) => setType(e.target.value as SourceType)}>
          {SourceType.options.map((t) => (
            <option key={t} value={t}>
              {SOURCE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="ns-citation">Citation</label>
        <input
          id="ns-citation"
          type="text"
          value={citation}
          placeholder="e.g. Acme 3051 Reference Manual, rev. D, 2024, section 4"
          onChange={(e) => setCitation(e.target.value)}
          aria-invalid={Boolean(errors.citation)}
          aria-describedby={described("citation", "ns-citation-hint")}
        />
        {errors.citation ? err("citation") : <span className="hint" id="ns-citation-hint">Stored with every lesson drafted from this source.</span>}
      </div>
      <div className="field">
        <label htmlFor="ns-url">URL (optional)</label>
        <input id="ns-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} aria-invalid={Boolean(errors.url)} aria-describedby={described("url")} />
        {err("url")}
      </div>
      <div className="field">
        <label htmlFor="ns-file">Upload a file (optional)</label>
        <input id="ns-file" type="file" accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf" onChange={onFile} aria-describedby="ns-file-hint" />
        <span className="hint" id="ns-file-hint">
          Text (.txt, .md) up to 2 MB, or PDF up to 25 MB. Files stay in this browser and aren&apos;t uploaded anywhere.
        </span>
        {fileMsg && (
          <p className="small" role="status" style={{ marginTop: "0.4rem" }}>
            {fileMsg}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="ns-text">Source text or excerpts</label>
        <textarea
          id="ns-text"
          value={text}
          rows={8}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={Boolean(errors.text)}
          aria-describedby={described("text", "ns-text-hint")}
        />
        {errors.text ? (
          err("text")
        ) : (
          <span className="hint" id="ns-text-hint">
            Paste only what you need to draft from. Lessons should summarize in original wording, not reproduce long passages.
          </span>
        )}
      </div>
      <div className="field">
        <label htmlFor="ns-notes">Notes (optional)</label>
        <textarea id="ns-notes" value={notes} rows={3} style={{ minHeight: 80 }} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <fieldset>
        <legend>Before you save</legend>
        <label className="choice">
          <input id="ns-rights" type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} aria-invalid={Boolean(errors.rights)} aria-describedby={described("rights")} />
          <span>I have the right to use this material for my own study, such as my own notes, licensed material, or a public document.</span>
        </label>
        {err("rights")}
        <label className="choice">
          <input
            id="ns-confidential"
            type="checkbox"
            checked={confidential}
            onChange={(e) => setConfidential(e.target.checked)}
            aria-invalid={Boolean(errors.confidential)}
            aria-describedby={described("confidential")}
          />
          <span>It contains no confidential material, such as company procedures, drawings, or customer data, that I&apos;m not authorized to share.</span>
        </label>
        {err("confidential")}
      </fieldset>

      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save source"}
        </button>
        <Link href="/library" className="btn btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}

export default function NewSourcePage() {
  return (
    <WithState>
      {() => (
        <>
          <nav aria-label="Breadcrumb" className="small" style={{ marginBottom: "0.5rem" }}>
            <Link href="/library">Library</Link> <span aria-hidden="true">/</span> New source
          </nav>
          <div className="page-head">
            <h1>Add a source</h1>
            <p>Sources are the evidence behind your lessons. Every draft keeps a citation back to this record.</p>
          </div>
          <NewSourceForm />
        </>
      )}
    </WithState>
  );
}
