-- Psychologist invite codes for patient self-registration

create table if not exists public.psychologist_invite_codes (
  psychologist_id uuid primary key references public.profiles (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists psychologist_invite_codes_code_idx
  on public.psychologist_invite_codes (code);

alter table public.psychologist_invite_codes enable row level security;

-- Psychologists may read their own invite code (writes use service role)
create policy psychologist_invite_codes_select_own on public.psychologist_invite_codes
  for select using (auth.uid() = psychologist_id);
