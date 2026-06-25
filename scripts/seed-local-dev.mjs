#!/usr/bin/env node
/**
 * Local dev seed: demo psychologist, patients, care links, clinical content.
 * Usage: node --env-file=.env scripts/seed-local-dev.mjs
 * After: npm run supabase:reset (runs this via package.json)
 */

import { createClient } from '@supabase/supabase-js';
import {
  DEMO_INTERACTION_SPECS_BY_EMAIL,
  resolveDemoClinicalPayload,
} from './lib/demo-clinical-data.mjs';
import { DEFAULT_PSYCHOLOGIST_CHAT_SHORTCUTS } from './lib/default-psychologist-chat-shortcuts.mjs';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const isCloudSupabaseUrl = (value) =>
  typeof value === 'string' && value.includes('supabase.co');

const isInvalidJwtError = (message) =>
  typeof message === 'string' &&
  (message.includes('invalid JWT') ||
    message.includes('signature is invalid') ||
    message.includes('unable to parse or verify signature'));

const isUserAlreadyRegisteredError = (message) =>
  typeof message === 'string' &&
  (message.includes('already been registered') ||
    message.includes('already registered') ||
    message.includes('User already registered'));

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

const isMissingSchemaError = (error) => {
  const message = error?.message ?? '';
  const code = error?.code ?? '';
  return (
    code === 'PGRST205' ||
    message.includes('schema cache') ||
    message.includes("Could not find the table 'public.profiles'")
  );
};

const assertDatabaseSchema = async () => {
  const { error } = await admin.from('profiles').select('id').limit(1);

  if (!error) {
    return;
  }

  if (isMissingSchemaError(error)) {
    console.error('Tabela public.profiles não existe no Supabase.');
    if (isCloudSupabaseUrl(url)) {
      console.error('Aplique as migrations no Cloud antes do seed:');
      console.error('  npm run supabase:push:cloud');
      console.error('ou use o fluxo completo:');
      console.error('  yarn seed:cloud');
    } else {
      console.error('Execute: npm run supabase:reset');
    }
    process.exit(1);
  }

  throw new Error(`Schema check failed: ${error.message}`);
};

const assertServiceRoleKey = async () => {
  const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (!error) {
    return;
  }

  if (isInvalidJwtError(error.message)) {
    console.error(
      'SUPABASE_SERVICE_ROLE_KEY no .env não confere com SUPABASE_URL (JWT inválido).'
    );
    if (!isCloudSupabaseUrl(url)) {
      console.error(
        'Supabase local: com o stack rodando, execute: npm run supabase:env'
      );
    } else {
      console.error(
        'Supabase Cloud: copie a service_role key em Project Settings → API.'
      );
    }
    console.error('Depois: npm run seed:local');
    process.exit(1);
  }

  throw new Error(`Auth admin check failed: ${error.message}`);
};

const PLATFORM_ADMIN = {
  fullName: 'Admin',
  email: process.env.SEED_ADMIN_EMAIL ?? 'admin@mindbridge.local',
  password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123456',
  phone: null,
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

const getLocalWeekdayIndex = (date = new Date()) => {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
};

const dateForCurrentWeekday = (weekdayIndex, reference = new Date()) => {
  const date = new Date(reference);
  const todayWeekdayIndex = getLocalWeekdayIndex(reference);
  date.setDate(date.getDate() - todayWeekdayIndex + weekdayIndex);
  return date;
};

/** Same convention as scheduling UI: -getTimezoneOffset() (e.g. −180 for Brazil UTC−3). */
const getSchedulingTzOffsetMinutes = () => -new Date().getTimezoneOffset();

const atCurrentWeekSlotIso = (
  weekdayIndex,
  timeLocal,
  tzOffsetMinutes = getSchedulingTzOffsetMinutes()
) => {
  const [hourLocal, minuteLocal] = timeLocal.split(':').map(Number);
  const date = dateForCurrentWeekday(weekdayIndex);
  const utcMs =
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      hourLocal,
      minuteLocal
    ) +
    tzOffsetMinutes * 60_000;
  return new Date(utcMs).toISOString();
};

const EXTRA_DEMO_PSYCHOLOGISTS = [
  {
    fullName: 'Dr. Paula Silva',
    email: 'psicologo01.demo@mindbridge.local',
    phone: '11990001001',
    password: 'demo123456',
  },
  {
    fullName: 'Dr. Ricardo Alves',
    email: 'psicologo02.demo@mindbridge.local',
    phone: '11990001002',
    password: 'demo123456',
  },
  {
    fullName: 'Dra. Fernanda Lima',
    email: 'psicologo03.demo@mindbridge.local',
    phone: '11990001003',
    password: 'demo123456',
  },
  {
    fullName: 'Dr. Gustavo Moura',
    email: 'psicologo04.demo@mindbridge.local',
    phone: '11990001004',
    password: 'demo123456',
  },
  {
    fullName: 'Dra. Helena Rocha',
    email: 'psicologo05.demo@mindbridge.local',
    phone: '11990001005',
    password: 'demo123456',
  },
  {
    fullName: 'Dr. Igor Nunes',
    email: 'psicologo06.demo@mindbridge.local',
    phone: '11990001006',
    password: 'demo123456',
  },
  {
    fullName: 'Dra. Juliana Prado',
    email: 'psicologo07.demo@mindbridge.local',
    phone: '11990001007',
    password: 'demo123456',
  },
];

const buildExtraDemoPatients = (psychologistIndex, patientCount) =>
  Array.from({ length: patientCount }, (_, patientIndex) => ({
    fullName: `Paciente ${psychologistIndex + 1}.${patientIndex + 1}`,
    email: `p${String(psychologistIndex + 1).padStart(2, '0')}${String(patientIndex + 1).padStart(2, '0')}@mindbridge.local`,
    phone: `1199${String(psychologistIndex + 1).padStart(2, '0')}${String(patientIndex + 1).padStart(4, '0')}`,
    password: 'demo123456',
    lastConsultationAt: null,
    isDeleted: false,
    enabledSinceMonthsAgo: (psychologistIndex + patientIndex) % 6,
  }));

const PSYCHOLOGIST_ACCOUNTS = [
  { psychologist: DEMO_PSYCHOLOGIST, patients: [] },
  { psychologist: EMIR_PSYCHOLOGIST, patients: EMIR_PATIENTS },
  { psychologist: ALUIZIO_PSYCHOLOGIST, patients: [] },
  ...EXTRA_DEMO_PSYCHOLOGISTS.map((psychologist, index) => ({
    psychologist,
    patients: buildExtraDemoPatients(index, 2 + (index % 4)),
  })),
];

const upsertProfile = async ({
  userId,
  email,
  role,
  fullName,
  phone,
  isAdmin = false,
}) => {
  const { error } = await admin.from('profiles').upsert(
    {
      id: userId,
      email,
      role,
      full_name: fullName,
      phone,
      language: 'pt',
      is_admin: isAdmin,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) {
    throw new Error(`Profile ${email}: ${error.message}`);
  }
};

const ensureAuthUser = async ({ email, password, role, fullName, phone }) => {
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  let userId = existingProfile?.id;

  if (!userId) {
    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role, phone },
      });

    if (!authError) {
      userId = authData.user.id;
    } else if (isInvalidJwtError(authError.message)) {
      console.error(
        'SUPABASE_SERVICE_ROLE_KEY no .env não confere com SUPABASE_URL (JWT inválido).'
      );
      if (!isCloudSupabaseUrl(url)) {
        console.error('Supabase local: execute npm run supabase:env');
      }
      process.exit(1);
    } else if (isUserAlreadyRegisteredError(authError.message)) {
      const existingAuthUser = await findAuthUserByEmail(email);
      if (!existingAuthUser) {
        throw new Error(`${email}: ${authError.message}`);
      }
      userId = existingAuthUser.id;
      console.log(`  Reusing existing auth user: ${email}`);
    } else {
      throw new Error(`${email}: ${authError.message}`);
    }
  }

  await upsertProfile({ userId, email, role, fullName, phone });
  return userId;
};

const ensurePlatformAdmin = async () => {
  const { error: clearAdminError } = await admin
    .from('profiles')
    .update({
      is_admin: false,
      updated_at: new Date().toISOString(),
    })
    .eq('is_admin', true);

  if (clearAdminError) {
    throw new Error(`Failed to clear admin flags: ${clearAdminError.message}`);
  }

  const userId = await ensureAuthUser({
    email: PLATFORM_ADMIN.email,
    password: PLATFORM_ADMIN.password,
    role: 'psychologist',
    fullName: PLATFORM_ADMIN.fullName,
    phone: PLATFORM_ADMIN.phone,
  });

  const { error: adminFlagError } = await admin
    .from('profiles')
    .update({
      is_admin: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (adminFlagError) {
    throw new Error(`Failed to seed platform admin: ${adminFlagError.message}`);
  }

  console.log(
    `Platform admin: ${PLATFORM_ADMIN.fullName} (${PLATFORM_ADMIN.email})`
  );
};

const linkedAtFromMonthsAgo = (monthsAgo = 0) => {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCMonth(date.getUTCMonth() - monthsAgo);
  return date.toISOString();
};

const billingMonthFromOffset = (monthsAgo = 0) => {
  const monthDate = new Date();
  monthDate.setUTCDate(1);
  monthDate.setUTCMonth(monthDate.getUTCMonth() - monthsAgo);
  return `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, '0')}-01`;
};

const paidAtInMonth = (monthsAgo = 0, dayUTC = 10) => {
  const date = new Date();
  date.setUTCDate(dayUTC);
  date.setUTCMonth(date.getUTCMonth() - monthsAgo);
  date.setUTCHours(14, 30, 0, 0);
  return date.toISOString();
};

const isMissingPatientPaymentsTable = (error) => {
  const message = error?.message ?? '';
  const code = error?.code ?? '';
  return (
    code === 'PGRST205' ||
    message.includes('patient_session_payments') ||
    message.includes('schema cache')
  );
};

const isMissingSchedulingTable = (error) => {
  const message = error?.message ?? '';
  const code = error?.code ?? '';
  return (
    code === 'PGRST205' ||
    message.includes('psychologist_scheduling_settings') ||
    message.includes('psychologist_appointments') ||
    message.includes('schema cache')
  );
};

const seedPsychologistScheduling = async (
  psychologistId,
  settings,
  appointmentSeeds,
  patientIdByEmail
) => {
  if (!settings && !appointmentSeeds?.length) {
    return;
  }

  const { error: deleteAppointmentsError } = await admin
    .from('psychologist_appointments')
    .delete()
    .eq('psychologist_id', psychologistId);

  if (
    deleteAppointmentsError &&
    !isMissingSchedulingTable(deleteAppointmentsError)
  ) {
    throw new Error(
      `Scheduling appointments cleanup: ${deleteAppointmentsError.message}`
    );
  }

  if (
    deleteAppointmentsError &&
    isMissingSchedulingTable(deleteAppointmentsError)
  ) {
    console.warn(
      '  Skip scheduling: apply migrations 011_psychologist_scheduling.sql and 012_personal_scheduling_commitments.sql'
    );
    return;
  }

  if (settings) {
    const { error: settingsError } = await admin
      .from('psychologist_scheduling_settings')
      .upsert(
        {
          psychologist_id: psychologistId,
          session_duration_minutes: settings.sessionDurationMinutes,
          day_start_time: settings.dayStartTime,
          day_end_time: settings.dayEndTime,
          break_intervals: settings.breakIntervals,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'psychologist_id' }
      );

    if (settingsError) {
      throw new Error(`Scheduling settings: ${settingsError.message}`);
    }
  }

  if (!appointmentSeeds?.length) {
    return;
  }

  const durationMinutes = settings?.sessionDurationMinutes ?? 50;
  const rows = [];

  for (const seed of appointmentSeeds) {
    if (seed.isPersonalCommitment) {
      rows.push({
        psychologist_id: psychologistId,
        patient_id: null,
        starts_at: atCurrentWeekSlotIso(seed.weekdayIndex, seed.time),
        duration_minutes: durationMinutes,
        notes: seed.description,
        is_personal_commitment: true,
        updated_at: new Date().toISOString(),
      });
      continue;
    }

    const patientId = patientIdByEmail[seed.patientEmail];
    if (!patientId) {
      console.warn(
        `  Skip appointment: patient not found (${seed.patientEmail})`
      );
      continue;
    }

    rows.push({
      psychologist_id: psychologistId,
      patient_id: patientId,
      starts_at: atCurrentWeekSlotIso(seed.weekdayIndex, seed.time),
      duration_minutes: durationMinutes,
      notes: seed.notes ?? null,
      is_personal_commitment: false,
      updated_at: new Date().toISOString(),
    });
  }

  if (!rows.length) {
    return;
  }

  let insertedRows = rows;
  let { error: insertError } = await admin
    .from('psychologist_appointments')
    .insert(rows);

  if (
    insertError &&
    rows.some((row) => row.is_personal_commitment) &&
    (insertError.message.includes('is_personal_commitment') ||
      insertError.message.includes('patient_or_personal') ||
      insertError.message.includes('patient_id'))
  ) {
    insertedRows = rows.filter((row) => !row.is_personal_commitment);
    console.warn(
      '  Compromissos particulares ignorados: aplique a migration 012_personal_scheduling_commitments.sql'
    );
    if (insertedRows.length) {
      const patientRows = insertedRows.map(
        ({ is_personal_commitment: _flag, ...rest }) => rest
      );
      ({ error: insertError } = await admin
        .from('psychologist_appointments')
        .insert(patientRows));
    } else {
      insertError = null;
    }
  }

  if (insertError) {
    throw new Error(`Scheduling appointments: ${insertError.message}`);
  }

  const patientCount = insertedRows.filter(
    (row) => !row.is_personal_commitment
  ).length;
  const personalCount = insertedRows.filter(
    (row) => row.is_personal_commitment
  ).length;
  console.log(
    `  Scheduling: ${insertedRows.length} item(s) na semana atual (${patientCount} consulta(s), ${personalCount} compromisso(s) particular(es))`
  );
};

const seedPatientSessionPayments = async (
  psychologistId,
  paymentSeeds,
  patientIdByEmail
) => {
  if (!paymentSeeds?.length) {
    return;
  }

  const { error: deleteError } = await admin
    .from('patient_session_payments')
    .delete()
    .eq('psychologist_id', psychologistId);

  if (deleteError && !isMissingPatientPaymentsTable(deleteError)) {
    throw new Error(`Patient payments cleanup: ${deleteError.message}`);
  }

  if (deleteError && isMissingPatientPaymentsTable(deleteError)) {
    console.warn(
      '  Skip patient payments: apply migration 010_patient_session_payments.sql'
    );
    return;
  }

  const rows = [];

  for (const seed of paymentSeeds) {
    const patientId = patientIdByEmail[seed.patientEmail];
    if (!patientId) {
      console.warn(`  Skip payments: patient not found (${seed.patientEmail})`);
      continue;
    }

    for (const payment of seed.payments) {
      rows.push({
        psychologist_id: psychologistId,
        patient_id: patientId,
        billing_month: billingMonthFromOffset(payment.monthsAgo),
        amount_cents: payment.amountCents,
        paid_at: paidAtInMonth(payment.monthsAgo, payment.dayUTC ?? 10),
        notes: payment.notes ?? null,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (!rows.length) {
    return;
  }

  const { error: insertError } = await admin
    .from('patient_session_payments')
    .insert(rows);
  if (insertError) {
    if (isMissingPatientPaymentsTable(insertError)) {
      console.warn(
        '  Skip patient payments: apply migration 010_patient_session_payments.sql'
      );
      return;
    }
    throw new Error(`Patient payments insert: ${insertError.message}`);
  }

  console.log(`  Patient payments: ${rows.length} record(s)`);
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

  const { error } = await admin
    .from('care_relationship_billing_events')
    .insert(events);
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
  const { monthStart, monthEndExclusive } =
    billingMonthBoundsFromOffset(monthOffset);
  const billableEmails = new Set();

  for (const patient of patients) {
    const enabledAt = new Date(
      linkedAtFromMonthsAgo(patient.enabledSinceMonthsAgo ?? 0)
    );
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
    const discountAmountCents = Math.round(
      grossAmountCents * (discountPercent / 100)
    );
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
      throw new Error(
        `Billing monthly ${email} ${billingMonth}: ${monthlyError.message}`
      );
    }
  }
};

const seedPatientInteractions = async (patientId, email) => {
  const specs = DEMO_INTERACTION_SPECS_BY_EMAIL[email];
  if (!specs?.length) {
    return;
  }

  await admin.from('patient_interactions').delete().eq('patient_id', patientId);

  const rows = specs.map(({ weekday, hourUTC, channel }) => ({
    patient_id: patientId,
    channel,
    source: 'web',
    mood_score: null,
    created_at: atCurrentWeekDayIso(weekday, hourUTC),
  }));

  const { error } = await admin.from('patient_interactions').insert(rows);
  if (error) {
    throw new Error(`Patient interactions ${email}: ${error.message}`);
  }
};

const upsertClinical = async (patientId, email) => {
  const payload = resolveDemoClinicalPayload(email);
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

const seedPsychologistChatShortcuts = async (psychologistId) => {
  const { count, error: countError } = await admin
    .from('psychologist_chat_shortcuts')
    .select('id', { count: 'exact', head: true })
    .eq('psychologist_id', psychologistId);

  if (countError) {
    if (countError.code === 'PGRST205') {
      console.warn('  Chat shortcuts table missing — apply migration 015');
      return;
    }
    throw new Error(`Failed to check chat shortcuts: ${countError.message}`);
  }

  if ((count ?? 0) > 0) {
    return;
  }

  const now = new Date().toISOString();
  const rows = DEFAULT_PSYCHOLOGIST_CHAT_SHORTCUTS.map((shortcut) => ({
    psychologist_id: psychologistId,
    sort_order: shortcut.sortOrder,
    translations: shortcut.translations,
    created_at: now,
    updated_at: now,
  }));

  const { error: insertError } = await admin
    .from('psychologist_chat_shortcuts')
    .insert(rows);
  if (insertError) {
    throw new Error(`Failed to seed chat shortcuts: ${insertError.message}`);
  }

  console.log(`  Chat shortcuts: ${rows.length} default shortcut(s)`);
};

const seedPsychologistChatShortcutsForAll = async () => {
  const { data: psychologists, error } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'psychologist');

  if (error) {
    if (error.code === 'PGRST205') {
      return;
    }
    throw new Error(
      `Failed to list psychologists for chat shortcuts: ${error.message}`
    );
  }

  for (const psychologist of psychologists ?? []) {
    await seedPsychologistChatShortcuts(psychologist.id);
  }
};

const seedPsychologistAccount = async ({
  psychologist,
  patients,
  patientPaymentSeeds,
  schedulingSettings,
  schedulingAppointmentSeeds,
}) => {
  const psychologistId = await ensureAuthUser({
    ...psychologist,
    phone: psychologist.phone ?? '',
    role: 'psychologist',
  });
  console.log(`Psychologist: ${psychologist.email} (${psychologistId})`);

  const patientIdByEmail = {};

  for (const demo of patients) {
    const patientId = await ensureAuthUser({
      email: demo.email,
      password: demo.password,
      role: 'patient',
      fullName: demo.fullName,
      phone: demo.phone,
    });

    patientIdByEmail[demo.email] = patientId;

    await linkPatient(psychologistId, patientId, demo);
    await upsertClinical(patientId, demo.email);
    await seedPatientInteractions(patientId, demo.email);

    console.log(`  Patient: ${demo.fullName} (${demo.email})`);
  }

  await seedBillingForPsychologist(
    psychologistId,
    psychologist.email,
    patients
  );
  await seedPatientSessionPayments(
    psychologistId,
    patientPaymentSeeds,
    patientIdByEmail
  );
  await seedPsychologistScheduling(
    psychologistId,
    schedulingSettings,
    schedulingAppointmentSeeds,
    patientIdByEmail
  );
  await seedPsychologistChatShortcuts(psychologistId);
};

const main = async () => {
  const target = isCloudSupabaseUrl(url) ? 'Supabase Cloud' : 'Supabase local';
  console.log(`Seeding demo data (${target})…`);
  await assertServiceRoleKey();
  await assertDatabaseSchema();

  for (const account of PSYCHOLOGIST_ACCOUNTS) {
    await seedPsychologistAccount(account);
  }

  await seedPsychologistChatShortcutsForAll();

  await ensurePlatformAdmin();

  console.log('Done.');
  console.log(
    'Login platform admin:',
    PLATFORM_ADMIN.email,
    '/',
    PLATFORM_ADMIN.password
  );
  console.log(
    'Login demo psychologist:',
    DEMO_PSYCHOLOGIST.email,
    '/',
    DEMO_PSYCHOLOGIST.password
  );
  console.log(
    'Login Emir (psychologist):',
    EMIR_PSYCHOLOGIST.email,
    '/',
    EMIR_PSYCHOLOGIST.password
  );
  console.log(
    'Login Aluizio (psychologist):',
    ALUIZIO_PSYCHOLOGIST.email,
    '/',
    ALUIZIO_PSYCHOLOGIST.password
  );
  console.log(
    'Login José Carlos (patient):',
    EMIR_PATIENTS[0].email,
    '/',
    EMIR_PATIENTS[0].password
  );
  console.log(
    'Login demo patient (Ana):',
    DEMO_PATIENTS[0].email,
    '/',
    DEMO_PATIENTS[0].password
  );
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
