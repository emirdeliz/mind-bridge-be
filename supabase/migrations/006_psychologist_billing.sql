-- Platform billing: price per enabled patient, optional psychologist discounts, monthly history

create table if not exists public.billing_platform_pricing (
  id text primary key default 'default',
  price_per_patient_cents integer not null check (price_per_patient_cents >= 0),
  currency text not null default 'BRL',
  updated_at timestamptz not null default now()
);

create table if not exists public.psychologist_billing_discounts (
  psychologist_id uuid primary key references public.profiles (id) on delete cascade,
  discount_percent numeric(5, 2) not null check (
    discount_percent >= 0
    and discount_percent <= 100
  ),
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.psychologist_billing_monthly (
  id uuid primary key default gen_random_uuid(),
  psychologist_id uuid not null references public.profiles (id) on delete cascade,
  billing_month date not null,
  enabled_patient_count integer not null default 0 check (enabled_patient_count >= 0),
  unit_price_cents integer not null default 0 check (unit_price_cents >= 0),
  gross_amount_cents integer not null default 0 check (gross_amount_cents >= 0),
  discount_percent numeric(5, 2) not null default 0,
  discount_amount_cents integer not null default 0 check (discount_amount_cents >= 0),
  net_amount_cents integer not null default 0 check (net_amount_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (psychologist_id, billing_month)
);

create index if not exists psychologist_billing_monthly_psychologist_idx
  on public.psychologist_billing_monthly (psychologist_id, billing_month desc);

alter table public.billing_platform_pricing enable row level security;
alter table public.psychologist_billing_discounts enable row level security;
alter table public.psychologist_billing_monthly enable row level security;

create policy billing_platform_pricing_select on public.billing_platform_pricing
  for select
  using (auth.role() = 'authenticated');

create policy psychologist_billing_discounts_select on public.psychologist_billing_discounts
  for select
  using (auth.uid() = psychologist_id);

create policy psychologist_billing_monthly_select on public.psychologist_billing_monthly
  for select
  using (auth.uid() = psychologist_id);

insert into public.billing_platform_pricing (id, price_per_patient_cents, currency)
values ('default', 7990, 'BRL')
on conflict (id) do nothing;
