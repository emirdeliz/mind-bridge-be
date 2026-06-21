#!/usr/bin/env node
/**
 * Delete all seed/demo patients except Mauro Souza (maurosouza@gmail.com).
 *
 * Removes auth users; related rows cascade (profiles, care links, clinical
 * content, interactions, payments, appointments, etc.).
 *
 * Usage:
 *   node --env-file=.env scripts/delete-seed-patients-except.mjs --dry-run
 *   node --env-file=.env scripts/delete-seed-patients-except.mjs --yes
 *
 * Options:
 *   --dry-run   List patients that would be deleted (default without --yes)
 *   --yes       Actually delete users (required to write)
 *   --email     Delete a single seed email (still skips Mauro Souza)
 */

import { createClient } from '@supabase/supabase-js';

import {
  KEEP_SEED_PATIENT_EMAIL,
  SEED_PATIENT_EMAILS,
} from './lib/seed-patient-emails.mjs';

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
const emailArg = args.find((arg) => arg.startsWith('--email='));
const singleEmail = emailArg?.slice('--email='.length)?.trim().toLowerCase();

const resolveTargetEmails = () => {
  const candidates = singleEmail ? [singleEmail] : SEED_PATIENT_EMAILS;

  if (
    singleEmail &&
    singleEmail.toLowerCase() === KEEP_SEED_PATIENT_EMAIL
  ) {
    console.error(
      `Refusing to delete protected patient: ${KEEP_SEED_PATIENT_EMAIL} (Mauro Souza)`
    );
    process.exit(1);
  }

  return [
    ...new Set(
      candidates.filter(
        (email) => email.toLowerCase() !== KEEP_SEED_PATIENT_EMAIL
      )
    ),
  ].sort();
};

const findAuthUserByEmail = async (email) => {
  const normalized = email.trim().toLowerCase();
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const found = data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalized
    );
    if (found) {
      return found;
    }

    if (data.users.length < perPage) {
      break;
    }
    page += 1;
  }

  return null;
};

const loadPatientProfile = async (email) => {
  const { data, error } = await admin
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load profile for ${email}: ${error.message}`);
  }

  if (data && data.role !== 'patient') {
    throw new Error(
      `Profile ${email} is role=${data.role}, expected patient — skipped for safety`
    );
  }

  return data;
};

const deletePatient = async (email) => {
  const profile = await loadPatientProfile(email);
  const authUser = await findAuthUserByEmail(email);

  if (!profile && !authUser) {
    console.warn(`Skip (not found): ${email}`);
    return { deleted: false, missing: true };
  }

  const label = profile?.full_name ?? authUser?.user_metadata?.full_name ?? email;
  const userId = profile?.id ?? authUser.id;

  if (dryRun) {
    console.log(`[dry-run] delete ${email} (${label}) — id=${userId}`);
    return { deleted: false, missing: false };
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(`Failed to delete ${email}: ${error.message}`);
  }

  console.log(`Deleted: ${email} (${label})`);
  return { deleted: true, missing: false };
};

const main = async () => {
  const targetEmails = resolveTargetEmails();

  console.log(
    `Delete seed patients except Mauro Souza (${KEEP_SEED_PATIENT_EMAIL})${
      dryRun ? ' [dry-run]' : ''
    }…`
  );
  console.log(`Targets: ${targetEmails.length} email(s)`);

  if (!dryRun) {
    console.log('Deleting auth users (cascade removes related data)…');
  } else {
    console.log('Pass --yes to perform deletions.');
  }

  let deleted = 0;
  let missing = 0;

  for (const email of targetEmails) {
    const result = await deletePatient(email);
    if (result.deleted) {
      deleted += 1;
    }
    if (result.missing) {
      missing += 1;
    }
  }

  console.log(`Done. Deleted: ${deleted}, not found: ${missing}.`);
  console.log(`Kept: ${KEEP_SEED_PATIENT_EMAIL} (Mauro Souza).`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
