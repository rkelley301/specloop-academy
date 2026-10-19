"use client";

import Link from "next/link";
import { useState } from "react";
import { QuestionCard } from "@/components/QuestionCard";
import { EmptyState, WithState } from "@/components/StateViews";
import { formatLocalDate, relativeDay } from "@/lib/dates";
import { LADDERS, describePosition } from "@/lib/scheduler";
import { dueReviews, findQuestion, today, upcomingReviews } from "@/lib/selectors";
import { dispatch } from "@/lib/store";
import type { AppState, ReviewItem } from "@/lib/types";

function WhyDue({ state, item }: { state: AppState; item: ReviewItem }) {
  const events = state.reviewEvents.filter((e) => e.reviewItemId === item.id);
  return (
    <details className="small" style={{ marginTop: "0.6rem" }}>
      <summary>Why is this due?</summary>
      <p className="mb-0">{describePosition(item)}</p>
      <ol style={{ paddingLeft: "1.2rem", margin: "0.5rem 0 0" }}>
        {events.map((e) => (
          <li key={e.id}>
            {formatLocalDate(e.occurredOn)} ({e.context === "lesson" ? "in lesson" : "in review"}):{" "}
            <strong>{e.result === "correct" ? "got it" : "missed"}</strong>. {e.reason}
            {e.nextDueDate && <> Due {formatLocalDate(e.nextDueDate)}.</>}
          </li>
        ))}
      </ol>
    </details>
  );
}

function ReviewSession({ state }: { state: AppState }) {
  const day = today(state);
  const due = dueReviews(state, day);
  // Freeze the queue when the session starts so answered items don't vanish mid-card.
  const [queue, setQueue] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<{ correct: number; missed: number }>({ correct: 0, missed: 0 });
  const [graded, setGraded] = useState<Set<string>>(new Set());

  if (!queue) {
    const upcoming = upcomingReviews(state, day, 30);
    return (
      <>
        <section className="card card-accent">
          {due.length ? (
            <>
              <h2>
                {due.length} item{due.length === 1 ? "" : "s"} due
              </h2>
              <p className="muted">
                About {Math.max(1, Math.ceil(due.length * 1.5))} min. You&apos;ll answer each one from memory, check the
                key, and grade yourself.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setQueue(due.map((d) => d.id));
                  setIndex(0);
                  setResults({ correct: 0, missed: 0 });
                  setGraded(new Set());
                }}
              >
                Start review
              </button>
            </>
          ) : (
            <EmptyState
              title="No reviews due"
              action={
                <Link href="/path" className="btn">
                  Go to the learning path
                </Link>
              }
            >
              {state.reviewItems.length === 0
                ? "Reviews appear after you answer questions in a lesson."
                : upcoming[0]
                  ? `Next review is ${relativeDay(upcoming[0].dueDate, day)} (${formatLocalDate(upcoming[0].dueDate)}).`
                  : "Everything you've studied has finished its review ladder."}
            </EmptyState>
          )}
        </section>

        <section className="card" aria-labelledby="how-h">
          <h2 id="how-h">How the schedule works</h2>
          <p className="small">
            SpecLoop uses a fixed, simple ladder so you can always see why something is due. It is not an adaptive
            algorithm such as FSRS.
          </p>
          <ul className="small">
            <li>
              <strong>Missed</strong>: back in {LADDERS.missed.join(", then ")} days.
            </li>
            <li>
              <strong>Got it</strong>: back in {LADDERS.correct.join(", then ")} days.
            </li>
            <li>A correct review climbs one rung. A miss restarts the missed ladder at 1 day. Clearing the last rung retires the item.</li>
            <li>Answering again inside a lesson starts that question&apos;s schedule fresh.</li>
          </ul>
        </section>

        <section className="card" aria-labelledby="sched-h">
          <h2 id="sched-h">Scheduled (next 30 days)</h2>
          {upcoming.length === 0 ? (
            <p className="muted small mb-0">Nothing scheduled.</p>
          ) : (
            <ul className="list">
              {upcoming.map((item) => {
                const q = findQuestion(state, item.lessonId, item.questionId);
                return (
                  <li key={item.id}>
                    <div className="row-between">
                      <span className="small">
                        <strong>{formatLocalDate(item.dueDate)}</strong> · {relativeDay(item.dueDate, day)}
                      </span>
                      <span className={`badge ${item.lastResult === "missed" ? "badge-danger" : "badge-success"}`}>
                        Last: {item.lastResult === "missed" ? "missed" : "got it"}
                      </span>
                    </div>
                    <div className="small">{q?.prompt}</div>
                    <div className="meta">{q?.lesson.title}</div>
                    <WhyDue state={state} item={item} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </>
    );
  }

  if (index >= queue.length) {
    return (
      <section className="card card-accent" role="status">
        <h2>Review complete</h2>
        <p>
          You reviewed {queue.length} item{queue.length === 1 ? "" : "s"}: {results.correct} got it, {results.missed} missed.
          Missed items come back tomorrow.
        </p>
        <div className="row">
          <Link href="/today" className="btn btn-primary">
            Back to Today
          </Link>
          <button type="button" className="btn" onClick={() => setQueue(null)}>
            See schedule
          </button>
        </div>
      </section>
    );
  }

  const item = state.reviewItems.find((r) => r.id === queue[index]);
  const q = item ? findQuestion(state, item.lessonId, item.questionId) : null;
  return (
    <section aria-labelledby="sess-h">
      <div className="row-between" style={{ marginBottom: "0.6rem" }}>
        <h2 id="sess-h" className="mb-0">
          Item {index + 1} of {queue.length}
        </h2>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setQueue(null)}>
          End session
        </button>
      </div>
      <div className="progress" aria-hidden="true" style={{ marginBottom: "1rem" }}>
        <span style={{ width: `${(index / queue.length) * 100}%` }} />
      </div>
      {!item || !q ? (
        <div className="card">
          <p>This item&apos;s lesson is no longer available.</p>
          <button type="button" className="btn" onClick={() => setIndex(index + 1)}>
            Skip
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="meta" style={{ marginBottom: "0.5rem" }}>
            From <Link href={`/lessons/${q.lesson.id}`}>{q.lesson.title}</Link>
          </div>
          <QuestionCard
            key={item.id}
            label={q.kind === "scenario" ? "Scenario review" : "Recall review"}
            prompt={q.prompt}
            answerKey={q.answerKey}
            answerKeyMissing={q.answerKeyMissing}
            kind={q.kind}
            onGrade={(response, result) => {
              dispatch({
                type: "answerQuestion",
                lessonId: item.lessonId,
                questionId: item.questionId,
                kind: q.kind,
                context: "review",
                response,
                result,
              });
              setResults((r) => ({ ...r, [result]: r[result] + 1 }));
              setGraded((g) => new Set(g).add(item.id));
              return result === "missed" ? "Recorded as missed. Back tomorrow." : "Recorded as got it.";
            }}
          />
          <WhyDue state={state} item={item} />
          <div className="row" style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!graded.has(item.id)}
              onClick={() => setIndex(index + 1)}
            >
              {index + 1 === queue.length ? "Finish" : "Next item"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function ReviewPage() {
  return (
    <WithState>
      {(state) => (
        <>
          <div className="page-head">
            <h1>Review</h1>
            <p>Short retrieval practice on what you&apos;ve already studied.</p>
          </div>
          <ReviewSession state={state} />
        </>
      )}
    </WithState>
  );
}
