-- Ficha de anamnese do paciente (psicoterapia)

alter table public.patient_clinical_content
  add column if not exists anamnesis jsonb not null default '{}'::jsonb;
