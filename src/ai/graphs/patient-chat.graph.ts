import { END, START, StateGraph } from '@langchain/langgraph';

import type { Env } from '@config/env.js';
import {
  createPatientChatModel,
  PATIENT_CHAT_MAX_OUTPUT_TOKENS,
  PATIENT_CHAT_TEMPERATURE,
} from '@ai/llm.js';
import {
  streamOpenRouterChat,
} from '@ai/openrouter/openrouter-chat.js';
import {
  buildDistinctPatientChatFallback,
  countAgentQuestionsInChat,
  extractRecentAgentQuestions,
  finalizePatientChatResponse,
  getPatientChatFallbackReply,
  isLeakedPatientChatReasoning,
  isSimilarPatientChatReply,
  PATIENT_CHAT_MAX_SIMILARITY_RETRIES,
} from '@ai/prompts/patient-chat-interaction.js';
import {
  buildPatientChatLangChainMessages,
  buildPatientChatOpenRouterMessages,
  type PatientChatGenerationContext,
} from '@ai/prompts/patient-chat-messages.js';
import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';
import { extractStreamChunkContent } from '@ai/stream-chunk-content.js';
import {
  PatientChatAnnotation,
  type PatientChatState,
} from '@ai/state/patient-chat.state.js';

const MAX_RETRY_TEMPERATURE = 0.55;
const RETRY_TEMPERATURE_STEP = 0.12;

const resolveGenerationTemperature = (retryAttempt: number): number =>
  Math.min(
    PATIENT_CHAT_TEMPERATURE + retryAttempt * RETRY_TEMPERATURE_STEP,
    MAX_RETRY_TEMPERATURE
  );

const buildGenerationContext = (
  state: PatientChatState,
  retryAttempt = 0,
  rejectedReply?: string
): PatientChatGenerationContext => ({
  language: (state.responseLanguage as AppLanguage) ?? 'pt',
  userMessage: state.userMessage,
  psychologistContext: state.careContext ?? '',
  chatHistory: state.chatHistory ?? [],
  retrievalContext: state.retrievalContext ?? '',
  retryAttempt,
  rejectedReply,
});

const finalizePatientChatAssistantMessage = (
  raw: string,
  language: AppLanguage,
  userMessage?: string
): string => {
  let assistantMessage = finalizePatientChatResponse(raw);
  if (!assistantMessage || isLeakedPatientChatReasoning(assistantMessage)) {
    assistantMessage = getPatientChatFallbackReply(language, userMessage);
  }

  return assistantMessage;
};

const streamPatientChatModelRaw = async (
  env: Env,
  context: PatientChatGenerationContext
): Promise<string> => {
  const retryAttempt = context.retryAttempt ?? 0;
  const temperature = resolveGenerationTemperature(retryAttempt);

  if (env.LLM_PROVIDER === 'openrouter') {
    return streamOpenRouterChat(
      env,
      buildPatientChatOpenRouterMessages(context),
      {
        temperature,
        maxTokens: PATIENT_CHAT_MAX_OUTPUT_TOKENS,
      },
      () => {
        // Buffer raw output; only the sanitized reply is streamed to the patient.
      }
    );
  }

  const model = createPatientChatModel(env);
  let raw = '';
  const stream = await model.stream(buildPatientChatLangChainMessages(context));
  for await (const chunk of stream) {
    const piece = extractStreamChunkContent(chunk.content);
    if (piece) {
      raw += piece;
    }
  }

  return raw;
};

const generatePatientChatReply = async (
  env: Env,
  state: PatientChatState,
  onDelta?: (delta: string) => void
): Promise<string> => {
  const language = (state.responseLanguage as AppLanguage) ?? 'pt';
  const priorReplies = extractRecentAgentQuestions(state.chatHistory ?? []);
  const questionCount = countAgentQuestionsInChat(state.chatHistory ?? []);
  let lastCandidate = '';

  for (
    let attempt = 0;
    attempt <= PATIENT_CHAT_MAX_SIMILARITY_RETRIES;
    attempt += 1
  ) {
    const raw = await streamPatientChatModelRaw(
      env,
      buildGenerationContext(state, attempt, lastCandidate || undefined)
    );
    const candidate = finalizePatientChatAssistantMessage(
      raw,
      language,
      state.userMessage
    );

    if (
      !priorReplies.length ||
      !isSimilarPatientChatReply(candidate, priorReplies)
    ) {
      if (onDelta && candidate) {
        onDelta(candidate);
      }
      return candidate;
    }

    lastCandidate = candidate;
  }

  const distinctFallback = buildDistinctPatientChatFallback(
    language,
    state.userMessage,
    questionCount,
    priorReplies
  );
  if (onDelta && distinctFallback) {
    onDelta(distinctFallback);
  }
  return distinctFallback;
};

const buildRetrievalContext = (state: PatientChatState): string =>
  state.retrievalContext?.trim() ?? '';

const retrieveNode = async (
  state: PatientChatState
): Promise<Partial<PatientChatState>> => ({
  retrievalContext: buildRetrievalContext(state),
});

const createRespondNode =
  (env: Env) =>
  async (state: PatientChatState): Promise<Partial<PatientChatState>> => ({
    assistantMessage: await generatePatientChatReply(env, state),
  });

export const createPatientChatGraph = (env: Env) => {
  const graph = new StateGraph(PatientChatAnnotation)
    .addNode('retrieve', retrieveNode)
    .addNode('respond', createRespondNode(env))
    .addEdge(START, 'retrieve')
    .addEdge('retrieve', 'respond')
    .addEdge('respond', END);

  return graph.compile();
};

export const streamPatientChatGraph = async (
  env: Env,
  input: {
    patientId: string;
    userMessage: string;
    psychologistContext?: string;
    chatHistory?: ClinicalChatMessage[];
    retrievalContext?: string;
    language?: AppLanguage;
  },
  onDelta: (delta: string) => void
): Promise<string> =>
  generatePatientChatReply(
    env,
    {
      patientId: input.patientId,
      userMessage: input.userMessage,
      careContext: input.psychologistContext ?? '',
      chatHistory: input.chatHistory ?? [],
      responseLanguage: input.language ?? 'pt',
      retrievalContext: input.retrievalContext ?? '',
      assistantMessage: '',
    },
    onDelta
  );

export const runPatientChatGraph = async (
  env: Env,
  input: {
    patientId: string;
    userMessage: string;
    psychologistContext?: string;
    chatHistory?: ClinicalChatMessage[];
    retrievalContext?: string;
    language?: AppLanguage;
  }
): Promise<string> => {
  const chatHistory = input.chatHistory ?? [];
  const app = createPatientChatGraph(env);
  const result = await app.invoke({
    patientId: input.patientId,
    userMessage: input.userMessage,
    careContext: input.psychologistContext ?? '',
    chatHistory,
    responseLanguage: input.language ?? 'pt',
    retrievalContext: input.retrievalContext ?? '',
    assistantMessage: '',
  });

  return result.assistantMessage;
};
