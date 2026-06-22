import { loadEnv } from '@config/env.js';
import { warmAiPromptTemplateCache } from '@application/ai-prompt-template-cache.js';
import { buildServer } from '@http/server.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';

const start = async () => {
  const env = loadEnv();
  const app = await buildServer(env);

  try {
    const admin = createAdminSupabaseClient(env);
    await warmAiPromptTemplateCache(admin);
  } catch (error) {
    app.log.warn({ err: error }, 'Failed to warm AI prompt template cache');
  }

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(`mind-bridge-be listening on port ${env.PORT}`);
};

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
