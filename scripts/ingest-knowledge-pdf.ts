import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import { ingestKnowledgePdf } from '../src/application/ingest-knowledge-document.js';
import { loadEnv } from '../src/config/env.js';
import { createAdminSupabaseClient } from '../src/infrastructure/supabase/client.js';

const usage = `Usage: npm run knowledge:ingest -- <path-to.pdf> [title]

Indexes a PDF into the knowledge base using OpenRouter embeddings.
Requires RAG_ENABLED=true and OPENROUTER_API_KEY in .env.`;

const filePath = process.argv[2];
const titleArg = process.argv[3];

if (!filePath) {
  console.error(usage);
  process.exit(1);
}

const env = loadEnv();
const admin = createAdminSupabaseClient(env);
const absolutePath = resolve(filePath);
const fileBuffer = await readFile(absolutePath);
const fileName = basename(absolutePath);

const document = await ingestKnowledgePdf(env, admin, {
  uploadedBy: null,
  title: titleArg ?? fileName,
  fileName,
  fileBuffer,
});

console.log(
  JSON.stringify(
    {
      id: document.id,
      title: document.title,
      fileName: document.fileName,
      chunkCount: document.chunkCount,
    },
    null,
    2
  )
);
