import type { FastifyPluginAsync } from 'fastify';

import { assertPatientSelf } from '@application/authorization.js';
import type { Env } from '@config/env.js';
import { validateBody } from '@http/middleware/validate.js';
import { linkPatientInviteCodeBodySchema } from '@http/schemas/patient-invite.schemas.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';
import {
  InvalidInviteCodeError,
  linkPatientWithInviteCode,
} from '@infrastructure/supabase/patient.repository.js';

export const createPatientInviteCodeRoutes =
  (env: Env): FastifyPluginAsync =>
  async (app) => {
    const admin = createAdminSupabaseClient(env);

    app.post(
      '/patient/invite-code',
      { preHandler: validateBody(linkPatientInviteCodeBodySchema) },
      async (request, reply) => {
        const auth = request.auth!;
        const body = request.body as { inviteCode: string };

        assertPatientSelf(auth, auth.userId);

        try {
          await linkPatientWithInviteCode(admin, auth.userId, body.inviteCode);
          return reply.status(200).send({ ok: true });
        } catch (error) {
          if (error instanceof InvalidInviteCodeError) {
            return reply.status(400).send({ error: error.message });
          }
          throw error;
        }
      }
    );
  };
