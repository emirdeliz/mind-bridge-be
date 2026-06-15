import type { FastifyPluginAsync } from 'fastify';

import { getAdminPlatformMetrics } from '@application/get-admin-platform-metrics.js';
import { assertAdmin } from '@application/authorization.js';
import type { Env } from '@config/env.js';
import { parseAdminMetricsPeriod } from '@domain/admin-metrics-period.js';
import { validateQuery } from '@http/middleware/validate.js';
import { getAdminPlatformMetricsQuerySchema } from '@http/schemas/admin.schemas.js';
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
  };
