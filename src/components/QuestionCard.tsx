"use client";

import { useId, useState, type FormEvent } from "react";
import type { Result } from "@/lib/types";

export interface QuestionCardProps {
  label: string;
  prompt: string;
  answerKey: string;
  answerKeyMissing?: boolean;
  kind: "recall" | "scenario";
  /** Most recent recorded attempt, if any. */
  previous?: { response: string; result: Result } | null;
  /** Called after the learner self-grades. Returns a short status line. */
  onGrade: (response: string, result: Result) => string;
}

type Phase = "answering" | "revealed" | "graded";

export function QuestionCard({ label, prompt, answerKey, answerKeyMissing, kind, previous, onGrade }: QuestionCardProps) {
  const id = useId();
  const [phase, setPhase] = useState<Phase>(previous ? "graded" : "answering");
  const [response, setResponse] = useState(previous?.response ?? "");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(
    previous ? `Recorded: ${previous.result === "correct" ? "got it" : "missed"}.` : null,
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!response.trim()) {
      setError("Write your answer first. Retrieval works best when you commit to an answer before checking.");
      document.getElementById(`${id}-a`)?.focus();
      return;
    }
    setError(null);
    setPhase("revealed");
    requestAnimationFrame(() => document.getElementById(`${id}-key`)?.focus());
  }

  function grade(result: Result) {
    setStatus(onGrade(response.trim(), result));
    setPhase("graded");
  }

  return (
    <section className="question" aria-labelledby={`${id}-p`}>
      <div className="eyebrow">{label}</div>
      <p className="question-prompt prewrap" id={`${id}-p`}>
        {prompt}
      </p>

      {phase === "answering" && (
        <form onSubmit={submit} noValidate>
          <label htmlFor={`${id}-a`} className="visually-hidden">
            Your answer
          </label>
          <textarea
            id={`${id}-a`}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            rows={kind === "scenario" ? 6 : 3}
            placeholder={kind === "scenario" ? "Describe what you'd check and why…" : "Your answer…"}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-err` : undefined}
            style={{ minHeight: kind === "scenario" ? 140 : 80 }}
          />
          {error && (
            <div className="error-text" id={`${id}-err`} role="alert">
              {error}
            </div>
          )}
          <div className="row" style={{ marginTop: "0.6rem" }}>
            <button type="submit" className="btn btn-primary">
              Submit &amp; show answer key
            </button>
          </div>
        </form>
      )}

      {phase !== "answering" && (
        <>
          <div className="small">
            <span className="muted">Your answer:</span>
            <p className="your-answer">{response}</p>
          </div>
          <div className="answer-key" id={`${id}-key`} tabIndex={-1}>
            <div className="label">{answerKeyMissing ? "Answer key missing" : "Answer key"}</div>
            <p className={`prewrap mb-0 ${answerKeyMissing ? "muted" : ""}`}>{answerKey}</p>
          </div>
        </>
      )}

      {phase === "revealed" && (
        <div style={{ marginTop: "0.75rem" }}>
          <p className="small muted mb-0">
            Compare honestly. Did your answer cover the key points?
          </p>
          <div className="row" style={{ marginTop: "0.5rem" }} role="group" aria-label="Grade your answer">
            <button type="button" className="btn btn-good" onClick={() => grade("correct")}>
              I got it
            </button>
            <button type="button" className="btn btn-bad" onClick={() => grade("missed")}>
              I missed it
            </button>
          </div>
        </div>
      )}

      {phase === "graded" && (
        <div className="row-between" style={{ marginTop: "0.75rem" }}>
          <p className="small mb-0" role="status">
            {status}
          </p>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              setPhase("answering");
              setResponse("");
              setStatus(null);
            }}
          >
            Answer again
          </button>
        </div>
      )}
    </section>
  );
}
