import type { FastifyPluginAsync } from 'fastify';

import { getPsychologistBilling } from '@application/get-psychologist-billing.js';
import { getAdminPlatformMetrics } from '@application/get-admin-platform-metrics.js';
import { listAdminPsychologistPatients } from '@application/list-admin-psychologist-patients.js';
import { assertAdmin, NotFoundError } from '@application/authorization.js';
import type { Env } from '@config/env.js';
import { parseAdminPatientInteractionPeriod } from '@domain/admin-patient-interaction-period.js';
import { parseAdminMetricsPeriod } from '@domain/admin-metrics-period.js';
import {
  validateParams,
  validateQuery,
} from '@http/middleware/validate.js';
import {
  adminPsychologistIdParamsSchema,
  getAdminPlatformMetricsQuerySchema,
  getAdminPsychologistBillingQuerySchema,
  getAdminPsychologistPatientsQuerySchema,
} from '@http/schemas/admin.schemas.js';
import {
  assertPsychologistProfileForAdmin,
  listPsychologistsForAdmin,
} from '@infrastructure/supabase/admin-psychologist.repository.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';

export const createAdminRoutes =
  (env: Env): FastifyPluginAsync =>
  async (app) => {
    const admin = createAdminSupabaseClient(env);

    app.get(
      '/admin/platform-metrics',
      { preHandler: validateQuery(getAdminPlatformMetricsQuerySchema) },
      async (request) => {
        const auth = request.auth!;
        assertAdmin(auth);

        const query = request.query as { period?: string };
        const period = parseAdminMetricsPeriod(query.period);
        const metrics = await getAdminPlatformMetrics(admin, period);

        return { metrics };
      }
    );

    app.get('/admin/psychologists', async (request) => {
      const auth = request.auth!;
      assertAdmin(auth);

      const psychologists = await listPsychologistsForAdmin(admin);
      return { psychologists };
    });

    app.get(
      '/admin/psychologists/:psychologistId/patients',
      {
        preHandler: [
          validateParams(adminPsychologistIdParamsSchema),
          validateQuery(getAdminPsychologistPatientsQuerySchema),
        ],
      },
      async (request) => {
        const auth = request.auth!;
        assertAdmin(auth);

        const { psychologistId } = request.params as { psychologistId: string };
        const query = request.query as {
          name?: string;
          includeDeleted?: boolean;
          interactionPeriod?: string;
        };

        try {
          await assertPsychologistProfileForAdmin(admin, psychologistId);
        } catch {
          throw new NotFoundError('Psychologist not found');
        }

        const interactionPeriod = parseAdminPatientInteractionPeriod(
          query.interactionPeriod
        );
        const result = await listAdminPsychologistPatients(
          admin,
          psychologistId,
          {
            name: query.name,
            includeDeleted: query.includeDeleted ?? false,
            interactionPeriod,
          }
        );

        return result;
      }
    );

    app.get(
      '/admin/psychologists/:psychologistId/billing',
      {
        preHandler: [
          validateParams(adminPsychologistIdParamsSchema),
          validateQuery(getAdminPsychologistBillingQuerySchema),
        ],
      },
      async (request) => {
        const auth = request.auth!;
        assertAdmin(auth);

        const { psychologistId } = request.params as { psychologistId: string };
        const query = request.query as { month?: string };

        try {
          await assertPsychologistProfileForAdmin(admin, psychologistId);
        } catch {
          throw new NotFoundError('Psychologist not found');
        }

        const billing = await getPsychologistBilling(admin, psychologistId, {
          billingMonth: query.month,
        });

        return { billing };
      }
    );
  };
