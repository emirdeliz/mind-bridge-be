import cors from '@fastify/cors';
import Fastify from 'fastify';

import type { Env } from '@config/env.js';
import { mapErrorToStatus } from '@http/errors.js';
import { registerAuthHook } from '@http/plugins/auth.js';
import { createAiRoutes } from '@http/routes/ai.routes.js';
import { createAuthRoutes } from '@http/routes/auth.routes.js';
import { createPsychologistInviteCodeRoutes } from '@http/routes/psychologist-invite-code.routes.js';
import { createClinicalContentRoutes } from '@http/routes/clinical-content.routes.js';
import { createPatientLikertRoutes } from '@http/routes/patient-likert.routes.js';
import { createPatientInviteCodeRoutes } from '@http/routes/patient-invite-code.routes.js';
import { createPatientInteractionRoutes } from '@http/routes/patient-interactions.routes.js';
import { createPsychologistBillingRoutes } from '@http/routes/psychologist-billing.routes.js';
import { createPsychologistPatientPaymentsRoutes } from '@http/routes/psychologist-patient-payments.routes.js';
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

  registerAuthHook(app, env);

  await app.register(healthRoutes);
  await app.register(createAuthRoutes(env));
  await app.register(meRoutes);
  await app.register(createAiRoutes(env));
  await app.register(createPsychologistPatientsRoutes(env));
  await app.register(createPsychologistInviteCodeRoutes(env));
  await app.register(createPsychologistBillingRoutes(env));
  await app.register(createPsychologistPatientPaymentsRoutes(env));
  await app.register(createPatientInviteCodeRoutes(env));
  await app.register(createPatientLikertRoutes(env));
  await app.register(createPatientInteractionRoutes(env));
  await app.register(createClinicalContentRoutes(env));

  return app;
};
