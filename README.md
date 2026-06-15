# mind-bridge-be

Backend API for [mind-bridge-web](../mind-bridge-web): Node.js, TypeScript, Fastify, Joi, Supabase Auth, LangGraph.js, and Google Gemini API (Ollama optional for local dev).

## Stack

| Layer            | Technology                             |
| ---------------- | -------------------------------------- |
| HTTP             | Fastify 5                              |
| Validation       | Joi                                    |
| Auth             | Supabase JWT (`Authorization: Bearer`) |
| Data             | Supabase Postgres + RLS                |
| AI orchestration | LangGraph.js                           |
| LLM              | Gemini API (`@langchain/google-genai`) or Ollama (local) |

## Path aliases

Imports use `@config`, `@domain`, `@application`, `@infrastructure`, `@http`, and `@ai` (same style as [mind-bridge-web](../mind-bridge-web)). Configured in `tsconfig.json`; `tsc-alias` rewrites them in `dist/` after `npm run build`.

## Project layout

```
src/
  config/           # env (Joi)
  domain/           # types
  http/             # routes, auth plugin, Joi schemas
  application/      # authorization rules
  infrastructure/   # Supabase clients & repositories
  ai/
    graphs/         # LangGraph: patient chat, psychologist copilot
    state/
    llm.ts
supabase/
  config.toml         # ports, auth redirects (local CLI)
  migrations/         # SQL schema + RLS starter
docker/README.md      # Supabase local via Docker
scripts/              # supabase-start.sh, supabase-env.sh, …
```

## Setup

```bash
cd mind-bridge-be
cp .env.example .env
# fill SUPABASE_URL, SUPABASE_ANON_KEY
npm install
```

**Supabase Cloud (recomendado para deploy):**

1. Crie um projeto em [supabase.com](https://supabase.com) (plano Free).
2. Em **Project Settings → API**, copie `URL`, `anon` e `service_role` para o `.env`.
3. Aplique as migrations: `npx supabase link` + `npx supabase db push` (ou rode os SQL em `supabase/migrations/` no SQL Editor).

**Supabase local (Docker):** see [docker/README.md](./docker/README.md).

```bash
npm run supabase:start    # sobe containers (somente local)
npm run supabase:reset    # local: db reset + seed | cloud: só seed idempotente
npm run supabase:env      # só atualiza SUPABASE_* no .env (local, após reset)
npm run seed:local        # seed demo (local ou cloud, idempotente)
npm run seed:cloud        # alias de seed:local quando .env aponta para Supabase Cloud
```

**Supabase Cloud:**

| Comando | O que faz |
|---------|-----------|
| `npm run supabase:push:cloud` | Aplica migrations no Cloud |
| `npm run seed:cloud` | Push migrations + seed idempotente |
| `npm run supabase:reset` | Igual ao seed quando `.env` aponta para Cloud |
| `npm run supabase:reset:cloud -- --confirm` | **Reset destrutivo**: `db reset --linked` + seed |

Pré-requisitos para reset Cloud:

1. `npx supabase login`
2. `SUPABASE_DB_PASSWORD` no `.env` (senha do banco no dashboard)
3. Primeira vez: `npx supabase link --project-ref <ref>` (o script tenta linkar automaticamente)

O reset Cloud apaga dados das tabelas públicas e reaplica migrations. Usuários em `auth.users` **permanecem**; o seed reutiliza contas existentes.

**Contas demo após seed local:** `psicologo.demo@mindbridge.local` / `demo123456` · paciente `ana.demo@mindbridge.local` / `demo123456`

**LLM — Google Gemini API (padrão):**

1. Obtenha uma API key em [Google AI Studio](https://aistudio.google.com/apikey).
2. No `.env`:

```bash
LLM_PROVIDER=gemini
GOOGLE_GENERATIVE_AI_API_KEY=your-key
GEMINI_CHAT_MODEL=gemini-2.0-flash
```

**LLM — OpenRouter (opcional):** defina `LLM_PROVIDER=openrouter`, crie uma API key em [openrouter.ai/keys](https://openrouter.ai/keys) e escolha o modelo (ex.: `google/gemma-2-9b-it:free`).

```bash
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your-key
OPENROUTER_CHAT_MODEL=google/gemma-2-9b-it:free
```

**LLM — Ollama local (opcional):** defina `LLM_PROVIDER=ollama` e rode `ollama pull gemma4`.

**Deploy do backend:** use [render.yaml](./render.yaml) (Render free tier) ou Railway/Fly. Defina `CORS_ORIGIN` com a URL do front na Vercel.

## Run

```bash
npm run dev
# http://localhost:4000/health
```

## API (authenticated unless noted)

| Method | Path                    | Role                                       |
| ------ | ----------------------- | ------------------------------------------ |
| GET    | `/health`               | public                                     |
| GET    | `/me`                   | any                                        |
| POST   | `/ai/patient/chat`      | patient (self only)                        |
| POST   | `/ai/psychologist/chat` | psychologist + active `care_relationships` |
| GET    | `/psychologist/patients` | psychologist (query: `name`, `includeDeleted`) |
| POST   | `/psychologist/patients` | psychologist (creates Auth user + care link) |
| PATCH  | `/psychologist/patients/:patientId` | psychologist |
| DELETE | `/psychologist/patients/:patientId` | psychologist (soft delete: `is_deleted`) |
| GET    | `/psychologist/patients/:patientId/clinical-content` | psychologist + care link |
| GET    | `/patient/clinical-content` | patient (self) |

### Example: patient chat

```bash
curl -X POST http://localhost:4000/ai/patient/chat \
  -H "Authorization: Bearer <supabase_access_token>" \
  -H "Content-Type: application/json" \
  -d '{"message":"Como posso me acalmar antes de uma reunião?","careContext":"TCC, foco em ansiedade laboral."}'
```

### Example: psychologist copilot

```bash
curl -X POST http://localhost:4000/ai/psychologist/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"patientId":"<uuid>","message":"Resumir padrões da última semana","clinicalContext":"Paciente Ana M., TCC."}'
```

## Security model

1. **JWT** validated on every protected route (`supabase.auth.getUser`).
2. **Profile** loaded from `profiles` (role: `patient` | `psychologist`).
3. **Authorization** in use cases: patients only `auth.uid()`; psychologists require active row in `care_relationships`.
4. **RLS** in Postgres (see migration) — defense in depth even if API has a bug.

Login/signup stay on the **web client** via `@supabase/supabase-js`; this API does not expose public auth endpoints.

## Next steps

- Persist chat turns to `chat_messages`
- Persist session notes / dashboard edits via API (hoje seed + leitura)

## Knowledge RAG (OpenRouter + pgvector)

1. Apply migration `017_knowledge_rag.sql` (`npm run supabase:push:cloud` or local reset).
2. Set in `.env`:
   - `RAG_ENABLED=true`
   - `OPENROUTER_API_KEY=...`
   - `OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small` (optional)
   - `KNOWLEDGE_UPLOAD_ROLE=psychologist` (default; who may upload/delete PDFs)
3. Index a PDF:
   - CLI: `npm run knowledge:ingest -- ./protocolo.pdf <psychologist-user-id> [title]`
   - API: `POST /knowledge/documents` (`multipart/form-data`, field `file`)
   - Web: Configurações → Documentos de contexto (RAG)
4. Chunking is **hybrid**: sections/topics first (headings, numbered titles, CAPÍTULO/SEÇÃO), then size-based splits for long sections (`RAG_CHUNK_SIZE` / `RAG_CHUNK_OVERLAP`).
5. Chat endpoints automatically retrieve relevant chunks when `RAG_ENABLED=true`.

List documents: `GET /knowledge/documents` (psychologist or admin).  
Archive: `DELETE /knowledge/documents/:documentId` (role per `KNOWLEDGE_UPLOAD_ROLE`).
