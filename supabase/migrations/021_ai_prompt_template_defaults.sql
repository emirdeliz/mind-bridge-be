-- System default AI prompt content (editable by platform admins).

create table if not exists public.ai_prompt_template_defaults (
  key text primary key,
  translations jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint ai_prompt_template_defaults_translations_object check (
    jsonb_typeof(translations) = 'object'
  )
);

create index if not exists ai_prompt_template_defaults_updated_at_idx
  on public.ai_prompt_template_defaults (updated_at desc);

alter table public.ai_prompt_template_defaults enable row level security;

comment on table public.ai_prompt_templates is
  'Runtime prompt overrides (customizations) applied on top of ai_prompt_template_defaults.';

comment on table public.ai_prompt_template_defaults is
  'Platform-wide default prompt content used when no runtime override exists.';
