import cors from '@fastify/cors';
import Fastify from 'fastify';

import type { Env } from '@config/env.js';
import { mapErrorToStatus } from '@http/errors.js';
import { registerAuthPlugin } from '@http/plugins/auth.js';
import { createAiRoutes } from '@http/routes/ai.routes.js';
import { createPsychologistPatientsRoutes } from '@http/routes/psychologist-patients.routes.js';
import { healthRoutes } from '@http/routes/health.routes.js';
import { meRoutes } from '@http/routes/me.routes.js';

export const buildServer = async (env: Env) => {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  app.setErrorHandler((error, _request, reply) => {
    const mapped = mapErrorToStatus(error);
    reply.status(mapped.statusCode).send({ error: mapped.message });
  });

  await app.register(healthRoutes);
  await app.register(registerAuthPlugin(env));
  await app.register(meRoutes);
  await app.register(createAiRoutes(env));
  await app.register(createPsychologistPatientsRoutes(env));

  return app;
};
