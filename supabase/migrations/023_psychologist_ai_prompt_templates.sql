-- Per-psychologist AI prompt overrides (applied on top of platform defaults).

create table if not exists public.psychologist_ai_prompt_templates (
  psychologist_id uuid not null references public.profiles (id) on delete cascade,
  key text not null,
  translations jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (psychologist_id, key),
  constraint psychologist_ai_prompt_templates_translations_object check (
    jsonb_typeof(translations) = 'object'
  )
);

create index if not exists psychologist_ai_prompt_templates_psychologist_idx
  on public.psychologist_ai_prompt_templates (psychologist_id, updated_at desc);

alter table public.psychologist_ai_prompt_templates enable row level security;

comment on table public.psychologist_ai_prompt_templates is
  'Psychologist-specific prompt overrides layered on ai_prompt_template_defaults.';
