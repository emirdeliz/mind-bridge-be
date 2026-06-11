import type { FastifyPluginAsync } from 'fastify';

import {
  assertPatientSelf,
  assertPsychologistPatientAccess,
} from '@application/authorization.js';
import { ensureClinicalInsightsOnRead } from '@application/ensure-clinical-insights.js';
import { endPsychologistSession } from '@application/end-psychologist-session.js';
import { refreshPsychologistSessionInsights } from '@application/refresh-psychologist-session-insights.js';
import { enrichDashboardSnapshotWithPatientActivity } from '@application/enrich-dashboard-snapshot.js';
import { normalizeAppLanguage } from '@ai/prompts/psychologist-copilot-system.js';
import type { Env } from '@config/env.js';
import type { AppLanguage } from '@domain/types.js';
import { validateBody, validateParams } from '@http/middleware/validate.js';
import { patientAnamnesisBodySchema } from '@http/schemas/anamnesis.schemas.js';
import {
  endPsychologistSessionBodySchema,
  updateClinicalSessionBodySchema,
} from '@http/schemas/clinical-content.schemas.js';
import { patientIdParamsSchema } from '@http/schemas/patient.schemas.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';
import { updatePsychologistPatientClinicalSession, updatePsychologistPatientAnamnesis } from '@infrastructure/supabase/clinical-content.repository.js';

export const createClinicalContentRoutes =
  (env: Env): FastifyPluginAsync =>
  async (app) => {
    const admin = createAdminSupabaseClient(env);

    app.get('/patient/clinical-content', async (request) => {
      const auth = request.auth!;
      const language = normalizeAppLanguage(
        (request.query as { language?: AppLanguage }).language
      );

      assertPatientSelf(auth, auth.userId);

      const content = await ensureClinicalInsightsOnRead(
        env,
        admin,
        auth.userId,
        language
      );
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

        const language = normalizeAppLanguage(
          (request.query as { language?: AppLanguage }).language
        );
        const content = await ensureClinicalInsightsOnRead(
          env,
          admin,
          patientId,
          language,
          { includePsychologistInsights: true }
        );
        const enriched = {
          ...content,
          dashboardSnapshot: await enrichDashboardSnapshotWithPatientActivity(
            admin,
            patientId,
            content.dashboardSnapshot,
            content.patientChatSeed
          ),
        };
        return { content: enriched };
      }
    );

    app.patch(
      '/psychologist/patients/:patientId/clinical-content',
      {
        preHandler: [
          validateParams(patientIdParamsSchema),
          validateBody(updateClinicalSessionBodySchema),
        ],
      },
      async (request) => {
        const auth = request.auth!;
        const supabase = request.userSupabase!;
        const { patientId } = request.params as { patientId: string };
        const body = request.body as {
          sessionContext?: string | null;
          currentSessionNoteContent?: string | null;
          language?: AppLanguage;
        };

        await assertPsychologistPatientAccess(supabase, auth, patientId);

        await updatePsychologistPatientClinicalSession(admin, patientId, body);

        const content = await refreshPsychologistSessionInsights(
          env,
          admin,
          patientId,
          normalizeAppLanguage(body.language)
        );

        return { content };
      }
    );

    app.patch(
      '/psychologist/patients/:patientId/anamnesis',
      {
        preHandler: [
          validateParams(patientIdParamsSchema),
          validateBody(patientAnamnesisBodySchema),
        ],
      },
      async (request) => {
        const auth = request.auth!;
        const supabase = request.userSupabase!;
        const { patientId } = request.params as { patientId: string };
        const body = request.body as Record<string, string | undefined>;

        await assertPsychologistPatientAccess(supabase, auth, patientId);

        const content = await updatePsychologistPatientAnamnesis(admin, patientId, {
          chiefComplaint: body.chiefComplaint ?? '',
          currentHistory: body.currentHistory ?? '',
          personalHistory: body.personalHistory ?? '',
          familyHistory: body.familyHistory ?? '',
          socialHistory: body.socialHistory ?? '',
          medicalPsychiatricHistory: body.medicalPsychiatricHistory ?? '',
          lifeHabits: body.lifeHabits ?? '',
          emotionalBehavioral: body.emotionalBehavioral ?? '',
          therapeuticGoals: body.therapeuticGoals ?? '',
          psychologistNotes: body.psychologistNotes ?? '',
        });

        return { anamnesis: content.anamnesis };
      }
    );

    app.post(
      '/psychologist/patients/:patientId/end-session',
      {
        preHandler: [
          validateParams(patientIdParamsSchema),
          validateBody(endPsychologistSessionBodySchema),
        ],
      },
      async (request) => {
        const auth = request.auth!;
        const supabase = request.userSupabase!;
        const { patientId } = request.params as { patientId: string };
        const body = request.body as {
          currentSessionNoteContent?: string | null;
          language?: AppLanguage;
        };

        await assertPsychologistPatientAccess(supabase, auth, patientId);

        const content = await endPsychologistSession(
          env,
          admin,
          patientId,
          body,
          normalizeAppLanguage(body.language)
        );

        return { content };
      }
    );
  };
