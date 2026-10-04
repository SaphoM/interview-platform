-- ===========================================================================
-- Interview Platform — initial schema
-- Simple model: a submission (one interview attempt) has many answers,
-- each answer pointing at one question from the question bank.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- submissions — one row per interview attempt
-- ---------------------------------------------------------------------------
create table public.submissions (
  id           uuid primary key default gen_random_uuid(),
  intern_name  text not null,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- questions — the question bank, ordered by position
-- ---------------------------------------------------------------------------
create table public.questions (
  id       bigint generated always as identity primary key,
  prompt   text not null,
  position integer not null
);

-- ---------------------------------------------------------------------------
-- answers — one row per (submission, question)
-- ---------------------------------------------------------------------------
create table public.answers (
  submission_id uuid not null references public.submissions (id) on delete cascade,
  question_id   bigint not null references public.questions (id) on delete cascade,
  response      text,
  primary key (submission_id, question_id)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- The app is client-only (publishable key, no auth), so the anon role
-- needs read access to questions and read/write access to submissions
-- and answers. Tighten these policies once auth is added.
-- ---------------------------------------------------------------------------
alter table public.submissions enable row level security;
alter table public.questions   enable row level security;
alter table public.answers     enable row level security;

create policy questions_select on public.questions
  for select to anon using (true);

create policy submissions_select on public.submissions
  for select to anon using (true);

create policy submissions_insert on public.submissions
  for insert to anon with check (true);

create policy submissions_update on public.submissions
  for update to anon using (true) with check (true);

create policy answers_select on public.answers
  for select to anon using (true);

create policy answers_insert on public.answers
  for insert to anon with check (true);

create policy answers_update on public.answers
  for update to anon using (true) with check (true);
