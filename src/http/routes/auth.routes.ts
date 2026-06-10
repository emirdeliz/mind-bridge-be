import type { FastifyPluginAsync } from 'fastify';

import type { Env } from '@config/env.js';
import type { PatientSelfRegisterBody } from '@domain/patient.types.js';
import { validateBody } from '@http/middleware/validate.js';
import { registerPatientBodySchema } from '@http/schemas/auth.schemas.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';
import {
  InvalidInviteCodeError,
  registerPatientWithInviteCode,
} from '@infrastructure/supabase/patient.repository.js';

export const createAuthRoutes =
  (env: Env): FastifyPluginAsync =>
  async (app) => {
    const admin = createAdminSupabaseClient(env);

    app.post(
      '/auth/register-patient',
      {
        config: { public: true },
        preHandler: validateBody(registerPatientBodySchema),
      },
      async (request, reply) => {
        const body = request.body as PatientSelfRegisterBody;

        try {
          await registerPatientWithInviteCode(admin, body);
          return reply.status(201).send({ ok: true });
        } catch (error) {
          if (error instanceof InvalidInviteCodeError) {
            return reply.status(400).send({ error: error.message });
          }
          if (error instanceof Error && error.message.includes('already')) {
            return reply.status(409).send({ error: error.message });
          }
          throw error;
        }
      }
    );
  };
