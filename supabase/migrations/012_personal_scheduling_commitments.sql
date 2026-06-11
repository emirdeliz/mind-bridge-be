-- Compromissos particulares na agenda (sem paciente vinculado)

alter table public.psychologist_appointments
  add column if not exists is_personal_commitment boolean not null default false;

alter table public.psychologist_appointments
  alter column patient_id drop not null;

alter table public.psychologist_appointments
  drop constraint if exists psychologist_appointments_patient_or_personal_check;

alter table public.psychologist_appointments
  add constraint psychologist_appointments_patient_or_personal_check
  check (
    (is_personal_commitment = true and patient_id is null)
    or (is_personal_commitment = false and patient_id is not null)
  );
