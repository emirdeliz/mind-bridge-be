-- Patient inputs (web / app) for dashboard interaction charts

create type public.patient_interaction_channel as enum (
  'text',
  'audio',
  'notification',
  'mood_diary'
);

create type public.patient_interaction_source as enum ('web', 'app');

create table if not exists public.patient_interactions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  channel public.patient_interaction_channel not null,
  source public.patient_interaction_source not null default 'web',
  mood_score smallint,
  created_at timestamptz not null default now(),
  constraint patient_interactions_mood_score_range
    check (mood_score is null or (mood_score >= 1 and mood_score <= 10))
);

create index if not exists patient_interactions_patient_created_idx
  on public.patient_interactions (patient_id, created_at desc);

alter table public.patient_interactions enable row level security;

create policy patient_interactions_patient_insert
  on public.patient_interactions
  for insert
  with check (auth.uid() = patient_id);

create policy patient_interactions_patient_select
  on public.patient_interactions
  for select
  using (auth.uid() = patient_id);

create policy patient_interactions_psychologist_select
  on public.patient_interactions
  for select
  using (
    exists (
      select 1
      from public.care_relationships cr
      where cr.psychologist_id = auth.uid()
        and cr.patient_id = patient_interactions.patient_id
        and cr.is_deleted = false
    )
  );
