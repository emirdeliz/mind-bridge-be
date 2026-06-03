# Supabase local (Docker)

O backend usa [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), que sobe a stack oficial em **Docker** (Postgres, Auth, REST, Realtime, Storage, Studio, etc.).

Não é necessário manter um `docker-compose.yml` manual no repositório: o CLI gerencia os containers e aplica `supabase/migrations/` no primeiro `db reset` ou quando você recria o banco.

## Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (ou Docker Engine + Compose v2)
- Node.js 20+

## Subir a stack

Na raiz de `mind-bridge-be`:

```bash
npm install
npm run supabase:start
```

Ou:

```bash
bash scripts/supabase-start.sh
```

Na primeira execução o CLI baixa imagens; pode levar alguns minutos.

## Aplicar o schema Mind Bridge

Com os containers rodando:

```bash
npm run supabase:reset
```

Isso recria o banco local e executa todas as migrations em `supabase/migrations/` (schema inicial, `is_deleted` e `last_consultation_at` em `care_relationships`).

## Conectar a API ao Supabase local

```bash
npm run supabase:env
```

Atualiza `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` no `.env` a partir de `supabase status`.

Valores de referência (sem rodar o CLI): veja `.env.local.example`.

## URLs úteis (padrão do `config.toml`)

| Serviço               | URL                                                       |
| --------------------- | --------------------------------------------------------- |
| API (Kong)            | http://127.0.0.1:54321                                    |
| Studio                | http://127.0.0.1:54323                                    |
| Postgres              | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Inbucket (e-mail dev) | http://127.0.0.1:54324                                    |

Senha padrão do Postgres local: `postgres` (ver `npx supabase status`).

## Parar / status

```bash
npm run supabase:stop
npm run supabase:status
```

## Auth e front (`mind-bridge-web`)

Em `supabase/config.toml`, `site_url` e `additional_redirect_urls` incluem `http://127.0.0.1:3000` e `http://localhost:3000` para o Next.js local. Confirmação de e-mail está desabilitada em dev (`enable_confirmations = false`).

## Self-hosting completo (opcional)

Se precisar do compose “full stack” sem CLI (produção on-prem), use o repositório oficial: [supabase/docker](https://github.com/supabase/supabase/tree/master/docker). Para desenvolvimento deste projeto, o fluxo acima é o recomendado.
