import type { FastifyPluginAsync } from 'fastify';

import { assertPsychologist } from '@application/authorization.js';
import type { Env } from '@config/env.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';
import {
  getOrCreatePsychologistInviteCode,
  regeneratePsychologistInviteCode,
} from '@infrastructure/supabase/invite-code.repository.js';

export const createPsychologistInviteCodeRoutes =
  (env: Env): FastifyPluginAsync =>
  async (app) => {
    const admin = createAdminSupabaseClient(env);

    app.get('/psychologist/invite-code', async (request) => {
      const auth = request.auth!;
      assertPsychologist(auth);

      const code = await getOrCreatePsychologistInviteCode(admin, auth.userId);
      return { code };
    });

    app.post('/psychologist/invite-code/regenerate', async (request) => {
      const auth = request.auth!;
      assertPsychologist(auth);

      const code = await regeneratePsychologistInviteCode(admin, auth.userId);
      return { code };
    });
  };
