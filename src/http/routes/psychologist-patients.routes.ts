import type { FastifyPluginAsync } from 'fastify';

import { assertPsychologist, NotFoundError } from '@application/authorization.js';
import type { Env } from '@config/env.js';
import type { PsychologistPatientSaveBody } from '@domain/patient.types.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '@http/middleware/validate.js';
import {
  createPatientBodySchema,
  listPatientsQuerySchema,
  patientIdParamsSchema,
  savePatientBodySchema,
} from '@http/schemas/patient.schemas.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';
import {
  createPatientForPsychologist,
  listPatientsForPsychologist,
  restorePatientForPsychologist,
  softDeletePatientForPsychologist,
  updatePatientForPsychologist,
} from '@infrastructure/supabase/patient.repository.js';

export const createPsychologistPatientsRoutes =
  (env: Env): FastifyPluginAsync =>
  async (app) => {
    const admin = createAdminSupabaseClient(env);

    app.get(
      '/psychologist/patients',
      { preHandler: validateQuery(listPatientsQuerySchema) },
      async (request) => {
        const auth = request.auth!;
        assertPsychologist(auth);

        const query = request.query as {
          name?: string;
          includeDeleted?: boolean;
        };

        const patients = await listPatientsForPsychologist(
          admin,
          auth.userId,
          {
            name: query.name,
            includeDeleted: query.includeDeleted ?? false,
          }
        );

        return { patients };
      }
    );

    app.post(
      '/psychologist/patients',
      { preHandler: validateBody(createPatientBodySchema) },
      async (request, reply) => {
        const auth = request.auth!;
        assertPsychologist(auth);

        const body = request.body as PsychologistPatientSaveBody;

        try {
          const patient = await createPatientForPsychologist(
            admin,
            auth.userId,
            body
          );
          return reply.status(201).send({ patient });
        } catch (error) {
          if (error instanceof Error && error.message.includes('already')) {
            return reply.status(409).send({ error: error.message });
          }
          throw error;
        }
      }
    );

    app.patch(
      '/psychologist/patients/:patientId',
      {
        preHandler: [
          validateParams(patientIdParamsSchema),
          validateBody(savePatientBodySchema),
        ],
      },
      async (request, reply) => {
        const auth = request.auth!;
        assertPsychologist(auth);

        const { patientId } = request.params as { patientId: string };
        const body = request.body as PsychologistPatientSaveBody;

        try {
          const patient = await updatePatientForPsychologist(
            admin,
            auth.userId,
            patientId,
            body
          );
          return { patient };
        } catch (error) {
          if (error instanceof NotFoundError) {
            return reply.status(404).send({ error: error.message });
          }
          throw error;
        }
      }
    );

    app.post(
      '/psychologist/patients/:patientId/restore',
      { preHandler: validateParams(patientIdParamsSchema) },
      async (request, reply) => {
        const auth = request.auth!;
        assertPsychologist(auth);

        const { patientId } = request.params as { patientId: string };

        try {
          const patient = await restorePatientForPsychologist(
            admin,
            auth.userId,
            patientId
          );
          return { patient };
        } catch (error) {
          if (error instanceof NotFoundError) {
            return reply.status(404).send({ error: error.message });
          }
          throw error;
        }
      }
    );

    app.delete(
      '/psychologist/patients/:patientId',
      { preHandler: validateParams(patientIdParamsSchema) },
      async (request, reply) => {
        const auth = request.auth!;
        assertPsychologist(auth);

        const { patientId } = request.params as { patientId: string };

        try {
          await softDeletePatientForPsychologist(
            admin,
            auth.userId,
            patientId
          );
          return reply.status(204).send();
        } catch (error) {
          if (error instanceof NotFoundError) {
            return reply.status(404).send({ error: error.message });
          }
          throw error;
        }
      }
    );
  };
