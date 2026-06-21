import type { FastifyPluginAsync } from 'fastify';

import { assertPatientSelf } from '@application/authorization.js';
import type { Env } from '@config/env.js';
import type { LikertDimensionId } from '@domain/clinical-content.types.js';
import { validateBody } from '@http/middleware/validate.js';
import { updateLikertCheckInBodySchema } from '@http/schemas/likert.schemas.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';
import { updatePatientLikertCheckIn } from '@infrastructure/supabase/clinical-content.repository.js';

export const createPatientLikertRoutes =
  (env: Env): FastifyPluginAsync =>
  async (app) => {
    const admin = createAdminSupabaseClient(env);

    app.patch(
      '/patient/likert-check-in',
      { preHandler: validateBody(updateLikertCheckInBodySchema) },
      async (request) => {
        const auth = request.auth!;
        const body = request.body as {
          localDate: string;
          scores: Partial<Record<LikertDimensionId, number>>;
        };

        assertPatientSelf(auth, auth.userId);

        const content = await updatePatientLikertCheckIn(
          admin,
          auth.userId,
          body.scores,
          body.localDate
        );

        return { content };
      }
    );
  };
