import { END, START, StateGraph } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

import type { Env } from '@config/env.js';
import { createPatientChatModel } from '@ai/llm.js';
import {
  invokeOpenRouterChat,
  streamOpenRouterChat,
} from '@ai/openrouter/openrouter-chat.js';
import {
  countAgentQuestionsInChat,
  finalizePatientChatResponse,
  getPatientChatFallbackReply,
  isLeakedPatientChatReasoning,
} from '@ai/prompts/patient-chat-interaction.js';
import { buildPatientChatHumanPrompt } from '@ai/prompts/patient-chat-context-focus.js';
import { buildPatientChatSystemPrompt } from '@ai/prompts/patient-chat-system.js';
import { resolveLanguageInstruction } from '@ai/prompts/response-language.js';
import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';
import { extractStreamChunkContent } from '@ai/stream-chunk-content.js';
import {
  PatientChatAnnotation,
  type PatientChatState,
} from '@ai/state/patient-chat.state.js';

const buildPatientChatMessages = (
  state: PatientChatState
): {
  language: AppLanguage;
  system: SystemMessage;
  human: HumanMessage;
} => {
  const language = (state.responseLanguage as AppLanguage) ?? 'pt';
  const questionCount = countAgentQuestionsInChat(state.chatHistory);
  const system = new SystemMessage(
    [
      buildPatientChatSystemPrompt(language, {
        psychologistContext: state.careContext,
        chatHistory: state.chatHistory,
        questionCount,
        retrievalContext: state.retrievalContext,
      }),
      resolveLanguageInstruction(language),
    ]
      .filter(Boolean)
      .join('\n\n')
  );
  const human = new HumanMessage(
    buildPatientChatHumanPrompt(
      language,
      state.userMessage,
      state.careContext,
      questionCount,
      state.chatHistory
    )
  );

  return { language, system, human };
};

const messageContent = (message: SystemMessage | HumanMessage): string =>
  typeof message.content === 'string'
    ? message.content
    : String(message.content ?? '');

const finalizePatientChatAssistantMessage = (
  raw: string,
  language: AppLanguage
): string => {
  let assistantMessage = finalizePatientChatResponse(raw);
  if (!assistantMessage || isLeakedPatientChatReasoning(assistantMessage)) {
    assistantMessage = getPatientChatFallbackReply(language);
  }

  return assistantMessage;
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
  async (state: PatientChatState): Promise<Partial<PatientChatState>> => {
    const { language, system, human } = buildPatientChatMessages(state);
    let content: string;

    if (env.LLM_PROVIDER === 'openrouter') {
      content = await invokeOpenRouterChat(
        env,
        [
          { role: 'system', content: messageContent(system) },
          { role: 'user', content: messageContent(human) },
        ],
        {
          temperature: 0.15,
          maxTokens: 256,
        }
      );
    } else {
      const model = createPatientChatModel(env);
      const response = await model.invoke([system, human]);
      content =
        typeof response.content === 'string'
          ? response.content
          : String(response.content);
    }

    return {
      assistantMessage: finalizePatientChatAssistantMessage(content, language),
    };
  };

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
): Promise<string> => {
  const { language, system, human } = buildPatientChatMessages({
    patientId: input.patientId,
    userMessage: input.userMessage,
    careContext: input.psychologistContext ?? '',
    chatHistory: input.chatHistory ?? [],
    responseLanguage: input.language ?? 'pt',
    retrievalContext: input.retrievalContext ?? '',
    assistantMessage: '',
  });

  if (env.LLM_PROVIDER === 'openrouter') {
    const raw = await streamOpenRouterChat(
      env,
      [
        { role: 'system', content: messageContent(system) },
        { role: 'user', content: messageContent(human) },
      ],
      {
        temperature: 0.15,
        maxTokens: 256,
      },
      onDelta
    );
    return finalizePatientChatAssistantMessage(raw, language);
  }

  const model = createPatientChatModel(env);
  let raw = '';
  const stream = await model.stream([system, human]);
  for await (const chunk of stream) {
    const piece = extractStreamChunkContent(chunk.content);
    if (!piece) {
      continue;
    }

    raw += piece;
    onDelta(piece);
  }

  return finalizePatientChatAssistantMessage(raw, language);
};

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
