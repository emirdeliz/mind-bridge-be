import { END, START, StateGraph } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

import type { Env } from '@config/env.js';
import { createPatientChatModel } from '@ai/llm.js';
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
import {
  PatientChatAnnotation,
  type PatientChatState,
} from '@ai/state/patient-chat.state.js';

const buildRetrievalContext = (state: PatientChatState): string => {
  if (state.careContext?.trim()) {
    return '';
  }

  if (state.retrievalContext?.trim()) {
    return state.retrievalContext;
  }

  return [
    'Retrieved snippets (mock):',
    '- Patient reported work-related anxiety in recent interactions.',
    '- Sleep hygiene discussed in prior sessions.',
  ].join('\n');
};

const retrieveNode = async (
  state: PatientChatState
): Promise<Partial<PatientChatState>> => ({
  retrievalContext: buildRetrievalContext(state),
});

const createRespondNode =
  (env: Env) =>
  async (state: PatientChatState): Promise<Partial<PatientChatState>> => {
    const language = (state.responseLanguage as AppLanguage) ?? 'pt';
    const questionCount = countAgentQuestionsInChat(state.chatHistory);

    const model = createPatientChatModel(env);
    const system = new SystemMessage(
      [
        buildPatientChatSystemPrompt(language, {
          psychologistContext: state.careContext,
          chatHistory: state.chatHistory,
          questionCount,
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
    const response = await model.invoke([system, human]);
    const content =
      typeof response.content === 'string'
        ? response.content
        : String(response.content);

    let assistantMessage = finalizePatientChatResponse(content);
    if (!assistantMessage || isLeakedPatientChatReasoning(assistantMessage)) {
      assistantMessage = getPatientChatFallbackReply(language);
    }

    return { assistantMessage };
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
