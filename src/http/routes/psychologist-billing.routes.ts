import type { FastifyPluginAsync } from 'fastify';

import { assertPsychologist } from '@application/authorization.js';
import { getPsychologistBilling } from '@application/get-psychologist-billing.js';
import type { Env } from '@config/env.js';
import { validateQuery } from '@http/middleware/validate.js';
import { getBillingQuerySchema } from '@http/schemas/billing.schemas.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';

export const createPsychologistBillingRoutes =
  (env: Env): FastifyPluginAsync =>
  async (app) => {
    const admin = createAdminSupabaseClient(env);

    app.get(
      '/psychologist/billing',
      { preHandler: validateQuery(getBillingQuerySchema) },
      async (request) => {
        const auth = request.auth!;
        assertPsychologist(auth);

        const query = request.query as { month?: string };
        const billing = await getPsychologistBilling(admin, auth.userId, {
          billingMonth: query.month,
        });

        return { billing };
      }
    );
  };
