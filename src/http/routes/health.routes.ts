import type { FastifyPluginAsync } from 'fastify';

import type { Env } from '@config/env.js';

export const createHealthRoutes =
  (env: Env): FastifyPluginAsync =>
  async (app) => {
    app.get('/health', { config: { public: true } }, async () => ({
      status: 'ok',
      service: 'mind-bridge-be',
      llmProvider: env.LLM_PROVIDER,
      ragEnabled: env.RAG_ENABLED,
      ragChatEnabled: env.RAG_CHAT_ENABLED,
    }));
  };
