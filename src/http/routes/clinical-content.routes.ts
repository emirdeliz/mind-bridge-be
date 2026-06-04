import type { FastifyPluginAsync } from 'fastify';

import {
  assertPatientSelf,
  assertPsychologistPatientAccess,
  NotFoundError,
} from '@application/authorization.js';
import { getPatientClinicalContent } from '@infrastructure/supabase/clinical-content.repository.js';
import { patientIdParamsSchema } from '@http/schemas/patient.schemas.js';
import { validateParams } from '@http/middleware/validate.js';

export const createClinicalContentRoutes = (): FastifyPluginAsync =>
  async (app) => {
    app.get('/patient/clinical-content', async (request) => {
      const auth = request.auth!;
      const supabase = request.userSupabase!;

      assertPatientSelf(auth, auth.userId);

      const content = await getPatientClinicalContent(supabase, auth.userId);
      if (!content) {
        throw new NotFoundError('Clinical content not found');
      }

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

        const content = await getPatientClinicalContent(supabase, patientId);
        if (!content) {
          throw new NotFoundError('Clinical content not found');
        }

        return { content };
      }
    );
  };
