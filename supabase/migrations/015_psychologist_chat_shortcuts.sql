-- Atalhos do chat do copiloto de IA por psicólogo (label + mensagem em pt/en/es)

create table if not exists public.psychologist_chat_shortcuts (
  id uuid primary key default gen_random_uuid(),
  psychologist_id uuid not null references public.profiles (id) on delete cascade,
  sort_order integer not null default 0,
  translations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint psychologist_chat_shortcuts_translations_object check (
    jsonb_typeof(translations) = 'object'
  )
);

create index if not exists psychologist_chat_shortcuts_psychologist_sort_idx
  on public.psychologist_chat_shortcuts (psychologist_id, sort_order);

alter table public.psychologist_chat_shortcuts enable row level security;

create policy psychologist_chat_shortcuts_select_own on public.psychologist_chat_shortcuts
  for select using (auth.uid() = psychologist_id);
