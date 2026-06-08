import type { FastifyPluginAsync } from 'fastify';

import { assertPatientSelf } from '@application/authorization.js';
import { recordPatientInteraction } from '@application/enrich-dashboard-snapshot.js';
import type { Env } from '@config/env.js';
import { validateBody } from '@http/middleware/validate.js';
import {
  logMoodDiaryBodySchema,
  logPatientInteractionBodySchema,
} from '@http/schemas/patient-interaction.schemas.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';

export const createPatientInteractionRoutes =
  (env: Env): FastifyPluginAsync =>
  async (app) => {
    const admin = createAdminSupabaseClient(env);

    app.post(
      '/patient/mood-diary',
      { preHandler: validateBody(logMoodDiaryBodySchema) },
      async (request) => {
        const auth = request.auth!;
        const body = request.body as {
          moodScore: number;
          source?: 'web' | 'app';
        };

        assertPatientSelf(auth, auth.userId);

        const interaction = await recordPatientInteraction(admin, auth.userId, {
          channel: 'mood_diary',
          source: body.source ?? 'web',
          moodScore: body.moodScore,
        });

        return { interaction };
      }
    );

    app.post(
      '/patient/interactions',
      { preHandler: validateBody(logPatientInteractionBodySchema) },
      async (request) => {
        const auth = request.auth!;
        const body = request.body as {
          channel: 'text' | 'audio' | 'notification' | 'mood_diary';
          source?: 'web' | 'app';
          moodScore?: number;
        };

        assertPatientSelf(auth, auth.userId);

        const interaction = await recordPatientInteraction(admin, auth.userId, {
          channel: body.channel,
          source: body.source ?? 'web',
          moodScore: body.moodScore ?? null,
        });

        return { interaction };
      }
    );
  };
