-- Tracks how many patient user messages were included in the last generated summary.

alter table public.patient_clinical_content
  add column if not exists patient_summary_user_message_count integer not null default 0;
