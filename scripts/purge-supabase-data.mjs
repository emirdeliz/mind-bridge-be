#!/usr/bin/env node
/**
 * Apaga dados de aplicação no Supabase via service role:
 * - todos os usuários em auth.users (cascade limpa profiles e vínculos)
 * - tabelas de plataforma que sobrevivem à exclusão de usuários
 *
 * Uso:
 *   node --env-file=.env scripts/purge-supabase-data.mjs --dry-run
 *   node --env-file=.env scripts/purge-supabase-data.mjs --yes
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || !args.includes('--yes');

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Tabelas que podem restar após apagar auth.users.
 * (documentos de knowledge usam ON DELETE SET NULL em uploaded_by)
 */
const PLATFORM_TABLES = [
  { table: 'knowledge_documents', column: 'id', never: '00000000-0000-0000-0000-000000000000' },
  { table: 'ai_prompt_templates', column: 'key', never: '' },
  { table: 'ai_prompt_template_defaults', column: 'key', never: '' },
  { table: 'billing_platform_pricing', column: 'id', never: '' },
];

const isMissingTableError = (error) => {
  const message = error?.message ?? '';
  return (
    error?.code === 'PGRST205' ||
    message.includes('schema cache') ||
    message.includes('Could not find the table')
  );
};

const listAllAuthUsers = async () => {
  const users = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    users.push(...(data.users ?? []));
    if ((data.users ?? []).length < perPage) {
      break;
    }
    page += 1;
  }

  return users;
};

const deleteAllAuthUsers = async (users) => {
  let deleted = 0;
  for (const user of users) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      throw new Error(
        `Falha ao apagar auth user ${user.email ?? user.id}: ${error.message}`
      );
    }
    deleted += 1;
    console.log(`  auth: removido ${user.email ?? user.id}`);
  }
  return deleted;
};

const clearPlatformTables = async () => {
  for (const { table, column, never } of PLATFORM_TABLES) {
    const { error, count } = await admin
      .from(table)
      .delete({ count: 'exact' })
      .neq(column, never);

    if (error) {
      if (isMissingTableError(error)) {
        console.log(`  skip: ${table} (tabela ausente)`);
        continue;
      }
      throw new Error(`Falha ao limpar ${table}: ${error.message}`);
    }

    console.log(`  table: ${table} (${count ?? 0} linhas removidas)`);
  }
};

const main = async () => {
  console.log(`Supabase purge → ${url}`);
  console.log(dryRun ? 'Modo: dry-run (nada será apagado)' : 'Modo: escrita');

  const users = await listAllAuthUsers();
  console.log(`Usuários auth encontrados: ${users.length}`);

  if (dryRun) {
    for (const user of users) {
      console.log(`  would delete: ${user.email ?? user.id}`);
    }
    console.log('Tabelas de plataforma que seriam limpas:');
    for (const { table } of PLATFORM_TABLES) {
      console.log(`  - ${table}`);
    }
    console.log('\nPara executar de verdade: adicione --yes');
    return;
  }

  console.log('Apagando usuários auth…');
  const deletedUsers = await deleteAllAuthUsers(users);
  console.log(`Auth removidos: ${deletedUsers}`);

  console.log('Limpando tabelas de plataforma…');
  await clearPlatformTables();

  console.log('Purge concluído.');
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
