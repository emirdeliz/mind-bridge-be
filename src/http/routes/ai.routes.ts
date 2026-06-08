import { randomUUID } from 'node:crypto';

import type { FastifyPluginAsync } from 'fastify';

import type { Env } from '@config/env.js';
import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import { normalizeAppLanguage } from '@ai/prompts/psychologist-copilot-system.js';
import type { AppLanguage } from '@domain/types.js';
import {
  assertPatientSelf,
  assertPsychologistPatientAccess,
  ForbiddenError,
} from '@application/authorization.js';
import { runPatientChatGraph } from '@ai/graphs/patient-chat.graph.js';
import { runPsychologistCopilotGraph } from '@ai/graphs/psychologist-copilot.graph.js';
import { validateBody } from '@http/middleware/validate.js';
import {
  patientChatBodySchema,
  psychologistChatBodySchema,
} from '@http/schemas/ai.schemas.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';
import { recordPatientInteraction } from '@application/enrich-dashboard-snapshot.js';
import {
  appendPatientChatMessages,
  appendPsychologistChatMessages,
  ensurePatientClinicalContent,
} from '@infrastructure/supabase/clinical-content.repository.js';

export const createAiRoutes =
  (env: Env): FastifyPluginAsync =>
  async (app) => {
    const admin = createAdminSupabaseClient(env);
    app.post(
      '/ai/patient/chat',
      {
        preHandler: validateBody(patientChatBodySchema),
      },
      async (request) => {
        const auth = request.auth!;
        const body = request.body as {
          message: string;
          careContext?: string;
          language?: AppLanguage;
        };

        assertPatientSelf(auth, auth.userId);

        const reply = await runPatientChatGraph(env, {
          patientId: auth.userId,
          userMessage: body.message,
          careContext: body.careContext,
          language: normalizeAppLanguage(body.language),
        });

        const exchangedAt = new Date().toISOString();
        const persistedMessages: ClinicalChatMessage[] = [
          {
            id: randomUUID(),
            sender: 'user',
            text: body.message,
            createdAt: exchangedAt,
          },
          {
            id: randomUUID(),
            sender: 'agent',
            text: reply,
            createdAt: new Date().toISOString(),
          },
        ];

        await appendPatientChatMessages(admin, auth.userId, persistedMessages);
        await recordPatientInteraction(admin, auth.userId, {
          channel: 'text',
          source: 'web',
        });

        return {
          message: reply,
          patientId: auth.userId,
        };
      }
    );

    app.post(
      '/ai/psychologist/chat',
      {
        preHandler: validateBody(psychologistChatBodySchema),
      },
      async (request) => {
        const auth = request.auth!;
        const supabase = request.userSupabase!;
        const body = request.body as {
          patientId: string;
          message: string;
          clinicalContext?: string;
          sessionConsiderations?: string;
          language?: AppLanguage;
        };

        if (auth.role !== 'psychologist') {
          throw new ForbiddenError();
        }

        await assertPsychologistPatientAccess(supabase, auth, body.patientId);

        const clinicalContent = await ensurePatientClinicalContent(
          admin,
          body.patientId
        );
        const chatHistory = clinicalContent.psychologistChatSeed ?? [];

        const reply = await runPsychologistCopilotGraph(env, {
          psychologistId: auth.userId,
          patientId: body.patientId,
          userMessage: body.message,
          clinicalContext: body.clinicalContext,
          sessionConsiderations: body.sessionConsiderations,
          language: normalizeAppLanguage(body.language),
          chatHistory,
        });

        const exchangedAt = new Date().toISOString();
        const persistedMessages: ClinicalChatMessage[] = [
          {
            id: randomUUID(),
            sender: 'user',
            text: body.message,
            createdAt: exchangedAt,
          },
          {
            id: randomUUID(),
            sender: 'agent',
            text: reply,
            createdAt: new Date().toISOString(),
          },
        ];

        await appendPsychologistChatMessages(
          admin,
          body.patientId,
          persistedMessages
        );

        return {
          message: reply,
          patientId: body.patientId,
          psychologistId: auth.userId,
        };
      }
    );
  };
