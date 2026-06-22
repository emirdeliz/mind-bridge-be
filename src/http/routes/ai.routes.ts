import { randomUUID } from 'node:crypto';

import type {
  FastifyBaseLogger,
  FastifyPluginAsync,
  FastifyReply,
} from 'fastify';

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
import { getRecentInteractionsMessages } from '@application/patient-chat-interaction-groups.js';
import {
  runPatientChatGraph,
  streamPatientChatGraph,
} from '@ai/graphs/patient-chat.graph.js';
import { countAgentQuestionsInChat } from '@ai/prompts/patient-chat-interaction.js';
import {
  getInteractionScopedHistory,
  getPatientChatInteractionClosingReply,
  isAgentInteractionEndReply,
  resolvePatientChatInteraction,
  shouldClosePatientChatInteraction,
} from '@ai/prompts/patient-chat-session.js';
import {
  runPsychologistCopilotGraph,
  streamPsychologistCopilotGraph,
} from '@ai/graphs/psychologist-copilot.graph.js';
import {
  endAiStream,
  startAiStream,
  wantsAiStream,
  writeAiStreamEvent,
} from '@http/ai-stream.js';
import { validateBody } from '@http/middleware/validate.js';
import {
  patientChatBodySchema,
  psychologistChatBodySchema,
} from '@http/schemas/ai.schemas.js';
import { listActivePsychologistIdsForPatient } from '@infrastructure/supabase/profile.repository.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';
import { retrieveKnowledgeContext } from '@application/retrieve-knowledge-context.js';
import { recordPatientInteraction } from '@application/enrich-dashboard-snapshot.js';
import { processPatientChatSideEffects } from '@application/process-patient-chat-side-effects.js';
import { refreshPsychologistSessionInsights } from '@application/refresh-psychologist-session-insights.js';
import { runInBackground } from '@application/run-in-background.js';
import {
  appendPatientChatMessages,
  appendPsychologistChatMessages,
  ensurePatientClinicalContent,
} from '@infrastructure/supabase/clinical-content.repository.js';

const buildPatientChatPersistedMessages = (input: {
  userMessageId: string;
  agentMessageId: string;
  userMessage: string;
  reply: string;
  interactionId: string;
  isNewInteraction: boolean;
  isInteractionEnd: boolean;
}): ClinicalChatMessage[] => {
  const exchangedAt = new Date().toISOString();
  return [
    {
      id: input.userMessageId,
      sender: 'user',
      text: input.userMessage,
      createdAt: exchangedAt,
      interactionId: input.interactionId,
      isInteractionStart: input.isNewInteraction,
    },
    {
      id: input.agentMessageId,
      sender: 'agent',
      text: input.reply,
      createdAt: new Date().toISOString(),
      interactionId: input.interactionId,
      isInteractionEnd: input.isInteractionEnd,
    },
  ];
};

const persistPatientChatExchange = async (
  env: Env,
  admin: ReturnType<typeof createAdminSupabaseClient>,
  logger: FastifyBaseLogger,
  input: {
    patientId: string;
    userMessage: string;
    reply: string;
    language: AppLanguage;
    interactionId: string;
    isNewInteraction: boolean;
    isInteractionEnd: boolean;
    userMessageId: string;
    agentMessageId: string;
  }
): Promise<void> => {
  const persistedMessages = buildPatientChatPersistedMessages(input);

  await appendPatientChatMessages(admin, input.patientId, persistedMessages);
  await recordPatientInteraction(admin, input.patientId, {
    channel: 'text',
    source: 'web',
  });

  runInBackground(logger, 'patient-chat-side-effects', () =>
    processPatientChatSideEffects(env, admin, {
      patientId: input.patientId,
      userMessage: input.userMessage,
      language: input.language,
      isInteractionEnd: input.isInteractionEnd,
    })
  );
};

const streamLlmReply = async (
  reply: FastifyReply,
  generate: (onDelta: (delta: string) => void) => Promise<string>
): Promise<string> => {
  startAiStream(reply);

  try {
    return await generate((delta) => {
      writeAiStreamEvent(reply, { type: 'delta', delta });
    });
  } catch (error) {
    writeAiStreamEvent(reply, {
      type: 'error',
      error:
        error instanceof Error ? error.message : 'Failed to generate reply',
    });
    endAiStream(reply);
    throw error;
  }
};

const finishAiStream = (
  reply: FastifyReply,
  event: Extract<import('@http/ai-stream.js').AiStreamEvent, { type: 'done' }>
): void => {
  writeAiStreamEvent(reply, event);
  endAiStream(reply);
};

const joinRetrievalContexts = (
  ...sections: Array<string | undefined>
): string =>
  sections
    .map((section) => section?.trim())
    .filter((section): section is string => Boolean(section))
    .join('\n\n');

const loadKnowledgeRetrievalContext = async (
  env: Env,
  admin: ReturnType<typeof createAdminSupabaseClient>,
  logger: FastifyBaseLogger,
  input: {
    query: string;
    language: AppLanguage;
    psychologistIds: string[];
  }
): Promise<string> => {
  if (!env.RAG_ENABLED || !env.RAG_CHAT_ENABLED || !input.psychologistIds.length) {
    return '';
  }

  try {
    return await retrieveKnowledgeContext(env, admin, input.query, {
      languageInput: input.language,
      psychologistIds: input.psychologistIds,
    });
  } catch (error) {
    logger.warn(
      {
        err: error instanceof Error ? error.message : error,
        psychologistCount: input.psychologistIds.length,
      },
      'patient knowledge retrieval failed; continuing without RAG'
    );
    return '';
  }
};

export const createAiRoutes =
  (env: Env): FastifyPluginAsync =>
  async (app) => {
    const admin = createAdminSupabaseClient(env);
    app.post(
      '/ai/patient/chat',
      {
        preHandler: validateBody(patientChatBodySchema),
      },
      async (request, reply) => {
        const auth = request.auth!;
        const body = request.body as {
          message: string;
          careContext?: string;
          language?: AppLanguage;
        };
        const useStream = wantsAiStream(request);

        assertPatientSelf(auth, auth.userId);

        const clinicalContent = await ensurePatientClinicalContent(
          admin,
          auth.userId
        );
        const psychologistContext =
          clinicalContent.sessionContext?.trim() ||
          body.careContext?.trim() ||
          '';
        const language = normalizeAppLanguage(body.language);
        const chatHistory = clinicalContent.patientChatSeed ?? [];
        const { interactionId, isNewInteraction } =
          resolvePatientChatInteraction(chatHistory);
        const currentInteractionHistory = getInteractionScopedHistory(
          chatHistory,
          interactionId,
          isNewInteraction
        );
        const contextHistory = getRecentInteractionsMessages(chatHistory);
        const questionCount = countAgentQuestionsInChat(currentInteractionHistory);
        const forcedClosing = shouldClosePatientChatInteraction(questionCount);
        const patientPsychologistIds =
          await listActivePsychologistIdsForPatient(admin, auth.userId);
        const knowledgeRetrieval = forcedClosing
          ? ''
          : await loadKnowledgeRetrievalContext(env, admin, request.log, {
              query: body.message,
              language,
              psychologistIds: patientPsychologistIds,
            });

        const userMessageId = randomUUID();
        const agentMessageId = randomUUID();

        let agentReply: string;
        if (forcedClosing) {
          agentReply = getPatientChatInteractionClosingReply(language);
        } else if (useStream) {
          agentReply = await streamLlmReply(reply, (onDelta) =>
            streamPatientChatGraph(
              env,
              {
                patientId: auth.userId,
                userMessage: body.message,
                psychologistContext,
                chatHistory: contextHistory,
                language,
                retrievalContext: knowledgeRetrieval,
              },
              onDelta
            )
          );
        } else {
          agentReply = await runPatientChatGraph(env, {
            patientId: auth.userId,
            userMessage: body.message,
            psychologistContext,
            chatHistory: contextHistory,
            language,
            retrievalContext: knowledgeRetrieval,
          });
        }

        const isInteractionEnd = isAgentInteractionEndReply(
          agentReply,
          forcedClosing
        );

        const persistedMessages = buildPatientChatPersistedMessages({
          userMessageId,
          agentMessageId,
          userMessage: body.message,
          reply: agentReply,
          interactionId,
          isNewInteraction,
          isInteractionEnd,
        });

        if (useStream) {
          if (forcedClosing) {
            startAiStream(reply);
            writeAiStreamEvent(reply, { type: 'delta', delta: agentReply });
          }

          try {
            await persistPatientChatExchange(env, admin, request.log, {
              patientId: auth.userId,
              userMessage: body.message,
              reply: agentReply,
              language,
              interactionId,
              isNewInteraction,
              isInteractionEnd,
              userMessageId,
              agentMessageId,
            });
          } catch (error) {
            request.log.error(
              { err: error, patientId: auth.userId },
              'patient-chat-persist failed'
            );
            writeAiStreamEvent(reply, {
              type: 'error',
              error: 'Failed to save chat message',
            });
            endAiStream(reply);
            throw error;
          }

          finishAiStream(reply, {
            type: 'done',
            message: agentReply,
            messages: persistedMessages,
          });
          return reply;
        }

        const content = await appendPatientChatMessages(
          admin,
          auth.userId,
          persistedMessages
        );
        await recordPatientInteraction(admin, auth.userId, {
          channel: 'text',
          source: 'web',
        });

        runInBackground(request.log, 'patient-chat-side-effects', () =>
          processPatientChatSideEffects(env, admin, {
            patientId: auth.userId,
            userMessage: body.message,
            language,
            isInteractionEnd,
          })
        );

        return {
          message: agentReply,
          messages: persistedMessages,
          patientId: auth.userId,
          patientSummary: content.patientSummary,
          psychologistSummary: content.psychologistSummary,
          sessionInsights: content.sessionInsights,
        };
      }
    );

    app.post(
      '/ai/psychologist/chat',
      {
        preHandler: validateBody(psychologistChatBodySchema),
      },
      async (request, reply) => {
        const auth = request.auth!;
        const supabase = request.userSupabase!;
        const body = request.body as {
          patientId: string;
          message: string;
          clinicalContext?: string;
          sessionConsiderations?: string;
          language?: AppLanguage;
        };
        const useStream = wantsAiStream(request);

        if (auth.role !== 'psychologist') {
          throw new ForbiddenError();
        }

        await assertPsychologistPatientAccess(supabase, auth, body.patientId);

        const clinicalContent = await ensurePatientClinicalContent(
          admin,
          body.patientId
        );
        const chatHistory = clinicalContent.psychologistChatSeed ?? [];
        const psychologistLanguage = normalizeAppLanguage(body.language);
        const clinicalRetrieval = buildPsychologistCopilotRetrievalContext(
          psychologistLanguage,
          {
            dashboardSnapshot: clinicalContent.dashboardSnapshot,
            psychologistSummary: clinicalContent.psychologistSummary,
            patientSummary: clinicalContent.patientSummary,
            sessionInsights: clinicalContent.sessionInsights,
            likertCheckIn: clinicalContent.likertCheckIn,
            anamnesis: clinicalContent.anamnesis,
          }
        );
        const knowledgeRetrieval = env.RAG_CHAT_ENABLED
          ? await loadKnowledgeRetrievalContext(env, admin, request.log, {
              query: body.message,
              language: psychologistLanguage,
              psychologistIds: [auth.userId],
            })
          : '';
        const retrievalContext = joinRetrievalContexts(
          clinicalRetrieval,
          knowledgeRetrieval
        );

        const graphInput = {
          psychologistId: auth.userId,
          patientId: body.patientId,
          userMessage: body.message,
          clinicalContext: body.clinicalContext,
          sessionConsiderations: body.sessionConsiderations,
          language: psychologistLanguage,
          chatHistory,
          retrievalContext,
        };

        let agentReply: string;
        if (useStream) {
          agentReply = await streamLlmReply(reply, (onDelta) =>
            streamPsychologistCopilotGraph(env, graphInput, onDelta)
          );
          finishAiStream(reply, { type: 'done', message: agentReply });
        } else {
          agentReply = await runPsychologistCopilotGraph(env, graphInput);
        }

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
            text: agentReply,
            createdAt: new Date().toISOString(),
          },
        ];

        if (useStream) {
          runInBackground(
            request.log,
            'psychologist-chat-persist',
            async () => {
              await appendPsychologistChatMessages(
                admin,
                body.patientId,
                persistedMessages
              );
            }
          );
        } else {
          await appendPsychologistChatMessages(
            admin,
            body.patientId,
            persistedMessages
          );
        }

        runInBackground(request.log, 'psychologist-chat-side-effects', () =>
          refreshPsychologistSessionInsights(
            env,
            admin,
            body.patientId,
            psychologistLanguage
          ).then(() => undefined)
        );

        if (useStream) {
          return reply;
        }

        return {
          message: agentReply,
          patientId: body.patientId,
          psychologistId: auth.userId,
          psychologistSummary: clinicalContent.psychologistSummary,
          sessionInsights: clinicalContent.sessionInsights,
        };
      }
    );
  };
