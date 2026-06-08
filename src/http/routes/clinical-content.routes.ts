import type { FastifyPluginAsync } from 'fastify';

import {
  assertPatientSelf,
  assertPsychologistPatientAccess,
} from '@application/authorization.js';
import type { Env } from '@config/env.js';
import { validateParams } from '@http/middleware/validate.js';
import { patientIdParamsSchema } from '@http/schemas/patient.schemas.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';
import { ensurePatientClinicalContent } from '@infrastructure/supabase/clinical-content.repository.js';

export const createClinicalContentRoutes =
  (env: Env): FastifyPluginAsync =>
  async (app) => {
    const admin = createAdminSupabaseClient(env);

    app.get('/patient/clinical-content', async (request) => {
      const auth = request.auth!;

      assertPatientSelf(auth, auth.userId);

      const content = await ensurePatientClinicalContent(admin, auth.userId);
      return { content };
    });

    app.get(
      '/psychologist/patients/:patientId/clinical-content',
      { preHandler: validateParams(patientIdParamsSchema) },
      async (request) => {
        const auth = request.auth!;
        const supabase = request.userSupabase!;
        const { patientId } = request.params as { patientId: string };

        await assertPsychologistPatientAccess(supabase, auth, patientId);

        const content = await ensurePatientClinicalContent(admin, patientId);
        return { content };
      }
    );
  };
