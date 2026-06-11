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
    console.error('SUPABASE_SERVICE_ROLE_KEY no .env não confere com SUPABASE_URL (JWT inválido).');
    if (!isCloudSupabaseUrl(url)) {
      console.error('Supabase local: com o stack rodando, execute: npm run supabase:env');
    } else {
      console.error('Supabase Cloud: copie a service_role key em Project Settings → API.');
    }
    console.error('Depois: npm run seed:local');
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

const daysAgoIso = (daysAgo, hourUTC = 12) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(hourUTC, 0, 0, 0);
  return date.toISOString();
};

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

const atCurrentWeekDayIso = (weekdayIndex, hourUTC = 12) => {
  const date = dateForCurrentWeekday(weekdayIndex);
  date.setUTCHours(hourUTC, 0, 0, 0);
  return date.toISOString();
};

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
  {
    fullName: 'Carlos Amaro',
    email: 'carlosamaro@gmail.com',
    phone: '11988776655',
    password: 'Data@123',
    lastConsultationAt: daysAgoIso(4, 15),
    isDeleted: false,
    enabledSinceMonthsAgo: 2,
  },
];

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

const durationMinutesFromLocalTimes = (startTime, endTime) => {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  return endTotal - startTotal;
};

const ALUIZIO_SCHEDULING_SETTINGS = {
  sessionDurationMinutes: 50,
  dayStartTime: '08:00:00',
  dayEndTime: '20:00:00',
  breakIntervals: [{ startTime: '12:00', endTime: '13:00' }],
};

/**
 * weekdayIndex 0 = Monday (semana atual no fuso Brasil, UTC−3).
 * Horários de consulta alinham aos slots de 50 min (intervalo 12:00–13:00).
 * Compromissos particulares usam startTime/endTime livres.
 */
const ALUIZIO_SCHEDULING_APPOINTMENT_SEEDS = [
  {
    patientEmail: 'maurosouza@gmail.com',
    weekdayIndex: 0,
    time: '09:40',
    notes: null,
  },
  {
    patientEmail: 'ana.demo@mindbridge.local',
    weekdayIndex: 0,
    time: '14:40',
    notes: 'Acompanhamento semanal — técnicas de grounding',
  },
  {
    patientEmail: 'maurosouza@gmail.com',
    weekdayIndex: 1,
    time: '08:00',
    notes: null,
  },
  {
    patientEmail: 'carlosamaro@gmail.com',
    weekdayIndex: 1,
    time: '10:30',
    notes: 'Retorno TCC — reativação comportamental',
  },
  {
    isPersonalCommitment: true,
    weekdayIndex: 1,
    startTime: '11:20',
    endTime: '12:00',
    description: 'Consulta médica — cardiologista',
  },
  {
    patientEmail: 'bruno.demo@mindbridge.local',
    weekdayIndex: 2,
    time: '09:40',
    notes: null,
  },
  {
    patientEmail: 'carlosamaro@gmail.com',
    weekdayIndex: 2,
    time: '14:40',
    notes: null,
  },
  {
    patientEmail: 'carla.demo@mindbridge.local',
    weekdayIndex: 3,
    time: '08:00',
    notes: 'Sessão online',
  },
  {
    patientEmail: 'maurosouza@gmail.com',
    weekdayIndex: 3,
    time: '13:00',
    notes: 'Avaliação inicial presencial',
  },
  {
    isPersonalCommitment: true,
    weekdayIndex: 3,
    startTime: '17:10',
    endTime: '18:30',
    description: 'Compromisso pessoal — jantar de família',
  },
  {
    patientEmail: 'diego.demo@mindbridge.local',
    weekdayIndex: 4,
    time: '10:30',
    notes: 'Encaminhamento pós-avaliação',
  },
];

/** Demo session payments for Aluizio — monthsAgo 0 = current month. */
const ALUIZIO_PATIENT_PAYMENT_SEEDS = [
  {
    patientEmail: 'carlosamaro@gmail.com',
    payments: [
      {
        monthsAgo: 0,
        amountCents: 35000,
        notes: 'Sessão presencial — pagamento via PIX',
      },
      {
        monthsAgo: 1,
        amountCents: 35000,
        notes: null,
      },
      {
        monthsAgo: 2,
        amountCents: 30000,
        notes: 'Valor acordado na avaliação inicial',
      },
    ],
  },
];

/** Known demo patients also linked to Aluizio (in addition to Emir). */
const ALUIZIO_ALL_PATIENTS = [...ALUIZIO_PATIENTS, ...DEMO_PATIENTS];

const ALL_PATIENT_SEEDS_BY_EMAIL = new Map(
  [...EMIR_PATIENTS, ...ALUIZIO_ALL_PATIENTS].map((patient) => [
    patient.email.trim().toLowerCase(),
    patient,
  ])
);

const PSYCHOLOGIST_ACCOUNTS = [
  { psychologist: DEMO_PSYCHOLOGIST, patients: [] },
  { psychologist: EMIR_PSYCHOLOGIST, patients: EMIR_PATIENTS },
  {
    psychologist: ALUIZIO_PSYCHOLOGIST,
    patients: ALUIZIO_ALL_PATIENTS,
    patientPaymentSeeds: ALUIZIO_PATIENT_PAYMENT_SEEDS,
    schedulingSettings: ALUIZIO_SCHEDULING_SETTINGS,
    schedulingAppointmentSeeds: ALUIZIO_SCHEDULING_APPOINTMENT_SEEDS,
  },
];

const upsertProfile = async ({ userId, email, role, fullName, phone }) => {
  const { error } = await admin.from('profiles').upsert(
    {
      id: userId,
      email,
      role,
      full_name: fullName,
      phone,
      language: 'pt',
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
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, phone },
    });

    if (!authError) {
      userId = authData.user.id;
    } else if (isInvalidJwtError(authError.message)) {
      console.error('SUPABASE_SERVICE_ROLE_KEY no .env não confere com SUPABASE_URL (JWT inválido).');
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

  if (deleteAppointmentsError && !isMissingSchedulingTable(deleteAppointmentsError)) {
    throw new Error(`Scheduling appointments cleanup: ${deleteAppointmentsError.message}`);
  }

  if (deleteAppointmentsError && isMissingSchedulingTable(deleteAppointmentsError)) {
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
      const personalDuration = durationMinutesFromLocalTimes(seed.startTime, seed.endTime);
      if (personalDuration <= 0) {
        console.warn(
          `  Skip personal commitment: invalid time range (${seed.startTime}–${seed.endTime})`
        );
        continue;
      }

      rows.push({
        psychologist_id: psychologistId,
        patient_id: null,
        starts_at: atCurrentWeekSlotIso(seed.weekdayIndex, seed.startTime),
        duration_minutes: personalDuration,
        notes: seed.description,
        is_personal_commitment: true,
        updated_at: new Date().toISOString(),
      });
      continue;
    }

    const patientId = patientIdByEmail[seed.patientEmail];
    if (!patientId) {
      console.warn(`  Skip appointment: patient not found (${seed.patientEmail})`);
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
  let { error: insertError } = await admin.from('psychologist_appointments').insert(rows);

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
      const patientRows = insertedRows.map(({ is_personal_commitment: _flag, ...rest }) => rest);
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

  const patientCount = insertedRows.filter((row) => !row.is_personal_commitment).length;
  const personalCount = insertedRows.filter((row) => row.is_personal_commitment).length;
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

  const { error: insertError } = await admin.from('patient_session_payments').insert(rows);
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

const linkPatientsWithoutCareToPsychologist = async (psychologistId, psychologistEmail) => {
  const { data: patientProfiles, error: patientsError } = await admin
    .from('profiles')
    .select('id, email, full_name, phone')
    .eq('role', 'patient');

  if (patientsError) {
    throw new Error(`Failed to list patient profiles: ${patientsError.message}`);
  }

  const { data: careRows, error: careError } = await admin
    .from('care_relationships')
    .select('patient_id');

  if (careError) {
    throw new Error(`Failed to list care relationships: ${careError.message}`);
  }

  const linkedPatientIds = new Set((careRows ?? []).map((row) => row.patient_id));
  const unlinkedPatients = (patientProfiles ?? []).filter(
    (profile) => !linkedPatientIds.has(profile.id)
  );

  if (!unlinkedPatients.length) {
    return 0;
  }

  for (const profile of unlinkedPatients) {
    const emailKey = profile.email?.trim().toLowerCase() ?? '';
    const seed = ALL_PATIENT_SEEDS_BY_EMAIL.get(emailKey);
    const demo = seed ?? {
      email: profile.email,
      fullName: profile.full_name ?? profile.email ?? 'Paciente',
      phone: profile.phone,
      lastConsultationAt: null,
      isDeleted: false,
      enabledSinceMonthsAgo: 0,
    };

    await linkPatient(psychologistId, profile.id, demo);

    if (emailKey && resolveDemoClinicalPayload(emailKey)) {
      await upsertClinical(profile.id, profile.email);
      await seedPatientInteractions(profile.id, profile.email);
    }

    console.log(`  Linked orphan patient to ${psychologistEmail}: ${profile.email}`);
  }

  return unlinkedPatients.length;
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

  await seedBillingForPsychologist(psychologistId, psychologist.email, patients);
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
};

const main = async () => {
  const target = isCloudSupabaseUrl(url) ? 'Supabase Cloud' : 'Supabase local';
  console.log(`Seeding demo data (${target})…`);
  await assertServiceRoleKey();
  await assertDatabaseSchema();

  for (const account of PSYCHOLOGIST_ACCOUNTS) {
    await seedPsychologistAccount(account);
  }

  const { data: aluizioProfile, error: aluizioProfileError } = await admin
    .from('profiles')
    .select('id')
    .eq('email', ALUIZIO_PSYCHOLOGIST.email)
    .maybeSingle();

  if (aluizioProfileError) {
    throw new Error(`Failed to resolve Aluizio profile: ${aluizioProfileError.message}`);
  }

  if (aluizioProfile) {
    const orphanCount = await linkPatientsWithoutCareToPsychologist(
      aluizioProfile.id,
      ALUIZIO_PSYCHOLOGIST.email
    );
    if (orphanCount > 0) {
      console.log(
        `Aluizio: ${orphanCount} paciente(s) sem vínculo foram associados a ${ALUIZIO_PSYCHOLOGIST.email}`
      );
    }
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
  console.log(
    'Login Carlos Amaro (patient, charts demo):',
    ALUIZIO_PATIENTS[1].email,
    '/',
    ALUIZIO_PATIENTS[1].password
  );
  console.log(
    'Aluizio patient payments: Carlos Amaro pago nos últimos 3 meses; Mauro Souza inadimplente no mês atual.'
  );
  console.log(
    'Aluizio scheduling: 9 consultas + 2 compromissos particulares na semana atual — /psychologist/scheduling'
  );
  console.log(
    'Aluizio patients: Mauro, Carlos, Ana, Bruno, Carla, Diego e Elisa (demo) — mais órfãos sem psicólogo no banco'
  );
  console.log('Login demo patient (Ana):', DEMO_PATIENTS[0].email, '/', DEMO_PATIENTS[0].password);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
