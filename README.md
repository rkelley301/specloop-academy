# SpecLoop Academy (MVP)

A voice-first learning app for instrumentation and controls (I&C) technicians. It turns a learning goal and permitted source material into short narrated lessons, retrieval quizzes, applied scenarios, and a simple spaced-review schedule: **listen → recall → apply → review**.

It runs in two modes:

- **Local demo mode** (default, no keys): everything is stored in your browser.
- **Hosted mode** (Supabase): email magic-link sign-in, with each learner's data and files in their own account, isolated by row-level security and private storage policies. See [Hosted mode](#hosted-mode-supabase).

> **Status: pilot-ready code, not yet verified against a live Supabase project.** Hosted mode has been tested against a local Postgres with Supabase-style policies and against a mock of the Supabase API. It still needs the live checks in [Verify a live project](#verify-a-live-project) before real learners use it. There's no deployment and no payments. See the [roadmap](#roadmap).

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
| `npm run test:e2e` | Playwright end-to-end tests in local mode, desktop and phone viewports, with axe accessibility checks. Builds must exist (`npm run build`). Set `PLAYWRIGHT_CHROMIUM_PATH` to use a system Chromium; otherwise run `npx playwright install chromium` once. |
| `npm run test:e2e:hosted` | Hosted-mode end-to-end tests: builds into `.next-hosted` with Supabase variables pointed at `e2e/mock-supabase.mjs` (an in-memory stand-in for the Supabase API; it doesn't enforce RLS). |
| `npm run verify:rls` | Checks RLS and storage policies against a **live** Supabase project as two real signed-in users. See [Verify a live project](#verify-a-live-project). |
| `npm run seed:sql` | Regenerates `supabase/migrations/0003_seed_ccst_l1.sql` from the bundled seed course |
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
| **Local demo mode** | Default when both Supabase variables are absent. localStorage + IndexedDB, single user, no auth. **Not secure multi-user storage.** | Nothing |
| **Hosted mode (Supabase)** | Magic-link auth, account data, private file storage, explicit local-data import. **Not yet run against a live project.** | See [Hosted mode](#hosted-mode-supabase). |
| **AI drafting (Anthropic)** | Implemented behind a server route, **not verified against the live API** (no key was available while building). | `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`; optional `ANTHROPIC_MODEL` (default `claude-opus-5-5`). |
| **OneStudio** | Manual workflow only. No API was assumed. | See [docs/onestudio-integration.md](docs/onestudio-integration.md) for the exact information needed. |
| **Stripe** | Disabled. No checkout exists, and nothing simulates payment. | Out of scope for this MVP. `src/lib/billing.ts` is the boundary. |

### AI drafting details

- `POST /api/ai/draft` uses the Anthropic TypeScript SDK with structured output validated against `GeneratedDraftSchema` (objective, script with pause cues, recall questions, scenario, answer keys, cited sources, uncertainties, `technicalReviewStatus: "requires_review"`). The output is validated again with Zod.
- Exactly one request goes to the configured model, with no fallback model and no automatic retry. If the model declines (`stop_reason: "refusal"`), the refusal's category and explanation are shown to the user as-is, no draft is created, and the send button stays disabled until the source text changes. The manual template path remains available. Unit and end-to-end tests check this.
- The prompt requires original wording, citations for source-derived claims, `[VERIFY]` on unsupported claims, no invented standards clauses, specs or safety steps, and a site-procedure field note.
- The UI discloses the provider and model and requires a confirmation checkbox before any text is sent. The source text isn't logged. Text over 60,000 characters is rejected (not truncated).
- AI output is always a draft and must pass the same approval checklist as a manual draft.

## Hosted mode (Supabase)

### How it behaves

- **Mode selection fails closed.** Both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set means hosted mode. Both absent means local demo mode. Anything else (one missing, an invalid URL, plain `http` to a non-localhost host) shows a configuration error and stores nothing. If the project is unreachable, the seed course is missing, or a save fails, the app stops with an error. It never falls back to browser storage.
- **Sign-in:** email magic link (`/sign-in` → email → `/auth/callback`). The session is kept in cookies by `@supabase/ssr`, and middleware refreshes it and sends signed-out visitors to `/sign-in`. In hosted mode, `/api/ai/draft` requires a signed-in user.
- **Keys:** the browser only ever has the URL and the **anon** key. The service-role key isn't used anywhere in the app.
- **Data:** the reducer stays the single source of truth for changes. Each change is diffed into ordered upserts and deletes on the user's own rows (`src/lib/supabase/sync.ts`), and account state is loaded back with the inverse mapping (`rows.ts`). Seed lessons are shared and read-only in hosted mode, so their scripts can't be edited in Audio studio.
- **Files:** audio and source PDFs go to private buckets `audio` and `sources` at `{user_id}/{file_id}`. Storage policies allow only the owning, signed-in user, the buckets aren't public, and there are no policies for the anon role.
- **Import:** Settings → Your data → *Import demo data into this account*. It reads this browser's local demo data, or an export file, and shows what will be added and what will be skipped. Nothing is written until you tick the confirmation and click Import. It only adds rows: the account's profile, settings and any conflicting items (an existing review schedule for the same question, an existing completion, audio for a lesson that already has audio) are kept as-is. Learner-owned ids get new UUIDs. The local copy stays in the browser until you remove it separately. Importing twice warns about duplicates.
- **Delete:** *Delete my account data* removes the user's rows and files. Deleting the sign-in identity itself needs the dashboard or an admin.

### Set up a project

1. Create a Supabase project. In **SQL Editor**, run the migrations in order:
   `0001_init.sql`, `0002_storage.sql` (private buckets and storage policies), `0003_seed_ccst_l1.sql` (the shared seed course), `0004_lesson_path_ownership.sql`.
2. **Authentication → Providers → Email:** enabled. Magic links work with the default template. Keep **Confirm email** on.
3. **Authentication → URL Configuration:** set **Site URL** to where the app runs (for a local pilot, `http://localhost:3000`) and add `http://localhost:3000/auth/callback` to **Redirect URLs**. Add the production URL and its `/auth/callback` when you deploy.
4. **Email sending:** the built-in sender is rate-limited and meant for testing. For a pilot with more than a few people, configure your own SMTP under **Authentication → Emails → SMTP Settings**.
5. Put the project URL and **anon** key in `specloop/.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```
   Restart `npm run dev`, or rebuild for `npm run start`. `NEXT_PUBLIC_` values are compiled into the build.

### Verify a live project

**1. Automated policy check (two temporary users).** From `specloop/`, with the keys only in your shell:

```bash
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_ANON_KEY=<anon key> \
SUPABASE_SERVICE_ROLE_KEY=<service role key> \
npm run verify:rls
```

The service-role key is used only to create two pre-confirmed throwaway users, mint each a one-time magic-link token, and delete them (and their files) afterwards. No emails are sent. Every check runs through that user's own anon-key client after signing in. That covers B being unable to read, update, delete, or spoof A's rows, A's lessons and paths, and A's files (download, signed URL, list, upload into A's folder, delete), plus the signed-out role and the public-URL check, with positive controls so a broken client can't pass by accident. The script exits non-zero on any failure. Don't save the service-role key in a file.

**2. Manual browser checklist.**

- [ ] `/sign-in` sends the email; the link opens the app signed in (same browser).
- [ ] An expired or reused link returns to `/sign-in` with an error.
- [ ] Complete setup, answer a question, upload audio; reload, and everything is still there.
- [ ] Sign out; `/today` redirects to `/sign-in`.
- [ ] In a second browser profile, sign in with a **different** email: none of the first account's data, sources or audio appear.
- [ ] Settings → Import demo data: the summary is accurate, nothing is written before confirming, and the local copy remains after import.
- [ ] Temporarily remove one Supabase variable and restart: the app shows a configuration error and doesn't fall back to local storage.

## Project layout

```
specloop/
  content/ccst-l1-seed-v0.1/   seed course markdown (source of truth)
  docs/                        data model, OneStudio integration notes
  e2e/                         Playwright tests (local + hosted with a mock Supabase API)
  scripts/import-seed.mts      seed markdown → JSON
  scripts/verify-rls.mjs       live RLS/storage policy check (two real users)
  supabase/migrations/         schema + RLS, storage, seed course, policy fixes
  src/app/                     routes (App Router), API routes under api/
  src/components/              shell, player, question card, forms
  src/lib/                     types (Zod), reducer, scheduler, selectors, store,
                               blob storage, providers (TTS, AI, billing),
                               supabase/ (client, row mapping, diff sync, import)
```

## Content and safety rules built into the product

- Lessons are study material, not work instructions. Lessons and drafts carry a note that field tasks follow site procedures, permits, isolation/LOTO where applicable, and qualified supervision.
- Sources require rights and confidentiality confirmations. Uploaded files stay in the browser (local mode) or in the user's private storage folder (hosted mode).
- Drafts keep their attribution, generation method, date and review status. Only an explicit approval publishes a lesson, and editing an approved draft sends it back to draft.

## Roadmap

1. **Local MVP**: this release.
2. **Refusal handling**: done. AI refusals are shown to the user and never retried on another model.
3. **Persistence and auth**: built. Magic-link auth, account persistence, private storage and explicit import are implemented and tested locally. **Remaining: run `npm run verify:rls` and the manual checklist against your live project.**
4. **Payments**: later, if at all. Stripe test mode behind `src/lib/billing.ts`, only after auth exists.

## Known limitations

- Local demo mode is per-browser and unauthenticated. Clearing site data erases it. Export first.
- PDF text isn't extracted. The PDF is stored with the source, and you paste the passages you'll use.
- Data export excludes audio and PDF binaries (metadata only). After an import, audio must be re-uploaded.
- AI drafting is untested against the live API in this build.
- Hosted mode hasn't been run against a live Supabase project (none was reachable from the build environment). See [Verify a live project](#verify-a-live-project).
- Hosted writes aren't transactional across tables. A failure mid-change stops the app and asks for a reload, but rows written before the failure stay. The same applies to an import interrupted partway, and re-running it then adds duplicates.
- Hosted mode loads an account's whole history at sign-in (paged in batches of 1,000). That's fine for a pilot, but very large histories would need incremental loading.
- Deleting the sign-in identity (not just its data) requires the Supabase dashboard or an admin.
- Stripe isn't implemented.
- The CCST topic mapping wasn't re-checked against ISA's current page, which was unreachable from the build environment.
- The seed course is unreviewed draft content.
