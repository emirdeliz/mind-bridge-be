import Fastify from 'fastify';

import { loadEnv } from '@config/env.js';
import { warmAiPromptTemplateCache } from '@application/ai-prompt-template-cache.js';
import { buildServer } from '@http/server.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';

/**
 * Vercel Fastify detection requires a value import of `fastify` in the
 * entrypoint file (`src/server.ts`). The real instance is created in
 * `buildServer`; this binding keeps the import live for the detector/tsc.
 */
export { Fastify };

const start = async () => {
  const env = loadEnv();
  const app = await buildServer(env);

  try {
    const admin = createAdminSupabaseClient(env);
    await warmAiPromptTemplateCache(admin);
  } catch (error) {
    app.log.warn({ err: error }, 'Failed to warm AI prompt template cache');
  }

  const port = Number(process.env.PORT) || env.PORT;
  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`mind-bridge-be listening on port ${port}`);

  return app;
};

const appPromise = start().catch((error) => {
  console.error(error);
  process.exit(1);
});

export default appPromise;
