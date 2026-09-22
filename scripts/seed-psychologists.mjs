#!/usr/bin/env node
/**
 * Seed: dois psicólogos + um paciente cada, com dados clínicos relacionados.
 *
 * Usage:
 *   npm run seed:psychologists
 *   node --env-file=.env scripts/seed-psychologists.mjs
 */

import { createClient } from '@supabase/supabase-js';

import {
  INTERACTION_SPECS_BY_EMAIL,
  resolvePatientClinicalPayload,
} from './lib/seed-patient-clinical-data.mjs';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PLATFORM_PRICE_CENTS = 7990;

const PLATFORM_ADMIN = {
  fullName: 'Admin',
  email: process.env.SEED_ADMIN_EMAIL ?? 'admin@mindbridge.local',
  password: process.env.SEED_ADMIN_PASSWORD ?? 'Emir#262689',
  phone: null,
};

const ACCOUNTS = [
  {
    psychologist: {
      fullName: 'Emir Marques',
      email: 'emirdeliz@gmail.com',
      phone: null,
      password: 'Data@123',
    },
    patient: {
      fullName: 'Carlos Amaro',
      email: 'carlosamaro@gmail.com',
      phone: '11999887766',
      password: 'Data@123',
      lastConsultationAt: new Date(
        Date.now() - 3 * 24 * 60 * 60 * 1000
      ).toISOString(),
      enabledSinceMonthsAgo: 2,
      paymentAmountCents: 25000,
    },
  },
  {
    psychologist: {
      fullName: 'Aluizio Vilar',
      email: 'aluizio.vilar@gmail.com',
      phone: null,
      password: 'Data@123',
    },
    patient: {
      fullName: 'Ana Mendes',
      email: 'ana.mendes@gmail.com',
      phone: '21988776655',
      password: 'Data@123',
      lastConsultationAt: new Date(
        Date.now() - 5 * 24 * 60 * 60 * 1000
      ).toISOString(),
      enabledSinceMonthsAgo: 3,
      paymentAmountCents: 28000,
    },
  },
];

const DEFAULT_CHAT_SHORTCUTS = [
  {
    sortOrder: 0,
    translations: {
      pt: {
        label: 'Perguntas para explorar',
        message:
          'Formule 3 perguntas abertas para explorar o tema central desta sessão.',
      },
      en: {
        label: 'Questions to explore',
        message:
          'Formulate 3 open-ended questions to explore the central theme of this session.',
      },
      es: {
        label: 'Preguntas para explorar',
        message:
          'Formula 3 preguntas abiertas para explorar el tema central de esta sesión.',
      },
    },
  },
  {
    sortOrder: 1,
    translations: {
      pt: {
        label: 'Pontos de atenção',
        message:
          'Quais são os principais pontos de atenção clínica com base nos dados atuais do paciente?',
      },
      en: {
        label: 'Points of attention',
        message:
          "What are the main clinical points of attention based on the patient's current data?",
      },
      es: {
        label: 'Puntos de atención',
        message:
          '¿Cuáles son los principales puntos de atención clínica según los datos actuales del paciente?',
      },
    },
  },
  {
    sortOrder: 2,
    translations: {
      pt: {
        label: 'Resumo da evolução',
        message:
          'Resuma em uma frase a evolução do paciente desde a última sessão.',
      },
      en: {
        label: 'Progress summary',
        message:
          "Summarize the patient's progress since the last session in one sentence.",
      },
      es: {
        label: 'Resumen de evolución',
        message:
          'Resume en una frase la evolución del paciente desde la última sesión.',
      },
    },
  },
];

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

const isMissingTableError = (error) => {
  const message = error?.message ?? '';
  return (
    error?.code === 'PGRST205' ||
    message.includes('schema cache') ||
    message.includes('Could not find the table')
  );
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

const atCurrentWeekDayIso = (weekdayIndex, hourUTC) => {
  const date = dateForCurrentWeekday(weekdayIndex);
  date.setUTCHours(hourUTC, 0, 0, 0);
  return date.toISOString();
};

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
      phone: phone ?? '',
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

const ensureAuthUser = async ({
  email,
  password,
  role,
  fullName,
  phone,
  isAdmin = false,
  syncPassword = false,
}) => {
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  let userId = existingProfile?.id;
  let created = false;

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
      created = true;
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
      console.log(`  Reusando auth existente: ${email}`);
    } else {
      throw new Error(`${email}: ${authError.message}`);
    }
  } else {
    console.log(`  Perfil já existe: ${email}`);
  }

  if (!created && syncPassword) {
    const { error: passwordError } = await admin.auth.admin.updateUserById(
      userId,
      { password, email_confirm: true }
    );
    if (passwordError) {
      throw new Error(
        `Falha ao atualizar senha de ${email}: ${passwordError.message}`
      );
    }
    console.log(`  Senha sincronizada: ${email}`);
  }

  await upsertProfile({ userId, email, role, fullName, phone, isAdmin });
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
    isAdmin: true,
    syncPassword: true,
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

  await seedChatShortcuts(userId);

  console.log(
    `Platform admin: ${PLATFORM_ADMIN.fullName} <${PLATFORM_ADMIN.email}> (${userId})`
  );
};

const seedChatShortcuts = async (psychologistId) => {
  const { count, error: countError } = await admin
    .from('psychologist_chat_shortcuts')
    .select('id', { count: 'exact', head: true })
    .eq('psychologist_id', psychologistId);

  if (countError) {
    if (isMissingTableError(countError)) {
      console.warn('  Atalhos: tabela ausente');
      return;
    }
    throw new Error(`Falha ao checar atalhos: ${countError.message}`);
  }

  if ((count ?? 0) > 0) {
    return;
  }

  const now = new Date().toISOString();
  const rows = DEFAULT_CHAT_SHORTCUTS.map((shortcut) => ({
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
    throw new Error(`Falha ao criar atalhos: ${insertError.message}`);
  }

  console.log(`  Atalhos padrão: ${rows.length}`);
};

const seedCareBillingEvents = async (
  careRelationshipId,
  psychologistId,
  patientId,
  enabledAt
) => {
  await admin
    .from('care_relationship_billing_events')
    .delete()
    .eq('care_relationship_id', careRelationshipId);

  const { error } = await admin.from('care_relationship_billing_events').insert({
    care_relationship_id: careRelationshipId,
    psychologist_id: psychologistId,
    patient_id: patientId,
    event_type: 'enabled',
    occurred_at: enabledAt,
  });

  if (error && !isMissingTableError(error)) {
    throw new Error(`Billing events: ${error.message}`);
  }
};

const linkPatient = async (psychologistId, patientId, patient) => {
  const { data: existingCare } = await admin
    .from('care_relationships')
    .select('id')
    .eq('psychologist_id', psychologistId)
    .eq('patient_id', patientId)
    .maybeSingle();

  const linkedAt = linkedAtFromMonthsAgo(patient.enabledSinceMonthsAgo ?? 0);
  const carePayload = {
    psychologist_id: psychologistId,
    patient_id: patientId,
    status: 'active',
    is_deleted: false,
    last_consultation_at: patient.lastConsultationAt,
    created_at: linkedAt,
    disabled_at: null,
  };

  let careRelationshipId = existingCare?.id;

  if (!existingCare) {
    const { data: insertedCare, error: careError } = await admin
      .from('care_relationships')
      .insert(carePayload)
      .select('id')
      .single();
    if (careError) {
      throw new Error(`Care link ${patient.email}: ${careError.message}`);
    }
    careRelationshipId = insertedCare.id;
  } else {
    const { error: careError } = await admin
      .from('care_relationships')
      .update(carePayload)
      .eq('id', existingCare.id);
    if (careError) {
      throw new Error(`Care link ${patient.email}: ${careError.message}`);
    }
  }

  await seedCareBillingEvents(
    careRelationshipId,
    psychologistId,
    patientId,
    linkedAt
  );

  return careRelationshipId;
};

const upsertClinical = async (patientId, email) => {
  const payload = resolvePatientClinicalPayload(email);

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
      likert_check_in: payload.likertCheckIn,
      anamnesis: payload.anamnesis,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'patient_id' }
  );

  if (error) {
    throw new Error(`Clinical ${email}: ${error.message}`);
  }

  console.log('  Conteúdo clínico upserted');
};

const seedPatientInteractions = async (patientId, email) => {
  const specs = INTERACTION_SPECS_BY_EMAIL[email];
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

  console.log(`  Interações: ${rows.length}`);
};

const seedPatientPayments = async (psychologistId, patientId, patient) => {
  const { error: deleteError } = await admin
    .from('patient_session_payments')
    .delete()
    .eq('psychologist_id', psychologistId)
    .eq('patient_id', patientId);

  if (deleteError) {
    if (isMissingTableError(deleteError)) {
      console.warn('  Pagamentos: tabela ausente');
      return;
    }
    throw new Error(`Payments cleanup: ${deleteError.message}`);
  }

  const rows = [0, 1, 2].map((monthsAgo) => ({
    psychologist_id: psychologistId,
    patient_id: patientId,
    billing_month: billingMonthFromOffset(monthsAgo),
    amount_cents: patient.paymentAmountCents,
    paid_at: paidAtInMonth(monthsAgo),
    notes: monthsAgo === 0 ? 'Pagamento mês corrente (seed)' : null,
    updated_at: new Date().toISOString(),
  }));

  const { error: insertError } = await admin
    .from('patient_session_payments')
    .insert(rows);

  if (insertError) {
    throw new Error(`Payments insert: ${insertError.message}`);
  }

  console.log(`  Pagamentos de sessão: ${rows.length}`);
};

const seedScheduling = async (psychologistId, patientId, patientEmail) => {
  const { error: settingsError } = await admin
    .from('psychologist_scheduling_settings')
    .upsert(
      {
        psychologist_id: psychologistId,
        session_duration_minutes: 50,
        day_start_time: '08:00',
        day_end_time: '20:00',
        break_intervals: [{ startTime: '12:00', endTime: '13:00' }],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'psychologist_id' }
    );

  if (settingsError) {
    if (isMissingTableError(settingsError)) {
      console.warn('  Agenda: tabela ausente');
      return;
    }
    throw new Error(`Scheduling settings: ${settingsError.message}`);
  }

  await admin
    .from('psychologist_appointments')
    .delete()
    .eq('psychologist_id', psychologistId)
    .eq('patient_id', patientId);

  const weekday = patientEmail.includes('ana') ? 2 : 3;
  const startsAt = atCurrentWeekSlotIso(weekday, '10:00');

  const { error: appointmentError } = await admin
    .from('psychologist_appointments')
    .insert({
      psychologist_id: psychologistId,
      patient_id: patientId,
      starts_at: startsAt,
      duration_minutes: 50,
      notes: 'Consulta seed',
      updated_at: new Date().toISOString(),
    });

  if (appointmentError) {
    throw new Error(`Appointment: ${appointmentError.message}`);
  }

  console.log(`  Agendamento: ${startsAt}`);
};

const seedBillingForPsychologist = async (psychologistId) => {
  await admin.from('billing_platform_pricing').upsert(
    {
      id: 'default',
      price_per_patient_cents: PLATFORM_PRICE_CENTS,
      currency: 'BRL',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  for (let offset = 3; offset >= 0; offset -= 1) {
    const billingMonth = billingMonthFromOffset(offset);
    const patientCount = 1;
    const grossAmountCents = patientCount * PLATFORM_PRICE_CENTS;

    const { error } = await admin.from('psychologist_billing_monthly').upsert(
      {
        psychologist_id: psychologistId,
        billing_month: billingMonth,
        enabled_patient_count: patientCount,
        unit_price_cents: PLATFORM_PRICE_CENTS,
        gross_amount_cents: grossAmountCents,
        discount_percent: 0,
        discount_amount_cents: 0,
        net_amount_cents: grossAmountCents,
        is_finalized: offset > 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'psychologist_id,billing_month' }
    );

    if (error && !isMissingTableError(error)) {
      throw new Error(`Billing monthly: ${error.message}`);
    }
  }

  console.log('  Billing mensal: 4 meses');
};

const seedAccount = async ({ psychologist, patient }) => {
  const psychologistId = await ensureAuthUser({
    ...psychologist,
    role: 'psychologist',
  });
  console.log(
    `Psychologist: ${psychologist.fullName} <${psychologist.email}> (${psychologistId})`
  );
  await seedChatShortcuts(psychologistId);

  const patientId = await ensureAuthUser({
    ...patient,
    role: 'patient',
  });
  console.log(
    `  Patient: ${patient.fullName} <${patient.email}> (${patientId})`
  );

  await linkPatient(psychologistId, patientId, patient);
  console.log('  Vínculo de cuidado ativo');

  await upsertClinical(patientId, patient.email);
  await seedPatientInteractions(patientId, patient.email);
  await seedPatientPayments(psychologistId, patientId, patient);
  await seedScheduling(psychologistId, patientId, patient.email);
  await seedBillingForPsychologist(psychologistId);
};

const main = async () => {
  const target = isCloudSupabaseUrl(url) ? 'Supabase Cloud' : 'Supabase local';
  console.log(`Seed psicólogos + pacientes (${target})…`);

  const { error: schemaError } = await admin
    .from('profiles')
    .select('id')
    .limit(1);

  if (schemaError) {
    console.error(`Schema indisponível: ${schemaError.message}`);
    console.error(
      'Aplique as migrations (npm run supabase:restart-data) e tente de novo.'
    );
    process.exit(1);
  }

  for (const account of ACCOUNTS) {
    await seedAccount(account);
    console.log('');
  }

  await ensurePlatformAdmin();
  console.log('');

  console.log('Seed concluído.');
  console.log('Credenciais:');
  console.log(
    `  Admin <${PLATFORM_ADMIN.email}> → senha ${PLATFORM_ADMIN.password}`
  );
  for (const { psychologist, patient } of ACCOUNTS) {
    console.log(
      `  ${psychologist.fullName} / ${patient.fullName} → senha Data@123`
    );
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
