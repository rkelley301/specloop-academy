"use client";

import Link from "next/link";
import { EmptyState, WithState } from "@/components/StateViews";
import { formatLocalDate, relativeDay } from "@/lib/dates";
import {
  dueReviews,
  nextLesson,
  recentActivity,
  streak,
  today as todayOf,
  upcomingByDay,
} from "@/lib/selectors";
import { readLocalState, useStore } from "@/lib/store";
import { hasImportableData } from "@/lib/supabase/import-plan";
import type { AppState } from "@/lib/types";

const REVIEW_MINUTES_PER_ITEM = 1.5;

function TodayView({ state }: { state: AppState }) {
  const day = todayOf(state);
  const due = dueReviews(state, day);
  const lesson = nextLesson(state);
  const totalLessons = Object.keys(state.lessons).length;
  const completed = state.completions.length;
  const days = streak(state, day);
  const upcoming = upcomingByDay(state, day, 7);
  const activity = recentActivity(state, 6);
  const reviewMinutes = Math.max(1, Math.ceil(due.length * REVIEW_MINUTES_PER_ITEM));
  const planMinutes = (due.length ? reviewMinutes : 0) + (lesson?.estMinutes ?? 0);
  const budget = state.profile?.dailyMinutes ?? 10;
  const allDone = !lesson && due.length === 0;
  const snap = useStore();
  const hosted = snap.status === "ready" && snap.backend === "supabase";
  const local = hosted ? readLocalState() : null;
  const offerImport = Boolean(local?.ok && local.state && hasImportableData(local.state));

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">{formatLocalDate(day)}</div>
        <h1>Hi {state.profile?.displayName}</h1>
        <p>
          {allDone
            ? "Nothing is due right now."
            : `Today's plan is about ${planMinutes} min. Your daily goal is ${budget} min.`}
        </p>
      </div>

      {offerImport && (
        <div className="notice notice-info" style={{ marginBottom: "1rem" }}>
          <strong>Demo data found in this browser</strong>
          It isn&apos;t part of your account. Review it and import it in{" "}
          <Link href="/settings#data">Settings → Your data</Link>. Nothing is imported unless you confirm.
        </div>
      )}

      {due.length > 0 && (
        <section className="card card-accent" aria-labelledby="due-h">
          <div className="eyebrow">Due now</div>
          <h2 id="due-h">
            {due.length} review {due.length === 1 ? "item" : "items"}
          </h2>
          <p className="muted">
            About {reviewMinutes} min. Reviews come first so you retrieve what you learned before it fades.
          </p>
          <Link href="/review" className="btn btn-primary">
            Start review
          </Link>
        </section>
      )}

      {lesson && (
        <section className={`card ${due.length ? "" : "card-accent"}`} aria-labelledby="next-h">
          <div className="eyebrow">{due.length ? "Then" : "Next lesson"}</div>
          <h2 id="next-h">{lesson.title}</h2>
          <p className="muted mb-0">{lesson.objective}</p>
          <div className="meta" style={{ margin: "0.5rem 0 0.9rem" }}>
            <span>About {lesson.estMinutes} min</span>
            <span aria-hidden="true">·</span>
            <span>
              Lesson {lesson.order} of {state.paths.find((p) => p.id === lesson.pathId)?.lessonIds.length}
            </span>
          </div>
          <Link href={`/lessons/${lesson.id}`} className={due.length ? "btn" : "btn btn-primary"}>
            {state.attempts.some((a) => a.lessonId === lesson.id) ? "Continue lesson" : "Start lesson"}
          </Link>
        </section>
      )}

      {allDone && (
        <section className="card card-accent">
          <h2>You&apos;re caught up</h2>
          <p className="muted">
            You&apos;ve finished every lesson and there are no reviews due.
            {upcoming[0] ? ` Your next review is ${relativeDay(upcoming[0].date, day)}.` : ""} You can add your own
            sources in the Library to build more lessons.
          </p>
          <Link href="/library" className="btn">
            Open the Library
          </Link>
        </section>
      )}

      <section className="card" aria-label="Progress">
        <div className="stats">
          <div className="stat">
            <span className="stat-value">
              {completed}/{totalLessons}
            </span>
            <span className="stat-label">lessons completed</span>
          </div>
          <div className="stat">
            <span className="stat-value">{days}</span>
            <span className="stat-label">day{days === 1 ? "" : "s"} in a row</span>
          </div>
          <div className="stat">
            <span className="stat-value">{due.length}</span>
            <span className="stat-label">reviews due</span>
          </div>
        </div>
      </section>

      <div className="grid-2 mt-1">
        <section className="card" aria-labelledby="up-h">
          <h2 id="up-h">Upcoming reviews</h2>
          {upcoming.length === 0 ? (
            <EmptyState title="Nothing scheduled this week">
              Answer lesson questions to start your review schedule.
            </EmptyState>
          ) : (
            <ul className="list">
              {upcoming.map((u) => (
                <li key={u.date} className="row-between">
                  <span>{formatLocalDate(u.date)}</span>
                  <span className="muted small">
                    {u.count} item{u.count === 1 ? "" : "s"} · {relativeDay(u.date, day)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="act-h">
          <h2 id="act-h">Recent activity</h2>
          {activity.length === 0 ? (
            <EmptyState title="No activity yet">Your completed lessons and answers will show up here.</EmptyState>
          ) : (
            <ul className="list">
              {activity.map((a, i) => (
                <li key={i}>
                  <div className="small">{a.text}</div>
                  <div className="meta">{new Date(a.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

export default function TodayPage() {
  return <WithState>{(state) => <TodayView state={state} />}</WithState>;
}
