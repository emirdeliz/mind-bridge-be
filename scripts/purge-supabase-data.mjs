#!/usr/bin/env node
/**
 * Apaga TODOS os dados de aplicação no Supabase e mantém apenas o schema.
 *
 * Preferência: TRUNCATE via Postgres (SUPABASE_DB_PASSWORD / DATABASE_URL).
 * Fallback: delete via service role em todas as tabelas public + auth.users.
 *
 * Uso:
 *   npm run supabase:purge-data -- --dry-run
 *   npm run supabase:purge-data -- --yes
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;

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
 * Ordem filhos → pais (fallback REST). Cobre todas as tabelas public do projeto.
 * filterColumn: coluna NOT NULL usada no filtro exigido pelo PostgREST.
 */
const PUBLIC_TABLES = [
  { table: 'knowledge_chunks', filterColumn: 'id' },
  { table: 'knowledge_documents', filterColumn: 'id' },
  { table: 'psychologist_ai_prompt_templates', filterColumn: 'psychologist_id' },
  { table: 'psychologist_chat_shortcuts', filterColumn: 'id' },
  { table: 'psychologist_appointments', filterColumn: 'id' },
  { table: 'psychologist_scheduling_settings', filterColumn: 'psychologist_id' },
  { table: 'patient_session_payments', filterColumn: 'id' },
  { table: 'care_relationship_billing_events', filterColumn: 'id' },
  { table: 'psychologist_billing_daily_snapshots', filterColumn: 'id' },
  { table: 'psychologist_billing_monthly', filterColumn: 'id' },
  { table: 'psychologist_billing_discounts', filterColumn: 'psychologist_id' },
  { table: 'psychologist_invite_codes', filterColumn: 'psychologist_id' },
  { table: 'patient_interactions', filterColumn: 'id' },
  { table: 'patient_clinical_content', filterColumn: 'patient_id' },
  { table: 'care_relationships', filterColumn: 'id' },
  { table: 'ai_prompt_templates', filterColumn: 'key' },
  { table: 'ai_prompt_template_defaults', filterColumn: 'key' },
  { table: 'billing_platform_pricing', filterColumn: 'id' },
  { table: 'profiles', filterColumn: 'id' },
];

const isMissingTableError = (error) => {
  const message = error?.message ?? '';
  return (
    error?.code === 'PGRST205' ||
    message.includes('schema cache') ||
    message.includes('Could not find the table')
  );
};

const isCloudSupabaseUrl = (value) =>
  typeof value === 'string' && value.includes('supabase.co');

const readTempFile = (name) => {
  const path = join(ROOT, 'supabase', '.temp', name);
  if (!existsSync(path)) {
    return '';
  }
  return readFileSync(path, 'utf8').trim();
};

const extractProjectRef = (supabaseUrl) => {
  const match = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match?.[1] ?? readTempFile('project-ref');
};

/** pooler-url: postgresql://postgres.REF@host:5432/postgres */
const injectPasswordIntoPoolerUrl = (raw) => {
  if (!raw.startsWith('postgresql://') || !dbPassword) {
    return '';
  }

  // Already has password
  if (/postgresql:\/\/[^:]+:[^@]+@/.test(raw)) {
    return raw;
  }

  return raw.replace(
    /^(postgresql:\/\/[^:@]+)@/,
    `$1:${encodeURIComponent(dbPassword)}@`
  );
};

const resolveDatabaseUrl = () => {
  if (databaseUrl) {
    return databaseUrl;
  }

  if (isCloudSupabaseUrl(url) && dbPassword) {
    const fromPooler = injectPasswordIntoPoolerUrl(readTempFile('pooler-url'));
    if (fromPooler) {
      return fromPooler;
    }

    const projectRef = extractProjectRef(url);
    if (projectRef) {
      return `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`;
    }
  }

  if (!isCloudSupabaseUrl(url)) {
    return 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  }

  return '';
};

const PURGE_SQL = `
DO $$
DECLARE
  stmt text;
BEGIN
  SELECT 'TRUNCATE TABLE ' || string_agg(format('public.%I', tablename), ', ')
    || ' RESTART IDENTITY CASCADE'
  INTO stmt
  FROM pg_tables
  WHERE schemaname = 'public';

  IF stmt IS NOT NULL THEN
    EXECUTE stmt;
  END IF;
END $$;

TRUNCATE TABLE auth.users RESTART IDENTITY CASCADE;
`;

const purgeViaPostgres = async (connectionString) => {
  let pg;
  try {
    pg = await import('pg');
  } catch {
    return { ok: false, reason: 'pacote pg não instalado' };
  }

  const Client = pg.default?.Client ?? pg.Client;
  const client = new Client({
    connectionString,
    ssl: isCloudSupabaseUrl(url) ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    await client.query(PURGE_SQL);

    const { rows: authCount } = await client.query(
      `SELECT count(*)::int AS count FROM auth.users`
    );

    const { rows: publicCounts } = await client.query(`
      SELECT relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
    `);

    return {
      ok: true,
      publicTables: publicCounts.length,
      authUsers: authCount[0]?.count ?? 0,
    };
  } finally {
    await client.end().catch(() => undefined);
  }
};

const clearPublicTable = async ({ table, filterColumn }) => {
  const { error, count } = await admin
    .from(table)
    .delete({ count: 'exact' })
    .not(filterColumn, 'is', null);

  if (error) {
    if (isMissingTableError(error)) {
      console.log(`  skip: ${table} (ausente)`);
      return 0;
    }
    throw new Error(`Falha ao limpar ${table}: ${error.message}`);
  }

  console.log(`  table: ${table} (${count ?? 0} linhas)`);
  return count ?? 0;
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

const deleteAllAuthUsers = async () => {
  let deleted = 0;
  while (true) {
    const users = await listAllAuthUsers();
    if (!users.length) {
      break;
    }

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
  }
  return deleted;
};

const countTableRows = async (table) => {
  const { count, error } = await admin
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error) {
    if (isMissingTableError(error)) {
      return null;
    }
    throw error;
  }

  return count ?? 0;
};

const verifyEmpty = async () => {
  const leftovers = [];

  for (const { table } of PUBLIC_TABLES) {
    const count = await countTableRows(table);
    if (count === null) {
      continue;
    }
    if (count > 0) {
      leftovers.push(`${table}=${count}`);
    }
  }

  const authUsers = await listAllAuthUsers();
  if (authUsers.length) {
    leftovers.push(`auth.users=${authUsers.length}`);
  }

  return leftovers;
};

const purgeViaRest = async () => {
  console.log('Limpando tabelas public via service role…');
  for (const entry of PUBLIC_TABLES) {
    await clearPublicTable(entry);
  }

  console.log('Apagando usuários auth…');
  const deletedUsers = await deleteAllAuthUsers();
  console.log(`Auth removidos: ${deletedUsers}`);
};

const main = async () => {
  console.log(`Supabase purge → ${url}`);
  console.log(
    dryRun
      ? 'Modo: dry-run (nada será apagado)'
      : 'Modo: escrita (schema preservado; dados removidos)'
  );

  const authUsers = await listAllAuthUsers();
  console.log(`Usuários auth encontrados: ${authUsers.length}`);
  console.log(`Tabelas public cobertas: ${PUBLIC_TABLES.length}`);

  if (dryRun) {
    for (const user of authUsers) {
      console.log(`  would delete auth: ${user.email ?? user.id}`);
    }
    for (const { table } of PUBLIC_TABLES) {
      const count = await countTableRows(table);
      if (count === null) {
        console.log(`  would clear: ${table} (ausente)`);
      } else {
        console.log(`  would clear: ${table} (${count} linhas)`);
      }
    }
    console.log(
      '\nPara executar de verdade: npm run supabase:purge-data -- --yes'
    );
    return;
  }

  const connectionString = resolveDatabaseUrl();
  let usedPostgres = false;

  if (connectionString) {
    console.log('Tentando TRUNCATE via Postgres…');
    try {
      const result = await purgeViaPostgres(connectionString);
      if (result.ok) {
        usedPostgres = true;
        console.log(
          `TRUNCATE ok (${result.publicTables} tabelas public; auth.users=${result.authUsers})`
        );
      } else {
        console.warn(
          `Postgres indisponível (${result.reason}). Usando fallback REST…`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Postgres falhou (${message}). Usando fallback REST…`);
    }
  } else {
    console.warn(
      'DATABASE_URL / SUPABASE_DB_PASSWORD ausentes. Usando fallback REST…'
    );
  }

  if (!usedPostgres) {
    await purgeViaRest();
  } else {
    const remainingAuth = await listAllAuthUsers();
    if (remainingAuth.length) {
      console.log('Removendo auth.users remanescentes via Admin API…');
      await deleteAllAuthUsers();
    }
  }

  console.log('Verificando residual…');
  const leftovers = await verifyEmpty();
  if (leftovers.length) {
    console.error(`Purge incompleto: ${leftovers.join(', ')}`);
    process.exit(1);
  }

  console.log('Purge concluído: schema intacto, dados zerados.');
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
