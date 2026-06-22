-- Platform-wide AI prompt overrides (defaults live in application code).

create table if not exists public.ai_prompt_templates (
  key text primary key,
  translations jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint ai_prompt_templates_translations_object check (
    jsonb_typeof(translations) = 'object'
  )
);

create index if not exists ai_prompt_templates_updated_at_idx
  on public.ai_prompt_templates (updated_at desc);

alter table public.ai_prompt_templates enable row level security;
