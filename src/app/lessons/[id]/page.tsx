"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AudioPlayer } from "@/components/AudioPlayer";
import { ReviewStatusBadge, SafetyNote } from "@/components/Notes";
import { QuestionCard } from "@/components/QuestionCard";
import { EmptyState, WithState } from "@/components/StateViews";
import { Transcript } from "@/components/Transcript";
import { useToast } from "@/components/Toast";
import { formatLocalDate, relativeDay } from "@/lib/dates";
import { isCompleted, lessonProgress, orderedLessons, today } from "@/lib/selectors";
import { scheduleInitial } from "@/lib/scheduler";
import { dispatch } from "@/lib/store";
import type { AppState, Lesson, Result } from "@/lib/types";

function latestLessonAttempt(state: AppState, questionId: string) {
  for (let i = state.attempts.length - 1; i >= 0; i--) {
    const a = state.attempts[i];
    if (a.questionId === questionId && a.context === "lesson") return a;
  }
  return null;
}

function LessonView({ state, lesson }: { state: AppState; lesson: Lesson }) {
  const toast = useToast();
  const asset = state.audioAssets.find((a) => a.lessonId === lesson.id);
  const complete = isCompleted(state, lesson.id);
  const prog = lessonProgress(state, lesson.id);
  const siblings = orderedLessons(state, lesson.pathId);
  const idx = siblings.findIndex((l) => l.id === lesson.id);
  const next = siblings[idx + 1];
  const prev = siblings[idx - 1];

  const grade = (questionId: string, kind: "recall" | "scenario") => (response: string, result: Result) => {
    dispatch({ type: "answerQuestion", lessonId: lesson.id, questionId, kind, context: "lesson", response, result });
    // Lesson answers always start a fresh schedule (same rule the reducer applies).
    const day = today(state);
    const { dueDate } = scheduleInitial(result, day);
    return `Recorded: ${result === "correct" ? "got it" : "missed"}. Review ${dueDate ? `${relativeDay(dueDate, day)} (${formatLocalDate(dueDate)})` : "not scheduled"}.`;
  };

  return (
    <article>
      <nav aria-label="Breadcrumb" className="small" style={{ marginBottom: "0.5rem" }}>
        <Link href="/path">Learning path</Link> <span aria-hidden="true">/</span> Lesson {lesson.order}
      </nav>
      <header className="page-head">
        <div className="row" style={{ marginBottom: "0.35rem" }}>
          <ReviewStatusBadge status={lesson.reviewStatus} />
          {complete && <span className="badge badge-success">Completed</span>}
          <span className="small muted">About {lesson.estMinutes} min</span>
        </div>
        <h1>{lesson.title}</h1>
      </header>

      <section className="card card-accent" aria-labelledby="obj-h">
        <h2 id="obj-h" className="eyebrow" style={{ fontSize: "0.78rem" }}>
          Objective
        </h2>
        <p className="mb-0">{lesson.objective}</p>
      </section>

      <section className="card" aria-labelledby="listen-h">
        <h2 id="listen-h">1 · Listen</h2>
        <AudioPlayer lesson={lesson} asset={asset} playbackRate={state.settings.playbackRate} />
        <details open={!asset} style={{ marginTop: "1rem" }}>
          <summary>Transcript {asset ? "" : "(read this lesson here)"}</summary>
          <Transcript script={lesson.script} />
        </details>
      </section>

      <section className="card" aria-labelledby="recall-h">
        <h2 id="recall-h">2 · Recall</h2>
        <p className="muted small">
          Answer from memory, then check the key and grade yourself. Each result sets that question&apos;s review date.
        </p>
        {lesson.questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            label={`Recall question ${i + 1} of ${lesson.questions.length}`}
            prompt={q.prompt}
            answerKey={q.answerKey}
            kind="recall"
            previous={latestLessonAttempt(state, q.id)}
            onGrade={grade(q.id, "recall")}
          />
        ))}
      </section>

      <section className="card" aria-labelledby="apply-h">
        <h2 id="apply-h">3 · Apply</h2>
        <QuestionCard
          label="Field scenario"
          prompt={lesson.scenario.prompt}
          answerKey={lesson.scenario.answerKey}
          answerKeyMissing={lesson.scenario.answerKeyMissing}
          kind="scenario"
          previous={latestLessonAttempt(state, lesson.scenario.id)}
          onGrade={grade(lesson.scenario.id, "scenario")}
        />
      </section>

      <section className="card" aria-labelledby="done-h">
        <h2 id="done-h">4 · Finish</h2>
        <p className="muted small">
          {prog.answered}/{prog.total} questions answered.{" "}
          {prog.answered < prog.total && !complete ? "You can still mark the lesson complete and come back to the rest." : ""}
        </p>
        <div className="row">
          {complete ? (
            <>
              <span className="badge badge-success">Completed</span>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => dispatch({ type: "uncompleteLesson", lessonId: lesson.id })}>
                Mark as not complete
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                dispatch({ type: "completeLesson", lessonId: lesson.id });
                toast.show("Lesson marked complete.");
              }}
            >
              Mark lesson complete
            </button>
          )}
          {next && (
            <Link href={`/lessons/${next.id}`} className="btn">
              Next lesson →
            </Link>
          )}
        </div>
      </section>

      <section className="card" aria-labelledby="src-h">
        <h2 id="src-h">Source &amp; review notes</h2>
        <ul className="list small">
          {lesson.sources.map((s, i) => (
            <li key={i}>
              <strong>{s.title}</strong>
              <div className="muted">{s.citation}</div>
              {s.url && (
                <a href={s.url} target="_blank" rel="noreferrer noopener">
                  {s.url}
                </a>
              )}
            </li>
          ))}
        </ul>
        <div className="notice notice-warning mt-1 small">
          <p className="prewrap">{lesson.sourceNote}</p>
        </div>
        <p className="small muted" style={{ marginTop: "0.6rem" }}>
          Script v{lesson.scriptVersion}
        </p>
      </section>

      <div className="mt-1">
        <SafetyNote />
      </div>

      <div className="row-between mt-1">
        {prev ? <Link href={`/lessons/${prev.id}`}>← {prev.title}</Link> : <span />}
        {next ? <Link href={`/lessons/${next.id}`}>{next.title} →</Link> : <span />}
      </div>
      {toast.node}
    </article>
  );
}

export default function LessonPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params?.id ?? "");
  return (
    <WithState>
      {(state) => {
        const lesson = state.lessons[id];
        if (!lesson)
          return (
            <div className="card">
              <EmptyState title="Lesson not found" action={<Link href="/path" className="btn">Back to the learning path</Link>}>
                It may have been removed, or the link is wrong.
              </EmptyState>
            </div>
          );
        return <LessonView key={lesson.id} state={state} lesson={lesson} />;
      }}
    </WithState>
  );
}
