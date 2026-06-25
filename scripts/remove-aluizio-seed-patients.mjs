#!/usr/bin/env node
/**
 * Remove seed patients linked to Aluizio Vilar.
 *
 * - Shared demo patients (also on Emir): unlink from Aluizio only.
 * - Aluizio-only patients (Mauro, Carlos): delete auth user (full cascade).
 *
 * Usage:
 *   node --env-file=.env scripts/remove-aluizio-seed-patients.mjs --dry-run
 *   node --env-file=.env scripts/remove-aluizio-seed-patients.mjs --yes
 */

import { createClient } from '@supabase/supabase-js';

import {
  ALUIZIO_ONLY_SEED_PATIENT_EMAILS,
  ALUIZIO_PSYCHOLOGIST_EMAIL,
  ALUIZIO_SEED_PATIENT_EMAILS,
} from './lib/aluizio-seed-patients.mjs';

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
const dryRun = args.includes('--dry-run') || !args.includes('--yes');

const loadAluizioProfile = async () => {
  const { data, error } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .eq('email', ALUIZIO_PSYCHOLOGIST_EMAIL)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Aluizio profile: ${error.message}`);
  }

  return data;
};

const loadPatientProfileByEmail = async (email) => {
  const { data, error } = await admin
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load profile for ${email}: ${error.message}`);
  }

  return data;
};

const countCareLinksForPatient = async (patientId) => {
  const { count, error } = await admin
    .from('care_relationships')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', patientId);

  if (error) {
    throw new Error(`Failed to count care links: ${error.message}`);
  }

  return count ?? 0;
};

const unlinkPatientFromAluizio = async (aluizioId, patientId, label) => {
  if (dryRun) {
    console.log(`[dry-run] unlink ${label} from Aluizio`);
    return;
  }

  const { error } = await admin
    .from('care_relationships')
    .delete()
    .eq('psychologist_id', aluizioId)
    .eq('patient_id', patientId);

  if (error) {
    throw new Error(`Failed to unlink ${label}: ${error.message}`);
  }

  console.log(`Unlinked from Aluizio: ${label}`);
};

const deletePatientUser = async (patientId, label) => {
  if (dryRun) {
    console.log(`[dry-run] delete patient ${label} (${patientId})`);
    return;
  }

  const { error } = await admin.auth.admin.deleteUser(patientId);
  if (error) {
    throw new Error(`Failed to delete ${label}: ${error.message}`);
  }

  console.log(`Deleted patient: ${label}`);
};

const main = async () => {
  console.log(
    `Remove Aluizio seed patients${dryRun ? ' [dry-run]' : ''}…`
  );

  if (dryRun) {
    console.log('Pass --yes to apply changes.');
  }

  const aluizio = await loadAluizioProfile();
  if (!aluizio) {
    console.warn(`Psychologist not found: ${ALUIZIO_PSYCHOLOGIST_EMAIL}`);
    return;
  }

  const onlySet = new Set(
    ALUIZIO_ONLY_SEED_PATIENT_EMAILS.map((email) => email.toLowerCase())
  );

  let unlinked = 0;
  let deleted = 0;
  let missing = 0;

  for (const email of ALUIZIO_SEED_PATIENT_EMAILS) {
    const profile = await loadPatientProfileByEmail(email);
    if (!profile) {
      console.warn(`Skip (not found): ${email}`);
      missing += 1;
      continue;
    }

    if (profile.role !== 'patient') {
      console.warn(`Skip (not patient): ${email}`);
      continue;
    }

    const label = profile.full_name ?? email;
    const deleteEntirely = onlySet.has(email.toLowerCase());

    if (deleteEntirely) {
      const careCount = await countCareLinksForPatient(profile.id);
      if (careCount > 1) {
        await unlinkPatientFromAluizio(aluizio.id, profile.id, label);
        unlinked += 1;
        continue;
      }

      await deletePatientUser(profile.id, `${label} (${email})`);
      deleted += 1;
      continue;
    }

    await unlinkPatientFromAluizio(aluizio.id, profile.id, `${label} (${email})`);
    unlinked += 1;
  }

  console.log(
    `Done. Unlinked: ${unlinked}, deleted: ${deleted}, not found: ${missing}.`
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
