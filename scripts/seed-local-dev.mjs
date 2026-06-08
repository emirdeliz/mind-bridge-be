#!/usr/bin/env node
/**
 * Local dev seed: demo psychologist, patients, care links, clinical content.
 * Usage: node --env-file=.env scripts/seed-local-dev.mjs
 * After: npm run supabase:reset (runs this via package.json)
 */

import { createClient } from '@supabase/supabase-js';
import { DEMO_CLINICAL_BY_EMAIL } from './lib/demo-clinical-data.mjs';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const isInvalidJwtError = (message) =>
  typeof message === 'string' &&
  (message.includes('invalid JWT') ||
    message.includes('signature is invalid') ||
    message.includes('unable to parse or verify signature'));

const assertServiceRoleKey = async () => {
  const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (!error) {
    return;
  }

  if (isInvalidJwtError(error.message)) {
    console.error(
      'SUPABASE_SERVICE_ROLE_KEY no .env não confere com o Supabase local (JWT inválido).'
    );
    console.error('Com o stack rodando, execute: npm run supabase:env');
    console.error('Depois: npm run seed:local   (ou npm run supabase:reset)');
    process.exit(1);
  }

  throw new Error(`Auth admin check failed: ${error.message}`);
};

const DEMO_PSYCHOLOGIST = {
  fullName: 'Psicólogo Demo',
  email: 'psicologo.demo@mindbridge.local',
  phone: '11999990000',
  password: 'demo123456',
};

const EMIR_PSYCHOLOGIST = {
  fullName: 'Emir Marques',
  email: 'emirdeliz@gmail.com',
  phone: null,
  password: 'Data@123',
};

const EMIR_PATIENTS = [
  {
    fullName: 'José Carlos',
    email: 'josecarlos@gmail.com',
    phone: '43423213213',
    password: 'Data@123',
    lastConsultationAt: null,
    isDeleted: false,
  },
];

const PSYCHOLOGIST_ACCOUNTS = [
  { psychologist: DEMO_PSYCHOLOGIST, patients: null },
  { psychologist: EMIR_PSYCHOLOGIST, patients: EMIR_PATIENTS },
];

const DEMO_PATIENTS = [
  {
    fullName: 'Ana M.',
    email: 'ana.demo@mindbridge.local',
    phone: '11987654321',
    password: 'demo123456',
    lastConsultationAt: '2026-05-28T14:00:00.000Z',
    isDeleted: false,
  },
  {
    fullName: 'Bruno Costa',
    email: 'bruno.demo@mindbridge.local',
    phone: '11976543210',
    password: 'demo123456',
    lastConsultationAt: '2026-05-20T10:30:00.000Z',
    isDeleted: false,
  },
  {
    fullName: 'Carla Mendes',
    email: 'carla.demo@mindbridge.local',
    phone: '21999887766',
    password: 'demo123456',
    lastConsultationAt: '2026-04-15T16:00:00.000Z',
    isDeleted: false,
  },
  {
    fullName: 'Diego Ribeiro',
    email: 'diego.demo@mindbridge.local',
    phone: '31988776655',
    password: 'demo123456',
    lastConsultationAt: null,
    isDeleted: false,
  },
  {
    fullName: 'Elisa Ferreira',
    email: 'elisa.demo@mindbridge.local',
    phone: '41977665544',
    password: 'demo123456',
    lastConsultationAt: '2026-03-10T09:00:00.000Z',
    isDeleted: true,
  },
];

const ensureAuthUser = async ({ email, password, role, fullName, phone }) => {
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  let userId = existingProfile?.id;

  if (!userId) {
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, phone },
    });

    if (authError) {
      if (isInvalidJwtError(authError.message)) {
        console.error(
          'SUPABASE_SERVICE_ROLE_KEY no .env não confere com o Supabase local (JWT inválido).'
        );
        console.error('Com o stack rodando, execute: npm run supabase:env');
        console.error('Depois: npm run seed:local   (ou npm run supabase:reset)');
        process.exit(1);
      }
      throw new Error(`${email}: ${authError.message}`);
    }

    userId = authData.user.id;
  }

  await admin
    .from('profiles')
    .update({
      full_name: fullName,
      phone,
      language: 'pt',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  return userId;
};

const linkPatient = async (psychologistId, patientId, demo) => {
  const { data: existingCare } = await admin
    .from('care_relationships')
    .select('id')
    .eq('psychologist_id', psychologistId)
    .eq('patient_id', patientId)
    .maybeSingle();

  const carePayload = {
    psychologist_id: psychologistId,
    patient_id: patientId,
    status: 'active',
    is_deleted: demo.isDeleted,
    last_consultation_at: demo.lastConsultationAt,
  };

  if (!existingCare) {
    const { error: careError } = await admin.from('care_relationships').insert(carePayload);
    if (careError) {
      throw new Error(`Care link ${demo.email}: ${careError.message}`);
    }
  } else {
    await admin.from('care_relationships').update(carePayload).eq('id', existingCare.id);
  }
};

const upsertClinical = async (patientId, email) => {
  const payload = DEMO_CLINICAL_BY_EMAIL[email];
  if (!payload) {
    return;
  }

  const { error } = await admin.from('patient_clinical_content').upsert(
    {
      patient_id: patientId,
      dashboard_snapshot: payload.dashboardSnapshot,
      session_context: payload.sessionContext,
      session_notes: payload.sessionNotes,
      session_insights: payload.sessionInsights,
      psychologist_summary: payload.psychologistSummary,
      psychologist_chat_seed: payload.psychologistChatSeed,
      patient_chat_seed: payload.patientChatSeed,
      patient_summary: payload.patientSummary,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'patient_id' }
  );

  if (error) {
    throw new Error(`Clinical ${email}: ${error.message}`);
  }
};

const seedPsychologistAccount = async (psychologist, patients) => {
  const psychologistId = await ensureAuthUser({
    ...psychologist,
    phone: psychologist.phone ?? '',
    role: 'psychologist',
  });
  console.log(`Psychologist: ${psychologist.email} (${psychologistId})`);

  for (const demo of patients) {
    const patientId = await ensureAuthUser({
      email: demo.email,
      password: demo.password,
      role: 'patient',
      fullName: demo.fullName,
      phone: demo.phone,
    });

    await linkPatient(psychologistId, patientId, demo);
    await upsertClinical(patientId, demo.email);

    console.log(`  Patient: ${demo.fullName} (${demo.email})`);
  }
};

const main = async () => {
  console.log('Seeding local dev data…');
  await assertServiceRoleKey();

  PSYCHOLOGIST_ACCOUNTS[0].patients = DEMO_PATIENTS;

  for (const account of PSYCHOLOGIST_ACCOUNTS) {
    await seedPsychologistAccount(account.psychologist, account.patients);
  }

  console.log('Done.');
  console.log('Login demo psychologist:', DEMO_PSYCHOLOGIST.email, '/', DEMO_PSYCHOLOGIST.password);
  console.log('Login demo patient (Ana):', DEMO_PATIENTS[0].email, '/', DEMO_PATIENTS[0].password);
  console.log('Login Emir (psychologist):', EMIR_PSYCHOLOGIST.email, '/', EMIR_PSYCHOLOGIST.password);
  console.log('Login José Carlos (patient):', EMIR_PATIENTS[0].email, '/', EMIR_PATIENTS[0].password);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
