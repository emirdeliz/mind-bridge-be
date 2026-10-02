import type { IncomingMessage, ServerResponse } from 'node:http';

import { loadEnv } from '@config/env.js';
import { warmAiPromptTemplateCache } from '@application/ai-prompt-template-cache.js';
import { buildServer } from '@http/server.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';

type FastifyApp = Awaited<ReturnType<typeof buildServer>>;

let appPromise: Promise<FastifyApp> | null = null;

const getApp = (): Promise<FastifyApp> => {
  if (!appPromise) {
    appPromise = (async () => {
      const env = loadEnv();
      const app = await buildServer(env);

      try {
        const admin = createAdminSupabaseClient(env);
        await warmAiPromptTemplateCache(admin);
      } catch (error) {
        app.log.warn(
          { err: error },
          'Failed to warm AI prompt template cache'
        );
      }

      await app.ready();
      return app;
    })().catch((error) => {
      appPromise = null;
      throw error;
    });
  }

  return appPromise;
};

/**
 * Vercel serverless handler. Prefer this over Fastify zero-config so the
 * TypeScript path aliases are rewritten by `tsc-alias` before deploy.
 */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const app = await getApp();
  app.server.emit('request', req, res);
}
