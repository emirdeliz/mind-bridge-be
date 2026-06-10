import { randomUUID } from 'node:crypto';

import type { FastifyPluginAsync } from 'fastify';

import type { Env } from '@config/env.js';
import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import {
  buildPsychologistCopilotRetrievalContext,
  normalizeAppLanguage,
} from '@ai/prompts/psychologist-copilot-system.js';
import type { AppLanguage } from '@domain/types.js';
import {
  assertPatientSelf,
  assertPsychologistPatientAccess,
  ForbiddenError,
} from '@application/authorization.js';
import { runPatientChatGraph } from '@ai/graphs/patient-chat.graph.js';
import { countAgentQuestionsInChat } from '@ai/prompts/patient-chat-interaction.js';
import {
  getInteractionScopedHistory,
  getPatientChatInteractionClosingReply,
  resolvePatientChatInteraction,
  shouldClosePatientChatInteraction,
} from '@ai/prompts/patient-chat-session.js';
import { runPsychologistCopilotGraph } from '@ai/graphs/psychologist-copilot.graph.js';
import { validateBody } from '@http/middleware/validate.js';
import {
  patientChatBodySchema,
  psychologistChatBodySchema,
} from '@http/schemas/ai.schemas.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';
import {
  enrichDashboardSnapshotWithPatientActivity,
  recordPatientInteraction,
} from '@application/enrich-dashboard-snapshot.js';
import { refreshPatientInteractionSummary } from '@application/refresh-patient-interaction-summary.js';
import { refreshPsychologistSessionInsights } from '@application/refresh-psychologist-session-insights.js';
import { updateMoodFromPatientChat } from '@application/update-mood-from-patient-chat.js';
import {
  appendPatientChatMessages,
  appendPsychologistChatMessages,
  ensurePatientClinicalContent,
  updatePatientDashboardSnapshot,
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

        const clinicalContent = await ensurePatientClinicalContent(
          admin,
          auth.userId
        );
        const psychologistContext =
          clinicalContent.sessionContext?.trim() || body.careContext?.trim() || '';
        const language = normalizeAppLanguage(body.language);
        const chatHistory = clinicalContent.patientChatSeed ?? [];
        const { interactionId, isNewInteraction } =
          resolvePatientChatInteraction(chatHistory);
        const interactionHistory = getInteractionScopedHistory(
          chatHistory,
          interactionId,
          isNewInteraction
        );
        const questionCount = countAgentQuestionsInChat(interactionHistory);

        const reply = shouldClosePatientChatInteraction(questionCount)
          ? getPatientChatInteractionClosingReply(language)
          : await runPatientChatGraph(env, {
              patientId: auth.userId,
              userMessage: body.message,
              psychologistContext,
              chatHistory: interactionHistory,
              language,
            });

        const exchangedAt = new Date().toISOString();
        const persistedMessages: ClinicalChatMessage[] = [
          {
            id: randomUUID(),
            sender: 'user',
            text: body.message,
            createdAt: exchangedAt,
            interactionId,
            isInteractionStart: isNewInteraction,
          },
          {
            id: randomUUID(),
            sender: 'agent',
            text: reply,
            createdAt: new Date().toISOString(),
            interactionId,
          },
        ];

        const content = await appendPatientChatMessages(
          admin,
          auth.userId,
          persistedMessages
        );
        await recordPatientInteraction(admin, auth.userId, {
          channel: 'text',
          source: 'web',
        });

        const moodSnapshot = await updateMoodFromPatientChat(env, {
          currentSnapshot: content.dashboardSnapshot,
          userMessage: body.message,
          chatHistory: content.patientChatSeed,
          language: normalizeAppLanguage(body.language),
        });
        await updatePatientDashboardSnapshot(
          admin,
          auth.userId,
          moodSnapshot
        );

        const refreshedContent = await refreshPatientInteractionSummary(
          admin,
          auth.userId,
          normalizeAppLanguage(body.language)
        );

        return {
          message: reply,
          messages: persistedMessages,
          patientId: auth.userId,
          patientSummary: refreshedContent.patientSummary,
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
        const dashboardSnapshot = await enrichDashboardSnapshotWithPatientActivity(
          admin,
          body.patientId,
          clinicalContent.dashboardSnapshot,
          clinicalContent.patientChatSeed
        );
        const retrievalContext = buildPsychologistCopilotRetrievalContext(
          normalizeAppLanguage(body.language),
          {
            dashboardSnapshot,
            psychologistSummary: clinicalContent.psychologistSummary,
            patientSummary: clinicalContent.patientSummary,
            sessionInsights: clinicalContent.sessionInsights,
          }
        );

        const reply = await runPsychologistCopilotGraph(env, {
          psychologistId: auth.userId,
          patientId: body.patientId,
          userMessage: body.message,
          clinicalContext: body.clinicalContext,
          sessionConsiderations: body.sessionConsiderations,
          language: normalizeAppLanguage(body.language),
          chatHistory,
          retrievalContext,
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

        const refreshedContent = await refreshPsychologistSessionInsights(
          env,
          admin,
          body.patientId,
          normalizeAppLanguage(body.language)
        );

        return {
          message: reply,
          patientId: body.patientId,
          psychologistId: auth.userId,
          psychologistSummary: refreshedContent.psychologistSummary,
          sessionInsights: refreshedContent.sessionInsights,
        };
      }
    );
  };
