import type { FastifyPluginAsync } from 'fastify';

import { assertPsychologist } from '@application/authorization.js';
import { getPsychologistBilling } from '@application/get-psychologist-billing.js';
import type { Env } from '@config/env.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';

export const createPsychologistBillingRoutes =
  (env: Env): FastifyPluginAsync =>
  async (app) => {
    const admin = createAdminSupabaseClient(env);

    app.get('/psychologist/billing', async (request) => {
      const auth = request.auth!;
      assertPsychologist(auth);

      const billing = await getPsychologistBilling(admin, auth.userId);
      return { billing };
    });
  };
