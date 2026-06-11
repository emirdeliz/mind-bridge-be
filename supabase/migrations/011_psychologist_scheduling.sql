-- Agendamentos de consultas do psicólogo

create table if not exists public.psychologist_scheduling_settings (
  psychologist_id uuid primary key references public.profiles (id) on delete cascade,
  session_duration_minutes integer not null default 50 check (session_duration_minutes > 0),
  day_start_time time not null default '08:00',
  day_end_time time not null default '20:00',
  break_intervals jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.psychologist_appointments (
  id uuid primary key default gen_random_uuid(),
  psychologist_id uuid not null references public.profiles (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists psychologist_appointments_psychologist_starts_idx
  on public.psychologist_appointments (psychologist_id, starts_at);

create index if not exists psychologist_appointments_patient_idx
  on public.psychologist_appointments (patient_id, starts_at desc);

alter table public.psychologist_scheduling_settings enable row level security;
alter table public.psychologist_appointments enable row level security;
