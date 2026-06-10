-- Patient-month billing: track disable time, audit events, daily snapshots, finalized months

alter table public.care_relationships
  add column if not exists disabled_at timestamptz;

create index if not exists care_relationships_psychologist_billing_idx
  on public.care_relationships (psychologist_id, created_at, disabled_at);

create type public.care_billing_event_type as enum ('enabled', 'disabled');

create table if not exists public.care_relationship_billing_events (
  id uuid primary key default gen_random_uuid(),
  care_relationship_id uuid not null references public.care_relationships (id) on delete cascade,
  psychologist_id uuid not null references public.profiles (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  event_type public.care_billing_event_type not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists care_relationship_billing_events_psychologist_idx
  on public.care_relationship_billing_events (psychologist_id, occurred_at desc);

create index if not exists care_relationship_billing_events_relationship_idx
  on public.care_relationship_billing_events (care_relationship_id, occurred_at desc);

create table if not exists public.psychologist_billing_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  psychologist_id uuid not null references public.profiles (id) on delete cascade,
  snapshot_date date not null,
  enabled_patient_count integer not null default 0 check (enabled_patient_count >= 0),
  patient_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (psychologist_id, snapshot_date)
);

create index if not exists psychologist_billing_daily_snapshots_psychologist_idx
  on public.psychologist_billing_daily_snapshots (psychologist_id, snapshot_date desc);

alter table public.psychologist_billing_monthly
  add column if not exists is_finalized boolean not null default false;

alter table public.care_relationship_billing_events enable row level security;
alter table public.psychologist_billing_daily_snapshots enable row level security;

create policy care_relationship_billing_events_select on public.care_relationship_billing_events
  for select
  using (auth.uid() = psychologist_id);

create policy psychologist_billing_daily_snapshots_select on public.psychologist_billing_daily_snapshots
  for select
  using (auth.uid() = psychologist_id);

-- Backfill disabled_at for already soft-deleted links (best-effort timestamp)
update public.care_relationships
set disabled_at = created_at
where is_deleted = true
  and disabled_at is null;

-- Backfill billing events from existing care links
insert into public.care_relationship_billing_events (
  care_relationship_id,
  psychologist_id,
  patient_id,
  event_type,
  occurred_at
)
select
  cr.id,
  cr.psychologist_id,
  cr.patient_id,
  'enabled'::public.care_billing_event_type,
  cr.created_at
from public.care_relationships cr
where not exists (
  select 1
  from public.care_relationship_billing_events e
  where e.care_relationship_id = cr.id
    and e.event_type = 'enabled'
);

insert into public.care_relationship_billing_events (
  care_relationship_id,
  psychologist_id,
  patient_id,
  event_type,
  occurred_at
)
select
  cr.id,
  cr.psychologist_id,
  cr.patient_id,
  'disabled'::public.care_billing_event_type,
  coalesce(cr.disabled_at, cr.created_at)
from public.care_relationships cr
where cr.is_deleted = true
  and not exists (
    select 1
    from public.care_relationship_billing_events e
    where e.care_relationship_id = cr.id
      and e.event_type = 'disabled'
  );
