# mind-bridge-be

Backend API for [mind-bridge-web](../mind-bridge-web): Node.js, TypeScript, Fastify, Joi, Supabase Auth, LangGraph.js, and Ollama.

## Stack

| Layer | Technology |
|-------|------------|
| HTTP | Fastify 5 |
| Validation | Joi |
| Auth | Supabase JWT (`Authorization: Bearer`) |
| Data | Supabase Postgres + RLS |
| AI orchestration | LangGraph.js |
| LLM | Ollama (`@langchain/ollama`) |

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
supabase/migrations/  # SQL schema + RLS starter
```

## Setup

```bash
cd mind-bridge-be
cp .env.example .env
# fill SUPABASE_URL, SUPABASE_ANON_KEY
npm install
```

Apply `supabase/migrations/001_initial_schema.sql` in your Supabase project.

Ensure Ollama is running with the chat model from `.env`:

```bash
ollama pull llama3.2
```

## Run

```bash
npm run dev
# http://localhost:4000/health
```

## API (authenticated unless noted)

| Method | Path | Role |
|--------|------|------|
| GET | `/health` | public |
| GET | `/me` | any |
| POST | `/ai/patient/chat` | patient (self only) |
| POST | `/ai/psychologist/chat` | psychologist + active `care_relationships` |

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

- Wire pgvector RAG in `retrieve` graph nodes
- Persist chat turns to `chat_messages`
- Connect `mind-bridge-web` to this API instead of local mocks
