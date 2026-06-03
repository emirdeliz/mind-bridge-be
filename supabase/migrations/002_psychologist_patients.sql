-- Psychologist patient list: soft delete per care link + last consultation date

alter table public.care_relationships
  add column if not exists is_deleted boolean not null default false,
  add column if not exists last_consultation_at timestamptz;

create index if not exists care_relationships_psychologist_deleted_idx
  on public.care_relationships (psychologist_id, is_deleted);

create index if not exists profiles_full_name_idx
  on public.profiles (full_name);
