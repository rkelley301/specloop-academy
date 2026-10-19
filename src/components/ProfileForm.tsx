"use client";

import { useState, type FormEvent } from "react";
import { detectTimezone, isValidTimezone } from "@/lib/dates";
import type { ProfileInput } from "@/lib/reducer";
import { EXPERIENCE_LABELS, ExperienceLevel, type Profile } from "@/lib/types";

const MINUTES = [5, 10, 15, 20, 30];

export function ProfileForm({
  initial,
  submitLabel,
  onSubmit,
  showTimezone = false,
}: {
  initial: Profile | null;
  submitLabel: string;
  onSubmit: (p: ProfileInput) => void;
  showTimezone?: boolean;
}) {
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [experienceLevel, setExperience] = useState<ExperienceLevel>(initial?.experienceLevel ?? "apprentice");
  const [target, setTarget] = useState<Profile["target"]>(initial?.target ?? "ccst1");
  const [targetTopic, setTopic] = useState(initial?.target === "general" ? initial.targetTopic : "");
  const [goal, setGoal] = useState(initial?.goal ?? "");
  const [dailyMinutes, setMinutes] = useState(initial?.dailyMinutes ?? 10);
  const [timezone, setTimezone] = useState(initial?.timezone ?? detectTimezone());
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!displayName.trim()) errs.displayName = "Enter a display name.";
    if (!goal.trim()) errs.goal = "Describe what you want to get out of studying.";
    if (target === "general" && !targetTopic.trim()) errs.targetTopic = "Name the topic you want to focus on.";
    if (!isValidTimezone(timezone)) errs.timezone = "Use an IANA timezone like America/Chicago.";
    setErrors(errs);
    if (Object.keys(errs).length) {
      const first = Object.keys(errs)[0];
      document.getElementById(`pf-${first}`)?.focus();
      return;
    }
    onSubmit({
      displayName: displayName.trim(),
      experienceLevel,
      goal: goal.trim(),
      target,
      targetTopic: target === "ccst1" ? "CCST Level 1" : targetTopic.trim(),
      dailyMinutes,
      timezone,
    });
  }

  const err = (k: string) =>
    errors[k] ? (
      <div className="error-text" id={`pf-${k}-err`}>
        {errors[k]}
      </div>
    ) : null;

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="pf-displayName">Display name</label>
        <input
          id="pf-displayName"
          type="text"
          autoComplete="nickname"
          value={displayName}
          maxLength={60}
          onChange={(e) => setDisplayName(e.target.value)}
          aria-invalid={Boolean(errors.displayName)}
          aria-describedby={errors.displayName ? "pf-displayName-err" : undefined}
        />
        {err("displayName")}
      </div>

      <fieldset>
        <legend>Experience level</legend>
        <div className="choices-inline">
          {ExperienceLevel.options.map((lvl) => (
            <label key={lvl} className="choice">
              <input type="radio" name="experience" value={lvl} checked={experienceLevel === lvl} onChange={() => setExperience(lvl)} />
              <span>{EXPERIENCE_LABELS[lvl]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>What are you working toward?</legend>
        <label className="choice">
          <input type="radio" name="target" checked={target === "ccst1"} onChange={() => setTarget("ccst1")} />
          <span>
            <strong>CCST Level 1 (sample path)</strong>
            <span className="hint">
              Ten seeded lessons on core I&amp;C topics. Independent study support, not ISA-endorsed, with no guarantee
              of certification.
            </span>
          </span>
        </label>
        <label className="choice">
          <input type="radio" name="target" checked={target === "general"} onChange={() => setTarget("general")} />
          <span>
            <strong>A general I&amp;C learning goal</strong>
            <span className="hint">You still get the sample path, and you can build your own lessons from sources in the Library.</span>
          </span>
        </label>
      </fieldset>

      {target === "general" && (
        <div className="field">
          <label htmlFor="pf-targetTopic">Topic or certification</label>
          <input
            id="pf-targetTopic"
            type="text"
            value={targetTopic}
            maxLength={120}
            placeholder="e.g. Control valve troubleshooting"
            onChange={(e) => setTopic(e.target.value)}
            aria-invalid={Boolean(errors.targetTopic)}
            aria-describedby={errors.targetTopic ? "pf-targetTopic-err" : undefined}
          />
          {err("targetTopic")}
        </div>
      )}

      <div className="field">
        <label htmlFor="pf-goal">Your learning goal</label>
        <textarea
          id="pf-goal"
          value={goal}
          maxLength={400}
          rows={3}
          placeholder="e.g. Get solid on loop fundamentals before my CCST exam in the spring"
          onChange={(e) => setGoal(e.target.value)}
          aria-invalid={Boolean(errors.goal)}
          aria-describedby={errors.goal ? "pf-goal-err" : "pf-goal-hint"}
          style={{ minHeight: 90 }}
        />
        {errors.goal ? err("goal") : <span className="hint" id="pf-goal-hint">A sentence is enough. You can change it later.</span>}
      </div>

      <fieldset>
        <legend>Daily study time</legend>
        <div className="choices-inline">
          {MINUTES.map((m) => (
            <label key={m} className="choice">
              <input type="radio" name="minutes" checked={dailyMinutes === m} onChange={() => setMinutes(m)} />
              <span>{m} min</span>
            </label>
          ))}
        </div>
      </fieldset>

      {showTimezone && (
        <div className="field">
          <label htmlFor="pf-timezone">Timezone</label>
          <input
            id="pf-timezone"
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            aria-invalid={Boolean(errors.timezone)}
            aria-describedby={errors.timezone ? "pf-timezone-err" : "pf-timezone-hint"}
          />
          {errors.timezone ? (
            err("timezone")
          ) : (
            <span className="hint" id="pf-timezone-hint">
              Review due dates follow your local calendar day. Detected: {detectTimezone()}.
            </span>
          )}
        </div>
      )}

      <button type="submit" className="btn btn-primary btn-block">
        {submitLabel}
      </button>
    </form>
  );
}
