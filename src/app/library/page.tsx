"use client";

import Link from "next/link";
import { ReviewStatusBadge } from "@/components/Notes";
import { EmptyState, WithState } from "@/components/StateViews";
import { SOURCE_TYPE_LABELS } from "@/lib/types";

export default function LibraryPage() {
  return (
    <WithState>
      {(state) => {
        const drafts = state.drafts.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        const sources = state.sources.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return (
          <>
            <div className="page-head row-between">
              <div>
                <h1>Library</h1>
                <p>Add sources you&apos;re allowed to use, then turn them into lesson drafts for review.</p>
              </div>
              <Link href="/library/new" className="btn btn-primary">
                Add a source
              </Link>
            </div>

            <section className="card" aria-labelledby="src-h">
              <h2 id="src-h">Sources ({sources.length})</h2>
              {sources.length === 0 ? (
                <EmptyState
                  title="No sources yet"
                  action={
                    <Link href="/library/new" className="btn">
                      Add your first source
                    </Link>
                  }
                >
                  Your own notes, a manual you have rights to use, or a public reference. Uploads stay private in this
                  browser.
                </EmptyState>
              ) : (
                <ul className="list">
                  {sources.map((s) => {
                    const n = state.drafts.filter((d) => d.sourceIds.includes(s.id)).length;
                    return (
                      <li key={s.id}>
                        <Link href={`/library/${s.id}`} className="lesson-title-link">
                          {s.title}
                        </Link>
                        <div className="meta">
                          <span>{SOURCE_TYPE_LABELS[s.type]}</span>
                          <span aria-hidden="true">·</span>
                          <span>{n} draft{n === 1 ? "" : "s"}</span>
                          {s.file && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{s.file.name}</span>
                            </>
                          )}
                        </div>
                        <div className="small muted">{s.citation}</div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="card" aria-labelledby="drf-h">
              <h2 id="drf-h">Lesson drafts ({drafts.length})</h2>
              {drafts.length === 0 ? (
                <EmptyState title="No drafts yet">Open a source and choose “Create lesson draft.”</EmptyState>
              ) : (
                <ul className="list">
                  {drafts.map((d) => (
                    <li key={d.id}>
                      <Link href={`/drafts/${d.id}`} className="lesson-title-link">
                        {d.title || "Untitled draft"}
                      </Link>
                      <div className="meta">
                        <ReviewStatusBadge status={d.reviewStatus} />
                        <span>
                          {d.generatedBy === "ai" ? `AI draft (${d.aiModel})` : d.generatedBy === "template" ? "Template draft" : "Manual draft"}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Created {new Date(d.generatedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="small muted">
                        Source: {d.attributions.map((a) => a.title).join("; ") || "none"}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <h2>Audio studio</h2>
              <p className="muted small">Copy narration scripts, then upload OneStudio audio for each lesson.</p>
              <Link href="/audio" className="btn">
                Open Audio studio
              </Link>
            </section>
          </>
        );
      }}
    </WithState>
  );
}
