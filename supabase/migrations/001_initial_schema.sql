-- Mind Bridge — initial schema (run in Supabase SQL editor or CLI)

create type public.user_role as enum ('patient', 'psychologist');
create type public.app_language as enum ('en', 'es', 'pt');
create type public.care_status as enum ('active', 'ended');

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role public.user_role not null,
  full_name text,
  age text,
  address text,
  phone text,
  language public.app_language default 'pt',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.care_relationships (
  id uuid primary key default gen_random_uuid(),
  psychologist_id uuid not null references public.profiles (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  status public.care_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (psychologist_id, patient_id)
);

alter table public.profiles enable row level security;
alter table public.care_relationships enable row level security;

-- Profiles: own row only
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id);

-- Care relationships: psychologist sees own links; patient sees own links
create policy care_psychologist_select on public.care_relationships
  for select using (auth.uid() = psychologist_id);

create policy care_patient_select on public.care_relationships
  for select using (auth.uid() = patient_id);

-- Auto-create profile on signup (service role or trigger)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role public.user_role;
begin
  user_role := coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'patient');

  insert into public.profiles (id, email, role)
  values (new.id, new.email, user_role);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
