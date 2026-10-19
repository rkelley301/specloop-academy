-- SpecLoop Academy: hosted schema (Supabase / Postgres).
--
-- STATUS: provided for the hosted backend; NOT yet wired into the app. The
-- MVP runs in local demo mode (localStorage + IndexedDB). This schema mirrors
-- src/lib/types.ts so a Supabase repository adapter can replace the local
-- store without changing the UI.
--
-- Every learner-owned row carries user_id and is protected by row-level
-- security so source text and performance data stay private to the account.

create extension if not exists "pgcrypto";

-- Profile & preferences ------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  experience_level text not null check (experience_level in ('new','apprentice','technician','senior')),
  goal text not null,
  target text not null check (target in ('ccst1','general')),
  target_topic text not null default '',
  daily_minutes int not null check (daily_minutes between 5 and 120),
  timezone text not null default 'UTC',
  notifications text not null default 'in_app' check (notifications in ('off','in_app')),
  playback_rate numeric(3,2) not null default 1.0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Paths & lessons -------------------------------------------------------------
-- owner_id null = shared seed content (read-only to learners).
create table public.learning_paths (
  id text primary key,
  owner_id uuid references auth.users (id) on delete cascade,
  title text not null,
  description text not null default '',
  origin text not null check (origin in ('seed','custom')),
  created_at timestamptz not null default now()
);

create table public.lessons (
  id text primary key,
  owner_id uuid references auth.users (id) on delete cascade,
  path_id text not null references public.learning_paths (id) on delete cascade,
  position int not null,
  title text not null,
  objective text not null,
  est_minutes int not null check (est_minutes > 0),
  script text not null,
  script_version int not null default 1,
  source_note text not null default '',
  review_status text not null check (review_status in ('draft','in_review','changes_requested','approved')),
  origin text not null check (origin in ('seed','draft')),
  draft_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (path_id, position)
);

create table public.lesson_script_versions (
  lesson_id text not null references public.lessons (id) on delete cascade,
  version int not null,
  script text not null,
  saved_by uuid references auth.users (id),
  saved_at timestamptz not null default now(),
  primary key (lesson_id, version)
);

create table public.concepts (
  id text primary key,
  lesson_id text not null references public.lessons (id) on delete cascade,
  label text not null
);

-- kind = recall | scenario. answer_key_missing flags source content without a key.
create table public.questions (
  id text primary key,
  lesson_id text not null references public.lessons (id) on delete cascade,
  concept_id text not null references public.concepts (id),
  kind text not null check (kind in ('recall','scenario')),
  position int not null,
  prompt text not null,
  answer_key text not null,
  answer_key_missing boolean not null default false
);

-- Sources & attribution -------------------------------------------------------
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  type text not null,
  citation text not null,
  url text,
  notes text not null default '',
  body_text text not null default '',
  file_path text,            -- Storage object path in a private bucket
  file_name text,
  file_mime text,
  file_size bigint,
  rights_confirmed boolean not null check (rights_confirmed),
  confidentiality_confirmed boolean not null check (confidentiality_confirmed),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lesson_attributions (
  id uuid primary key default gen_random_uuid(),
  lesson_id text references public.lessons (id) on delete cascade,
  draft_id uuid,
  source_id uuid references public.sources (id) on delete set null,
  title text not null,
  citation text not null,
  url text
);

-- Drafts & approval -----------------------------------------------------------
create table public.lesson_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  objective text not null default '',
  est_minutes int not null default 8,
  script text not null default '',
  content jsonb not null,          -- questions, scenario, concepts (validated app-side with Zod)
  uncertainties text[] not null default '{}',
  generated_by text not null check (generated_by in ('manual','template','ai')),
  ai_model text,
  generated_at timestamptz not null default now(),
  review_status text not null default 'draft' check (review_status in ('draft','in_review','changes_requested','approved')),
  review_notes text not null default '',
  reviewer_name text,
  reviewed_at timestamptz,
  published_lesson_id text references public.lessons (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.lesson_attributions
  add constraint lesson_attributions_draft_fk foreign key (draft_id) references public.lesson_drafts (id) on delete cascade;

-- Audio -----------------------------------------------------------------------
create table public.audio_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null references public.lessons (id) on delete cascade,
  storage_path text not null,      -- private bucket: audio/{user_id}/{id}
  file_name text not null,
  mime_type text not null check (mime_type in ('audio/mpeg','audio/wav','audio/x-wav','audio/wave','audio/vnd.wave')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  script_version int not null,
  provider text not null check (provider in ('manual_upload','onestudio')),
  created_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

-- Progress & review -----------------------------------------------------------
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null references public.lessons (id) on delete cascade,
  question_id text not null references public.questions (id) on delete cascade,
  kind text not null check (kind in ('recall','scenario')),
  context text not null check (context in ('lesson','review')),
  response text not null,
  result text not null check (result in ('correct','missed')),
  created_at timestamptz not null default now()
);

create table public.lesson_completions (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null references public.lessons (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null references public.lessons (id) on delete cascade,
  question_id text not null references public.questions (id) on delete cascade,
  concept_id text not null,
  track text not null check (track in ('correct','missed')),
  step int not null check (step >= 0),
  due_date date not null,          -- learner-local calendar date
  status text not null check (status in ('active','retired')),
  last_result text not null check (last_result in ('correct','missed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, question_id)
);
create index review_items_due on public.review_items (user_id, status, due_date);

create table public.review_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  review_item_id uuid not null references public.review_items (id) on delete cascade,
  lesson_id text not null,
  question_id text not null,
  context text not null check (context in ('lesson','review')),
  result text not null check (result in ('correct','missed')),
  occurred_on date not null,
  occurred_at timestamptz not null default now(),
  next_due_date date,
  reason text not null
);

-- Row-level security ----------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.learning_paths enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_script_versions enable row level security;
alter table public.concepts enable row level security;
alter table public.questions enable row level security;
alter table public.sources enable row level security;
alter table public.lesson_attributions enable row level security;
alter table public.lesson_drafts enable row level security;
alter table public.audio_assets enable row level security;
alter table public.attempts enable row level security;
alter table public.lesson_completions enable row level security;
alter table public.review_items enable row level security;
alter table public.review_events enable row level security;

-- Owner-only tables.
create policy own_profile on public.profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_sources on public.sources for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_drafts on public.lesson_drafts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_audio on public.audio_assets for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_attempts on public.attempts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_completions on public.lesson_completions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_review_items on public.review_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_review_events on public.review_events for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Seed content (owner_id null) is readable by any signed-in learner; custom content only by its owner.
create policy read_paths on public.learning_paths for select using (owner_id is null or owner_id = auth.uid());
create policy write_own_paths on public.learning_paths for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy read_lessons on public.lessons for select using (owner_id is null or owner_id = auth.uid());
create policy write_own_lessons on public.lessons for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy read_lesson_children_versions on public.lesson_script_versions for select
  using (exists (select 1 from public.lessons l where l.id = lesson_id and (l.owner_id is null or l.owner_id = auth.uid())));
create policy write_lesson_children_versions on public.lesson_script_versions for all
  using (exists (select 1 from public.lessons l where l.id = lesson_id and l.owner_id = auth.uid()))
  with check (exists (select 1 from public.lessons l where l.id = lesson_id and l.owner_id = auth.uid()));
create policy read_concepts on public.concepts for select
  using (exists (select 1 from public.lessons l where l.id = lesson_id and (l.owner_id is null or l.owner_id = auth.uid())));
create policy write_concepts on public.concepts for all
  using (exists (select 1 from public.lessons l where l.id = lesson_id and l.owner_id = auth.uid()))
  with check (exists (select 1 from public.lessons l where l.id = lesson_id and l.owner_id = auth.uid()));
create policy read_questions on public.questions for select
  using (exists (select 1 from public.lessons l where l.id = lesson_id and (l.owner_id is null or l.owner_id = auth.uid())));
create policy write_questions on public.questions for all
  using (exists (select 1 from public.lessons l where l.id = lesson_id and l.owner_id = auth.uid()))
  with check (exists (select 1 from public.lessons l where l.id = lesson_id and l.owner_id = auth.uid()));
create policy read_attributions on public.lesson_attributions for select using (
  (lesson_id is not null and exists (select 1 from public.lessons l where l.id = lesson_id and (l.owner_id is null or l.owner_id = auth.uid())))
  or (draft_id is not null and exists (select 1 from public.lesson_drafts d where d.id = draft_id and d.user_id = auth.uid()))
);
create policy write_attributions on public.lesson_attributions for all using (
  (lesson_id is not null and exists (select 1 from public.lessons l where l.id = lesson_id and l.owner_id = auth.uid()))
  or (draft_id is not null and exists (select 1 from public.lesson_drafts d where d.id = draft_id and d.user_id = auth.uid()))
) with check (
  (lesson_id is not null and exists (select 1 from public.lessons l where l.id = lesson_id and l.owner_id = auth.uid()))
  or (draft_id is not null and exists (select 1 from public.lesson_drafts d where d.id = draft_id and d.user_id = auth.uid()))
);

-- Storage: create private buckets `audio` and `sources`; objects live under
-- {user_id}/... and are readable/writable only by that user, e.g.
--   create policy "own audio" on storage.objects for all
--     using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text)
--     with check (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
