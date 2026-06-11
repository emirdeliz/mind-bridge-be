-- Pagamentos de sessão registrados pelo psicólogo (por paciente e mês)

create table if not exists public.patient_session_payments (
  id uuid primary key default gen_random_uuid(),
  psychologist_id uuid not null references public.profiles (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  billing_month date not null,
  amount_cents integer not null check (amount_cents > 0),
  paid_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (psychologist_id, patient_id, billing_month)
);

create index if not exists patient_session_payments_psychologist_month_idx
  on public.patient_session_payments (psychologist_id, billing_month desc);

create index if not exists patient_session_payments_patient_idx
  on public.patient_session_payments (patient_id, billing_month desc);

alter table public.patient_session_payments enable row level security;
