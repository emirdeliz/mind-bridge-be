-- Demo / seed clinical content (dashboard, session notes, chat seeds)

create table if not exists public.patient_clinical_content (
  patient_id uuid primary key references public.profiles (id) on delete cascade,
  dashboard_snapshot jsonb not null default '{}',
  session_context text,
  session_notes jsonb not null default '[]',
  session_insights jsonb not null default '[]',
  psychologist_summary text,
  psychologist_chat_seed jsonb not null default '[]',
  patient_chat_seed jsonb not null default '[]',
  patient_summary text,
  updated_at timestamptz not null default now()
);

alter table public.patient_clinical_content enable row level security;

create policy patient_clinical_content_psychologist_select
  on public.patient_clinical_content
  for select
  using (
    exists (
      select 1
      from public.care_relationships cr
      where cr.psychologist_id = auth.uid()
        and cr.patient_id = patient_clinical_content.patient_id
        and cr.is_deleted = false
    )
  );

create policy patient_clinical_content_patient_select
  on public.patient_clinical_content
  for select
  using (auth.uid() = patient_id);
