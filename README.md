# SpecLoop Academy (MVP)

A voice-first learning app for instrumentation and controls (I&C) technicians. It turns a learning goal and permitted source material into short narrated lessons, retrieval quizzes, applied scenarios, and a simple spaced-review schedule: **listen → recall → apply → review**.

It runs locally with **no API keys**. Everything is stored in your browser (local demo mode).

> **Status: local prototype.** It is not a deployed or multi-user product. There's no sign-in, no hosted database, and no payments. See the [roadmap](#roadmap).

> Independent study support. Not endorsed by or affiliated with ISA. Not a complete CCST exam blueprint, and no guarantee of certification or regulatory compliance. The seeded lessons are **drafts that require technical review** (see [Seed course](#seed-course)).

## Quick start

Requires Node.js 20+ (built and tested on Node 22).

```bash
cd specloop
npm install
npm run dev            # http://localhost:3000
```

Production build:

```bash
npm run build && npm run start
```

Open the app, complete the welcome form, and you land on **Today** with the 10-lesson sample path.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests (scheduler, reducer, seed import, validation) |
| `npm run test:e2e` | Playwright end-to-end tests, desktop and phone viewports, with axe accessibility checks. Builds must exist (`npm run build`). Set `PLAYWRIGHT_CHROMIUM_PATH` to use a system Chromium; otherwise run `npx playwright install chromium` once. |
| `npm run check` | lint + typecheck + unit tests + build |
| `npm run seed:import` | Regenerates the seed JSON from `content/ccst-l1-seed-v0.1/*.md` |

## What's in the MVP

- **Welcome / setup**: display name, experience level, learning goal, CCST Level 1 sample path or a general I&C topic, daily study time. Editable later in Settings.
- **Today**: due reviews first, then the next lesson, with time estimates. Also lessons completed, a day streak (calendar days with activity, computed from real activity), upcoming reviews and recent activity. Loading, empty and error states are designed.
- **Learning path**: lessons in order with completion, answered count, audio status, review status and technical-review status.
- **Lesson player**: objective, audio player (with speed control) or a transcript-first fallback, transcript with pause cues, recall questions, an applied scenario, and mark complete. You must submit an answer before the key is revealed, then grade yourself.
- **Spaced review**: a fixed ladder. Missed: 1 → 3 → 7 days. Correct: 3 → 7 days. A miss restarts the missed ladder. A review queue walks through due items, and every item has a "Why is this due?" history. This is not FSRS.
- **Library**: add sources (title, type, citation, URL, notes, pasted text, .txt/.md/.pdf upload) with required rights and confidentiality confirmations. Create drafts from a template, a blank form, or AI (only if configured, and only after explicit consent). Edit drafts, mark in review, request changes, and **approve & publish** through a checklist. Published lessons keep source attribution and go into "My approved lessons."
- **Audio studio**: copy or download the audio-ready script (pause cues kept as text), edit the script (versioned), upload MP3/WAV, preview, replace, remove. Flags audio recorded from an older script version.
- **Settings**: profile, goal, study time, timezone, in-app review badge on/off, default playback speed, integration status, **export / import / delete all data**.

## Seed course

The 10 lessons come from **SpecLoop CCST Level 1 Seed Course, Draft v0.1** (`content/ccst-l1-seed-v0.1/`, copied verbatim from the supplied pack). `npm run seed:import` parses the markdown into `src/lib/seed/ccst-l1-seed.generated.json`. A unit test fails if the JSON drifts from the markdown. Objectives, scripts, questions, scenarios, answer keys and review notes are not rewritten. The importer only adds ids, attribution and an estimated duration (about 130 words per minute plus pauses plus about 4 minutes of questions).

Every seed lesson shows **Draft: technical review required** along with the pack's release gate, which says not to publish, sell, assign as approved training, or use to direct field work until an experienced I&C professional signs off.

Notes on pack v0.1:

- **SL01 has no scenario answer key** in the pack, only a reviewer note. The app says the key is missing rather than inventing one. A reviewer needs to supply it.
- Concept labels (`SL02 recall 1`, …) are generated ids, since the pack doesn't name concepts.

To update the course, replace the markdown files (same format, same `SLxx` codes so learner progress keeps its ids) and run `npm run seed:import`. Browsers that already hold data keep their stored copy of the seed. Use Settings → Delete all data to reseed, or add a migration step in `src/lib/store.ts` keyed on `seedVersion`.

## Configuration and integrations

Copy `.env.example` to `.env.local`. Every integration is off unless configured, and no secrets are committed.

| Integration | Status in this build | To enable |
| --- | --- | --- |
| **Local demo mode** | Default. localStorage + IndexedDB, single user, no auth. **Not secure multi-user storage.** | Nothing |
| **AI drafting (Anthropic)** | Implemented behind a server route, **not verified against the live API** (no key was available while building). | `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`; optional `ANTHROPIC_MODEL` (default `claude-opus-5-5`). |
| **OneStudio** | Manual workflow only. No API was assumed. | See [docs/onestudio-integration.md](docs/onestudio-integration.md) for the exact information needed. |
| **Supabase** | Schema and RLS migration provided and checked on local Postgres 16. **The app doesn't use it yet.** | See below. |
| **Stripe** | Disabled. No checkout exists, and nothing simulates payment. | Out of scope for this MVP. `src/lib/billing.ts` is the boundary. |

### AI drafting details

- `POST /api/ai/draft` uses the Anthropic TypeScript SDK with structured output validated against `GeneratedDraftSchema` (objective, script with pause cues, recall questions, scenario, answer keys, cited sources, uncertainties, `technicalReviewStatus: "requires_review"`). The output is validated again with Zod.
- Exactly one request goes to the configured model, with no fallback model and no automatic retry. If the model declines (`stop_reason: "refusal"`), the refusal's category and explanation are shown to the user as-is, no draft is created, and the send button stays disabled until the source text changes. The manual template path remains available. Unit and end-to-end tests check this.
- The prompt requires original wording, citations for source-derived claims, `[VERIFY]` on unsupported claims, no invented standards clauses, specs or safety steps, and a site-procedure field note.
- The UI discloses the provider and model and requires a confirmation checkbox before any text is sent. The source text isn't logged. Text over 60,000 characters is rejected (not truncated).
- AI output is always a draft and must pass the same approval checklist as a manual draft.

### Supabase (future hosted mode)

`supabase/migrations/0001_init.sql` mirrors the local model. It covers profiles, paths, lessons, script versions, concepts, questions, sources, attributions, drafts, audio assets, attempts, completions, review items and review events, with row-level security on every table. Seed content is readable by all signed-in users. Everything learner-owned is visible only to its owner. Checked locally: the migration applies on Postgres 16 with `auth` stubs, user A can't read user B's sources, and spoofed inserts are rejected.

Wiring it up still requires Supabase Auth, a repository adapter that persists the reducer's actions, and private Storage buckets for audio and PDFs (the policy sketch is at the end of the migration). `src/lib/blob-store.ts` (`BlobStorage`) and the reducer/action layer are the seams for that work.

## Project layout

```
specloop/
  content/ccst-l1-seed-v0.1/   seed course markdown (source of truth)
  docs/                        data model, OneStudio integration notes
  e2e/                         Playwright tests
  scripts/import-seed.mts      seed markdown → JSON
  supabase/migrations/         hosted schema + RLS
  src/app/                     routes (App Router), API routes under api/
  src/components/              shell, player, question card, forms
  src/lib/                     types (Zod), reducer, scheduler, selectors, store,
                               blob storage, providers (TTS, AI, billing)
```

## Content and safety rules built into the product

- Lessons are study material, not work instructions. Lessons and drafts carry a note that field tasks follow site procedures, permits, isolation/LOTO where applicable, and qualified supervision.
- Sources require rights and confidentiality confirmations. Uploaded files stay in the browser.
- Drafts keep their attribution, generation method, date and review status. Only an explicit approval publishes a lesson, and editing an approved draft sends it back to draft.

## Roadmap

1. **Local MVP**: this release.
2. **Refusal handling**: done. AI refusals are shown to the user and never retried on another model.
3. **Persistence and auth**: next. Add Supabase Auth, a repository adapter behind the reducer actions, and private Storage buckets. Then verify ownership checks end to end with two real accounts, not only on local Postgres.
4. **Payments**: later, if at all. Stripe test mode behind `src/lib/billing.ts`, only after auth exists.

## Known limitations

- Local demo mode is per-browser and unauthenticated. Clearing site data erases it. Export first.
- PDF text isn't extracted. The PDF is stored with the source, and you paste the passages you'll use.
- Data export excludes audio and PDF binaries (metadata only). After an import, audio must be re-uploaded.
- AI drafting is untested against the live API in this build.
- The Supabase adapter, auth, and Stripe aren't implemented.
- The CCST topic mapping wasn't re-checked against ISA's current page, which was unreachable from the build environment.
- The seed course is unreviewed draft content.
