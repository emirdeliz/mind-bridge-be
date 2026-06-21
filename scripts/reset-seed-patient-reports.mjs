#!/usr/bin/env node
/**
 * Reset day-to-day patient reports (relatos) for seed/demo patients.
 *
 * Clears chat history, interaction summary and Likert check-in so patients
 * can fill reports again from scratch.
 *
 * Usage:
 *   node --env-file=.env scripts/reset-seed-patient-reports.mjs
 *   node --env-file=.env scripts/reset-seed-patient-reports.mjs --restore
 *   node --env-file=.env scripts/reset-seed-patient-reports.mjs --email ana.demo@mindbridge.local
 *   node --env-file=.env scripts/reset-seed-patient-reports.mjs --dry-run
 *
 * Options:
 *   --restore   Restore patientChatSeed/patientSummary from demo-clinical-data (Likert still cleared)
 *   --email     Reset a single patient email (default: all seed patients)
 *   --dry-run   Print actions without writing to the database
 */

import { createClient } from '@supabase/supabase-js';

import { resolveDemoClinicalPayload } from './lib/demo-clinical-data.mjs';
import { SEED_PATIENT_EMAILS } from './lib/seed-patient-emails.mjs';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const restore = args.includes('--restore');
const emailArg = args.find((arg) => arg.startsWith('--email='));
const singleEmail = emailArg?.slice('--email='.length)?.trim().toLowerCase();

const targetEmails = singleEmail
  ? [singleEmail]
  : SEED_PATIENT_EMAILS;

const buildClearPayload = () => ({
  patient_chat_seed: [],
  patient_summary: null,
  patient_summary_user_message_count: 0,
  likert_check_in: null,
});

const buildRestorePayload = (email) => {
  const demo = resolveDemoClinicalPayload(email);
  if (!demo) {
    return buildClearPayload();
  }

  return {
    patient_chat_seed: demo.patientChatSeed ?? [],
    patient_summary: demo.patientSummary ?? null,
    patient_summary_user_message_count: (demo.patientChatSeed ?? []).filter(
      (message) => message.sender === 'user'
    ).length,
    likert_check_in: null,
  };
};

const resolvePatientIdByEmail = async (email) => {
  const { data, error } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .eq('email', email)
    .eq('role', 'patient')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load profile for ${email}: ${error.message}`);
  }

  return data;
};

const resetPatientReports = async (profile) => {
  const payload = restore
    ? buildRestorePayload(profile.email)
    : buildClearPayload();

  const chatCount = payload.patient_chat_seed.length;
  const summaryPreview = payload.patient_summary
    ? `${payload.patient_summary.slice(0, 60)}…`
    : '(empty)';

  if (dryRun) {
    console.log(
      `[dry-run] ${profile.email}: chat=${chatCount} msg(s), summary=${summaryPreview}, likert=cleared`
    );
    return { updated: false, skipped: false };
  }

  const { data: existing, error: existingError } = await admin
    .from('patient_clinical_content')
    .select('patient_id')
    .eq('patient_id', profile.id)
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `Failed to read clinical content for ${profile.email}: ${existingError.message}`
    );
  }

  if (!existing) {
    const { error: insertError } = await admin
      .from('patient_clinical_content')
      .insert({
        patient_id: profile.id,
        dashboard_snapshot: {
          moodTrendCategories: [],
          moodTrendSeries: [],
          weeklyInteractionCategories: [],
          weeklyInteractionSeries: [],
          interactionChannels: [],
          moodDiaryAdherencePercent: 0,
          clinicalThemeCategories: [],
          clinicalThemeSeries: [],
          lastUpdatedAt: new Date().toISOString(),
        },
        session_context: null,
        session_notes: [],
        session_insights: [],
        psychologist_summary: null,
        psychologist_chat_seed: [],
        ...payload,
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      throw new Error(
        `Failed to insert clinical content for ${profile.email}: ${insertError.message}`
      );
    }

    console.log(`Created + reset: ${profile.email} (${profile.full_name ?? profile.id})`);
    return { updated: true, skipped: false };
  }

  const { error: updateError } = await admin
    .from('patient_clinical_content')
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('patient_id', profile.id);

  if (updateError) {
    throw new Error(
      `Failed to reset reports for ${profile.email}: ${updateError.message}`
    );
  }

  console.log(
    `Reset: ${profile.email} (${profile.full_name ?? profile.id}) — chat=${chatCount}, summary=${summaryPreview}`
  );
  return { updated: true, skipped: false };
};

const main = async () => {
  const mode = restore ? 'restore demo relato' : 'clear relato';
  console.log(
    `Reset seed patient reports (${mode})${dryRun ? ' [dry-run]' : ''}…`
  );
  console.log(`Targets: ${targetEmails.length} email(s)`);

  let updated = 0;
  let missing = 0;

  for (const email of targetEmails) {
    const profile = await resolvePatientIdByEmail(email);
    if (!profile) {
      console.warn(`Skip (profile not found): ${email}`);
      missing += 1;
      continue;
    }

    const result = await resetPatientReports(profile);
    if (result.updated) {
      updated += 1;
    }
  }

  console.log(`Done. Updated: ${updated}, missing profiles: ${missing}.`);
  if (restore) {
    console.log('Note: Likert check-in was cleared for all patients (--restore only resets chat + summary).');
  } else {
    console.log('Cleared: patient_chat_seed, patient_summary, likert_check_in.');
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
