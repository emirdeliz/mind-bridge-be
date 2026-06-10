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

const ALUIZIO_PSYCHOLOGIST = {
  fullName: 'Aluizio Vilar',
  email: 'aluizio.vilar@gmail.com',
  phone: null,
  password: 'Data@123',
};

/** Months ago (0 = current month) when the patient started counting for billing. */
const DEMO_PATIENTS = [
  {
    fullName: 'Ana M.',
    email: 'ana.demo@mindbridge.local',
    phone: '11987654321',
    password: 'demo123456',
    lastConsultationAt: '2026-05-28T14:00:00.000Z',
    isDeleted: false,
    enabledSinceMonthsAgo: 5,
  },
  {
    fullName: 'Bruno Costa',
    email: 'bruno.demo@mindbridge.local',
    phone: '11976543210',
    password: 'demo123456',
    lastConsultationAt: '2026-05-20T10:30:00.000Z',
    isDeleted: false,
    enabledSinceMonthsAgo: 2,
  },
  {
    fullName: 'Carla Mendes',
    email: 'carla.demo@mindbridge.local',
    phone: '21999887766',
    password: 'demo123456',
    lastConsultationAt: '2026-04-15T16:00:00.000Z',
    isDeleted: false,
    enabledSinceMonthsAgo: 4,
  },
  {
    fullName: 'Diego Ribeiro',
    email: 'diego.demo@mindbridge.local',
    phone: '31988776655',
    password: 'demo123456',
    lastConsultationAt: null,
    isDeleted: false,
    enabledSinceMonthsAgo: 1,
  },
  {
    fullName: 'Elisa Ferreira',
    email: 'elisa.demo@mindbridge.local',
    phone: '41977665544',
    password: 'demo123456',
    lastConsultationAt: '2026-03-10T09:00:00.000Z',
    isDeleted: true,
    enabledSinceMonthsAgo: 3,
    /** Disabled at the start of the current month — still billable this month (patient-month). */
    disabledSinceMonthsAgo: 0,
  },
];

const EMIR_PATIENTS = [
  {
    fullName: 'José Carlos',
    email: 'josecarlos@gmail.com',
    phone: '43423213213',
    password: 'Data@123',
    lastConsultationAt: null,
    isDeleted: false,
    enabledSinceMonthsAgo: 0,
  },
  ...DEMO_PATIENTS,
];

const ALUIZIO_PATIENTS = [
  {
    fullName: 'Mauro Souza',
    email: 'maurosouza@gmail.com',
    phone: null,
    password: 'Data@123',
    lastConsultationAt: null,
    isDeleted: false,
    enabledSinceMonthsAgo: 0,
  },
];

const PSYCHOLOGIST_ACCOUNTS = [
  { psychologist: DEMO_PSYCHOLOGIST, patients: [] },
  { psychologist: EMIR_PSYCHOLOGIST, patients: EMIR_PATIENTS },
  { psychologist: ALUIZIO_PSYCHOLOGIST, patients: ALUIZIO_PATIENTS },
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

const linkedAtFromMonthsAgo = (monthsAgo = 0) => {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCMonth(date.getUTCMonth() - monthsAgo);
  return date.toISOString();
};

const resolveDisabledAt = (demo) => {
  if (!demo.isDeleted) {
    return null;
  }

  return linkedAtFromMonthsAgo(demo.disabledSinceMonthsAgo ?? 0);
};

const seedCareBillingEvents = async (
  careRelationshipId,
  psychologistId,
  patientId,
  enabledAt,
  disabledAt
) => {
  await admin
    .from('care_relationship_billing_events')
    .delete()
    .eq('care_relationship_id', careRelationshipId);

  const events = [
    {
      care_relationship_id: careRelationshipId,
      psychologist_id: psychologistId,
      patient_id: patientId,
      event_type: 'enabled',
      occurred_at: enabledAt,
    },
  ];

  if (disabledAt) {
    events.push({
      care_relationship_id: careRelationshipId,
      psychologist_id: psychologistId,
      patient_id: patientId,
      event_type: 'disabled',
      occurred_at: disabledAt,
    });
  }

  const { error } = await admin.from('care_relationship_billing_events').insert(events);
  if (error) {
    throw new Error(`Billing events ${careRelationshipId}: ${error.message}`);
  }
};

const linkPatient = async (psychologistId, patientId, demo) => {
  const { data: existingCare } = await admin
    .from('care_relationships')
    .select('id')
    .eq('psychologist_id', psychologistId)
    .eq('patient_id', patientId)
    .maybeSingle();

  const linkedAt = linkedAtFromMonthsAgo(demo.enabledSinceMonthsAgo ?? 0);
  const disabledAt = resolveDisabledAt(demo);
  const carePayload = {
    psychologist_id: psychologistId,
    patient_id: patientId,
    status: 'active',
    is_deleted: demo.isDeleted,
    last_consultation_at: demo.lastConsultationAt,
    created_at: linkedAt,
    disabled_at: disabledAt,
  };

  let careRelationshipId = existingCare?.id;

  if (!existingCare) {
    const { data: insertedCare, error: careError } = await admin
      .from('care_relationships')
      .insert(carePayload)
      .select('id')
      .single();
    if (careError) {
      throw new Error(`Care link ${demo.email}: ${careError.message}`);
    }
    careRelationshipId = insertedCare.id;
  } else {
    const { error: careError } = await admin
      .from('care_relationships')
      .update(carePayload)
      .eq('id', existingCare.id);
    if (careError) {
      throw new Error(`Care link ${demo.email}: ${careError.message}`);
    }
  }

  await seedCareBillingEvents(
    careRelationshipId,
    psychologistId,
    patientId,
    linkedAt,
    disabledAt
  );
};

const PLATFORM_PRICE_CENTS = 7990;

const BILLING_DISCOUNTS_BY_EMAIL = {
  'psicologo.demo@mindbridge.local': {
    discount_percent: 10,
    label: 'Desconto early adopter',
  },
  'emirdeliz@gmail.com': {
    discount_percent: 15,
    label: 'Desconto parceiro fundador',
  },
};

const billingMonthBoundsFromOffset = (monthOffset) => {
  const monthStart = new Date(linkedAtFromMonthsAgo(monthOffset));
  const monthEndExclusive = new Date(monthStart);
  monthEndExclusive.setUTCMonth(monthEndExclusive.getUTCMonth() + 1);
  return { monthStart, monthEndExclusive };
};

const countBillablePatientsForMonth = (patients, monthOffset) => {
  const { monthStart, monthEndExclusive } = billingMonthBoundsFromOffset(monthOffset);
  const billableEmails = new Set();

  for (const patient of patients) {
    const enabledAt = new Date(linkedAtFromMonthsAgo(patient.enabledSinceMonthsAgo ?? 0));
    const disabledAt = patient.isDeleted
      ? new Date(linkedAtFromMonthsAgo(patient.disabledSinceMonthsAgo ?? 0))
      : null;

    const overlapsMonth =
      enabledAt < monthEndExclusive &&
      (disabledAt === null || disabledAt > monthStart);

    if (overlapsMonth) {
      billableEmails.add(patient.email);
    }
  }

  return billableEmails.size;
};

const seedBillingForPsychologist = async (psychologistId, email, patients) => {
  await admin.from('billing_platform_pricing').upsert(
    {
      id: 'default',
      price_per_patient_cents: PLATFORM_PRICE_CENTS,
      currency: 'BRL',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  const discount = BILLING_DISCOUNTS_BY_EMAIL[email];
  if (discount) {
    const { error: discountError } = await admin
      .from('psychologist_billing_discounts')
      .upsert(
        {
          psychologist_id: psychologistId,
          discount_percent: discount.discount_percent,
          label: discount.label,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'psychologist_id' }
      );
    if (discountError) {
      throw new Error(`Billing discount ${email}: ${discountError.message}`);
    }
  }

  const monthsBack = 5;
  for (let offset = monthsBack; offset >= 0; offset -= 1) {
    const monthDate = new Date();
    monthDate.setUTCDate(1);
    monthDate.setUTCMonth(monthDate.getUTCMonth() - offset);
    const billingMonth = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, '0')}-01`;
    const patientCount = countBillablePatientsForMonth(patients, offset);
    const grossAmountCents = patientCount * PLATFORM_PRICE_CENTS;
    const discountPercent = discount?.discount_percent ?? 0;
    const discountAmountCents = Math.round(grossAmountCents * (discountPercent / 100));
    const netAmountCents = grossAmountCents - discountAmountCents;

    const { error: monthlyError } = await admin
      .from('psychologist_billing_monthly')
      .upsert(
        {
          psychologist_id: psychologistId,
          billing_month: billingMonth,
          enabled_patient_count: patientCount,
          unit_price_cents: PLATFORM_PRICE_CENTS,
          gross_amount_cents: grossAmountCents,
          discount_percent: discountPercent,
          discount_amount_cents: discountAmountCents,
          net_amount_cents: netAmountCents,
          is_finalized: offset > 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'psychologist_id,billing_month' }
      );

    if (monthlyError) {
      throw new Error(`Billing monthly ${email} ${billingMonth}: ${monthlyError.message}`);
    }
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

  await seedBillingForPsychologist(psychologistId, psychologist.email, patients);
};

const main = async () => {
  console.log('Seeding local dev data…');
  await assertServiceRoleKey();

  for (const account of PSYCHOLOGIST_ACCOUNTS) {
    await seedPsychologistAccount(account.psychologist, account.patients);
  }

  console.log('Done.');
  console.log('Login demo psychologist:', DEMO_PSYCHOLOGIST.email, '/', DEMO_PSYCHOLOGIST.password);
  console.log('Login Emir (psychologist):', EMIR_PSYCHOLOGIST.email, '/', EMIR_PSYCHOLOGIST.password);
  console.log(
    'Login Aluizio (psychologist):',
    ALUIZIO_PSYCHOLOGIST.email,
    '/',
    ALUIZIO_PSYCHOLOGIST.password
  );
  console.log('Login José Carlos (patient):', EMIR_PATIENTS[0].email, '/', EMIR_PATIENTS[0].password);
  console.log(
    'Login Mauro Souza (patient):',
    ALUIZIO_PATIENTS[0].email,
    '/',
    ALUIZIO_PATIENTS[0].password
  );
  console.log('Login demo patient (Ana):', DEMO_PATIENTS[0].email, '/', DEMO_PATIENTS[0].password);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
