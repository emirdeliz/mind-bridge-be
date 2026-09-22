-- Mind Bridge — schema completo (única migration)
-- Aplica: supabase db reset | supabase db push

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('patient', 'psychologist');
create type public.app_language as enum ('en', 'es', 'pt');
create type public.care_status as enum ('active', 'ended');
create type public.patient_interaction_channel as enum (
  'text',
  'audio',
  'notification',
  'mood_diary'
);
create type public.patient_interaction_source as enum ('web', 'app');
create type public.care_billing_event_type as enum ('enabled', 'disabled');

-- ---------------------------------------------------------------------------
-- Profiles & care relationships
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role public.user_role not null,
  full_name text,
  age text,
  address text,
  phone text,
  language public.app_language default 'pt',
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_full_name_idx on public.profiles (full_name);
create index profiles_is_admin_idx
  on public.profiles (is_admin)
  where is_admin = true;
create unique index profiles_single_admin_uidx
  on public.profiles ((true))
  where is_admin = true;

create table public.care_relationships (
  id uuid primary key default gen_random_uuid(),
  psychologist_id uuid not null references public.profiles (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  status public.care_status not null default 'active',
  is_deleted boolean not null default false,
  last_consultation_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (psychologist_id, patient_id)
);

create index care_relationships_psychologist_deleted_idx
  on public.care_relationships (psychologist_id, is_deleted);
create index care_relationships_psychologist_billing_idx
  on public.care_relationships (psychologist_id, created_at, disabled_at);

alter table public.profiles enable row level security;
alter table public.care_relationships enable row level security;

create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id);

create policy care_psychologist_select on public.care_relationships
  for select using (auth.uid() = psychologist_id);

create policy care_patient_select on public.care_relationships
  for select using (auth.uid() = patient_id);

-- Auto-create profile on signup (inclui phone do metadata)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role public.user_role;
  user_phone text;
begin
  user_role := coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'patient');
  user_phone := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');

  insert into public.profiles (id, email, role, phone)
  values (new.id, new.email, user_role, user_phone);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Clinical content & interactions
-- ---------------------------------------------------------------------------

create table public.patient_clinical_content (
  patient_id uuid primary key references public.profiles (id) on delete cascade,
  dashboard_snapshot jsonb not null default '{}',
  session_context text,
  session_notes jsonb not null default '[]',
  session_insights jsonb not null default '[]',
  psychologist_summary text,
  psychologist_chat_seed jsonb not null default '[]',
  patient_chat_seed jsonb not null default '[]',
  patient_summary text,
  likert_check_in jsonb,
  anamnesis jsonb not null default '{}'::jsonb,
  patient_summary_user_message_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.patient_clinical_content enable row level security;

create policy patient_clinical_content_psychologist_select
  on public.patient_clinical_content
  for select
  using (
    exists (
      select 1
      from public.care_relationships cr
      where cr.psychologist_id = auth.uid()
        and cr.patient_id = patient_clinical_content.patient_id
        and cr.is_deleted = false
    )
  );

create policy patient_clinical_content_patient_select
  on public.patient_clinical_content
  for select
  using (auth.uid() = patient_id);

create table public.patient_interactions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  channel public.patient_interaction_channel not null,
  source public.patient_interaction_source not null default 'web',
  mood_score smallint,
  created_at timestamptz not null default now(),
  constraint patient_interactions_mood_score_range
    check (mood_score is null or (mood_score >= 1 and mood_score <= 10))
);

create index patient_interactions_patient_created_idx
  on public.patient_interactions (patient_id, created_at desc);

alter table public.patient_interactions enable row level security;

create policy patient_interactions_patient_insert
  on public.patient_interactions
  for insert
  with check (auth.uid() = patient_id);

create policy patient_interactions_patient_select
  on public.patient_interactions
  for select
  using (auth.uid() = patient_id);

create policy patient_interactions_psychologist_select
  on public.patient_interactions
  for select
  using (
    exists (
      select 1
      from public.care_relationships cr
      where cr.psychologist_id = auth.uid()
        and cr.patient_id = patient_interactions.patient_id
        and cr.is_deleted = false
    )
  );

-- ---------------------------------------------------------------------------
-- Billing
-- ---------------------------------------------------------------------------

create table public.billing_platform_pricing (
  id text primary key default 'default',
  price_per_patient_cents integer not null check (price_per_patient_cents >= 0),
  currency text not null default 'BRL',
  updated_at timestamptz not null default now()
);

create table public.psychologist_billing_discounts (
  psychologist_id uuid primary key references public.profiles (id) on delete cascade,
  discount_percent numeric(5, 2) not null check (
    discount_percent >= 0
    and discount_percent <= 100
  ),
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.psychologist_billing_monthly (
  id uuid primary key default gen_random_uuid(),
  psychologist_id uuid not null references public.profiles (id) on delete cascade,
  billing_month date not null,
  enabled_patient_count integer not null default 0 check (enabled_patient_count >= 0),
  unit_price_cents integer not null default 0 check (unit_price_cents >= 0),
  gross_amount_cents integer not null default 0 check (gross_amount_cents >= 0),
  discount_percent numeric(5, 2) not null default 0,
  discount_amount_cents integer not null default 0 check (discount_amount_cents >= 0),
  net_amount_cents integer not null default 0 check (net_amount_cents >= 0),
  is_finalized boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (psychologist_id, billing_month)
);

create index psychologist_billing_monthly_psychologist_idx
  on public.psychologist_billing_monthly (psychologist_id, billing_month desc);

create table public.care_relationship_billing_events (
  id uuid primary key default gen_random_uuid(),
  care_relationship_id uuid not null references public.care_relationships (id) on delete cascade,
  psychologist_id uuid not null references public.profiles (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  event_type public.care_billing_event_type not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index care_relationship_billing_events_psychologist_idx
  on public.care_relationship_billing_events (psychologist_id, occurred_at desc);
create index care_relationship_billing_events_relationship_idx
  on public.care_relationship_billing_events (care_relationship_id, occurred_at desc);

create table public.psychologist_billing_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  psychologist_id uuid not null references public.profiles (id) on delete cascade,
  snapshot_date date not null,
  enabled_patient_count integer not null default 0 check (enabled_patient_count >= 0),
  patient_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (psychologist_id, snapshot_date)
);

create index psychologist_billing_daily_snapshots_psychologist_idx
  on public.psychologist_billing_daily_snapshots (psychologist_id, snapshot_date desc);

create table public.patient_session_payments (
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

create index patient_session_payments_psychologist_month_idx
  on public.patient_session_payments (psychologist_id, billing_month desc);
create index patient_session_payments_patient_idx
  on public.patient_session_payments (patient_id, billing_month desc);

alter table public.billing_platform_pricing enable row level security;
alter table public.psychologist_billing_discounts enable row level security;
alter table public.psychologist_billing_monthly enable row level security;
alter table public.care_relationship_billing_events enable row level security;
alter table public.psychologist_billing_daily_snapshots enable row level security;
alter table public.patient_session_payments enable row level security;

create policy billing_platform_pricing_select on public.billing_platform_pricing
  for select
  using (auth.role() = 'authenticated');

create policy psychologist_billing_discounts_select on public.psychologist_billing_discounts
  for select
  using (auth.uid() = psychologist_id);

create policy psychologist_billing_monthly_select on public.psychologist_billing_monthly
  for select
  using (auth.uid() = psychologist_id);

create policy care_relationship_billing_events_select on public.care_relationship_billing_events
  for select
  using (auth.uid() = psychologist_id);

create policy psychologist_billing_daily_snapshots_select on public.psychologist_billing_daily_snapshots
  for select
  using (auth.uid() = psychologist_id);

insert into public.billing_platform_pricing (id, price_per_patient_cents, currency)
values ('default', 7990, 'BRL')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Invite codes
-- ---------------------------------------------------------------------------

create table public.psychologist_invite_codes (
  psychologist_id uuid primary key references public.profiles (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index psychologist_invite_codes_code_idx
  on public.psychologist_invite_codes (code);

alter table public.psychologist_invite_codes enable row level security;

create policy psychologist_invite_codes_select_own on public.psychologist_invite_codes
  for select using (auth.uid() = psychologist_id);

-- ---------------------------------------------------------------------------
-- Scheduling
-- ---------------------------------------------------------------------------

create table public.psychologist_scheduling_settings (
  psychologist_id uuid primary key references public.profiles (id) on delete cascade,
  session_duration_minutes integer not null default 50 check (session_duration_minutes > 0),
  day_start_time time not null default '08:00',
  day_end_time time not null default '20:00',
  break_intervals jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.psychologist_appointments (
  id uuid primary key default gen_random_uuid(),
  psychologist_id uuid not null references public.profiles (id) on delete cascade,
  patient_id uuid references public.profiles (id) on delete cascade,
  is_personal_commitment boolean not null default false,
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint psychologist_appointments_patient_or_personal_check
    check (
      (is_personal_commitment = true and patient_id is null)
      or (is_personal_commitment = false and patient_id is not null)
    )
);

create index psychologist_appointments_psychologist_starts_idx
  on public.psychologist_appointments (psychologist_id, starts_at);
create index psychologist_appointments_patient_idx
  on public.psychologist_appointments (patient_id, starts_at desc);

alter table public.psychologist_scheduling_settings enable row level security;
alter table public.psychologist_appointments enable row level security;

-- ---------------------------------------------------------------------------
-- Copilot chat shortcuts
-- ---------------------------------------------------------------------------

create table public.psychologist_chat_shortcuts (
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

create index psychologist_chat_shortcuts_psychologist_sort_idx
  on public.psychologist_chat_shortcuts (psychologist_id, sort_order);

alter table public.psychologist_chat_shortcuts enable row level security;

create policy psychologist_chat_shortcuts_select_own on public.psychologist_chat_shortcuts
  for select using (auth.uid() = psychologist_id);

-- ---------------------------------------------------------------------------
-- Knowledge RAG (pgvector)
-- ---------------------------------------------------------------------------

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_name text not null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  chunk_count int not null default 0,
  status text not null default 'active' check (status in ('active', 'archived')),
  index_status text not null default 'pending'
    check (index_status in ('pending', 'indexing', 'indexed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  chunk_index int not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index knowledge_documents_status_idx
  on public.knowledge_documents (status);
create unique index knowledge_documents_owner_file_active_uidx
  on public.knowledge_documents (uploaded_by, lower(file_name))
  where status = 'active' and uploaded_by is not null;
create index knowledge_documents_uploaded_by_status_idx
  on public.knowledge_documents (uploaded_by, status);
create index knowledge_documents_index_status_idx
  on public.knowledge_documents (index_status)
  where status = 'active';
create index knowledge_chunks_document_id_idx
  on public.knowledge_chunks (document_id);
create index knowledge_chunks_embedding_idx
  on public.knowledge_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;

create or replace function public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_count int default 5,
  psychologist_ids uuid[] default null
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    kc.id,
    kc.document_id,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks kc
  inner join public.knowledge_documents kd on kd.id = kc.document_id
  where kd.status = 'active'
    and kd.index_status = 'indexed'
    and (
      psychologist_ids is null
      or cardinality(psychologist_ids) = 0
      or kd.uploaded_by = any(psychologist_ids)
    )
  order by kc.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

-- ---------------------------------------------------------------------------
-- AI prompt templates
-- ---------------------------------------------------------------------------

create table public.ai_prompt_templates (
  key text primary key,
  translations jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint ai_prompt_templates_translations_object check (
    jsonb_typeof(translations) = 'object'
  )
);

create index ai_prompt_templates_updated_at_idx
  on public.ai_prompt_templates (updated_at desc);

alter table public.ai_prompt_templates enable row level security;

create table public.ai_prompt_template_defaults (
  key text primary key,
  translations jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint ai_prompt_template_defaults_translations_object check (
    jsonb_typeof(translations) = 'object'
  )
);

create index ai_prompt_template_defaults_updated_at_idx
  on public.ai_prompt_template_defaults (updated_at desc);

alter table public.ai_prompt_template_defaults enable row level security;

create table public.psychologist_ai_prompt_templates (
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

create index psychologist_ai_prompt_templates_psychologist_idx
  on public.psychologist_ai_prompt_templates (psychologist_id, updated_at desc);

alter table public.psychologist_ai_prompt_templates enable row level security;

comment on table public.ai_prompt_templates is
  'Runtime prompt overrides (customizations) applied on top of ai_prompt_template_defaults.';
comment on table public.ai_prompt_template_defaults is
  'Platform-wide default prompt content used when no runtime override exists.';
comment on table public.psychologist_ai_prompt_templates is
  'Psychologist-specific prompt overrides layered on ai_prompt_template_defaults.';
