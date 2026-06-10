-- Patient Likert check-in (self-report before/during AI interaction)

alter table public.patient_clinical_content
  add column if not exists likert_check_in jsonb;
