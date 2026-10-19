"use client";

import Link from "next/link";
import { IndependenceNote, ReviewStatusBadge } from "@/components/Notes";
import { WithState } from "@/components/StateViews";
import { relativeDay } from "@/lib/dates";
import { SEED_PATH_ID, SEED_RELEASE_GATE } from "@/lib/seed/ccst-level1";
import { isCompleted, lessonProgress, nextLesson, orderedLessons, reviewStatusForLesson, today } from "@/lib/selectors";
import type { AppState, LearningPath } from "@/lib/types";

function PathSection({ state, path }: { state: AppState; path: LearningPath }) {
  const lessons = orderedLessons(state, path.id);
  const done = lessons.filter((l) => isCompleted(state, l.id)).length;
  const next = nextLesson(state);
  const day = today(state);
  return (
    <section className="card" aria-labelledby={`path-${path.id}`}>
      <div className="row-between">
        <h2 id={`path-${path.id}`} className="mb-0">
          {path.title}
        </h2>
        <span className="small muted">
          {done} of {lessons.length} complete
        </span>
      </div>
      <p className="muted small" style={{ marginTop: "0.4rem" }}>
        {path.description}
      </p>
      <div className="progress" role="progressbar" aria-label={`${path.title} progress`} aria-valuemin={0} aria-valuemax={lessons.length} aria-valuenow={done}>
        <span style={{ width: `${lessons.length ? (done / lessons.length) * 100 : 0}%` }} />
      </div>
      <ol className="list" style={{ marginTop: "1rem" }}>
        {lessons.map((l) => {
          const complete = isCompleted(state, l.id);
          const isNext = next?.id === l.id;
          const prog = lessonProgress(state, l.id);
          const rev = reviewStatusForLesson(state, l.id, day);
          const hasAudio = state.audioAssets.some((a) => a.lessonId === l.id);
          return (
            <li key={l.id} className="lesson-row">
              <span className={`lesson-num ${complete ? "done" : isNext ? "next" : ""}`} aria-hidden="true">
                {complete ? "✓" : l.order}
              </span>
              <div>
                <Link href={`/lessons/${l.id}`} className="lesson-title-link">
                  <span className="visually-hidden">Lesson {l.order}: </span>
                  {l.title}
                </Link>
                <div className="meta">
                  <span>{complete ? "Completed" : isNext ? "Up next" : prog.answered ? "In progress" : "Not started"}</span>
                  <span aria-hidden="true">·</span>
                  <span>{l.estMinutes} min</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {prog.answered}/{prog.total} answered
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{hasAudio ? "Audio attached" : "Transcript only"}</span>
                </div>
                <div className="meta">
                  {rev.due > 0 ? (
                    <span className="badge badge-danger">{rev.due} review{rev.due === 1 ? "" : "s"} due</span>
                  ) : rev.next ? (
                    <span className="badge badge-info">Next review {relativeDay(rev.next, day)}</span>
                  ) : prog.answered ? (
                    <span className="badge">No reviews pending</span>
                  ) : null}
                  <ReviewStatusBadge status={l.reviewStatus} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function PathPage() {
  return (
    <WithState>
      {(state) => (
        <>
          <div className="page-head">
            <h1>Learning path</h1>
            <p>Work through lessons in order. Each one ends with recall questions and a field scenario.</p>
          </div>
          <div className="notice notice-warning" style={{ marginBottom: "1rem" }}>
            <strong>Seed course status: draft, technical review required</strong>
            {SEED_RELEASE_GATE}
          </div>
          {state.paths
            .slice()
            .sort((a, b) => (a.id === SEED_PATH_ID ? -1 : b.id === SEED_PATH_ID ? 1 : 0))
            .map((p) => (
              <PathSection key={p.id} state={state} path={p} />
            ))}
          <div className="mt-1">
            <IndependenceNote />
          </div>
        </>
      )}
    </WithState>
  );
}
