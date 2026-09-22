#!/usr/bin/env node
/**
 * Seed mínimo: cria (ou reutiliza) dois psicólogos.
 *
 * Usage:
 *   npm run seed:psychologists
 *   node --env-file=.env scripts/seed-psychologists.mjs
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PSYCHOLOGISTS = [
  {
    fullName: 'Emir Marques',
    email: 'emirdeliz@gmail.com',
    phone: null,
    password: 'Data@123',
  },
  {
    fullName: 'Aluizio Vilar',
    email: 'aluizio.vilar@gmail.com',
    phone: null,
    password: 'Data@123',
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

const upsertProfile = async ({ userId, email, fullName, phone }) => {
  const { error } = await admin.from('profiles').upsert(
    {
      id: userId,
      email,
      role: 'psychologist',
      full_name: fullName,
      phone,
      language: 'pt',
      is_admin: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) {
    throw new Error(`Profile ${email}: ${error.message}`);
  }
};

const ensurePsychologist = async ({ email, password, fullName, phone }) => {
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
        user_metadata: { role: 'psychologist', phone },
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
      console.log(`  Reusando auth existente: ${email}`);
    } else {
      throw new Error(`${email}: ${authError.message}`);
    }
  } else {
    console.log(`  Perfil já existe: ${email}`);
  }

  await upsertProfile({
    userId,
    email,
    fullName,
    phone: phone ?? '',
  });

  return userId;
};

const seedChatShortcuts = async (psychologistId) => {
  const { count, error: countError } = await admin
    .from('psychologist_chat_shortcuts')
    .select('id', { count: 'exact', head: true })
    .eq('psychologist_id', psychologistId);

  if (countError) {
    if (countError.code === 'PGRST205') {
      console.warn('  Atalhos: tabela ausente (migration 015)');
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

const main = async () => {
  const target = isCloudSupabaseUrl(url) ? 'Supabase Cloud' : 'Supabase local';
  console.log(`Seed psicólogos (${target})…`);

  const { error: schemaError } = await admin
    .from('profiles')
    .select('id')
    .limit(1);

  if (schemaError) {
    console.error(`Schema indisponível: ${schemaError.message}`);
    console.error('Aplique as migrations (npm run supabase:restart-data) e tente de novo.');
    process.exit(1);
  }

  for (const psychologist of PSYCHOLOGISTS) {
    const userId = await ensurePsychologist(psychologist);
    console.log(`Psychologist: ${psychologist.fullName} <${psychologist.email}> (${userId})`);
    await seedChatShortcuts(userId);
  }

  console.log('Seed concluído.');
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
