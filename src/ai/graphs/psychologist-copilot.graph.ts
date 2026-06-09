import { END, START, StateGraph } from '@langchain/langgraph';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';

import type { Env } from '@config/env.js';
import { createPsychologistCopilotModel } from '@ai/llm.js';
import { finalizePsychologistCopilotReply } from '@ai/prompts/psychologist-copilot-response.js';
import {
  buildPsychologistCopilotRetrievalContext,
  buildPsychologistCopilotSystemPrompt,
  normalizeAppLanguage,
} from '@ai/prompts/psychologist-copilot-system.js';
import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

const MAX_CHAT_HISTORY_MESSAGES = 20;

const PsychologistCopilotAnnotation = Annotation.Root({
  psychologistId: Annotation<string>,
  patientId: Annotation<string>,
  userMessage: Annotation<string>,
  clinicalContext: Annotation<string>,
  sessionConsiderations: Annotation<string>,
  responseLanguage: Annotation<string>,
  retrievalContext: Annotation<string>,
  chatHistory: Annotation<ClinicalChatMessage[]>,
  assistantMessage: Annotation<string>,
});

type PsychologistCopilotState = typeof PsychologistCopilotAnnotation.State;

const retrieveNode = async (
  state: PsychologistCopilotState
): Promise<Partial<PsychologistCopilotState>> => ({
  retrievalContext: buildPsychologistCopilotRetrievalContext(
    normalizeAppLanguage(state.responseLanguage),
    state.patientId
  ),
});

const createRespondNode =
  (env: Env) =>
  async (
    state: PsychologistCopilotState
  ): Promise<Partial<PsychologistCopilotState>> => {
    const model = createPsychologistCopilotModel(env);
    const language = normalizeAppLanguage(state.responseLanguage);
    const system = new SystemMessage(
      buildPsychologistCopilotSystemPrompt(language, {
        sessionConsiderations: state.sessionConsiderations,
        clinicalContext: state.clinicalContext,
        retrievalContext: state.retrievalContext,
      })
    );
    const history = (state.chatHistory ?? [])
      .slice(-MAX_CHAT_HISTORY_MESSAGES)
      .map((entry) =>
        entry.sender === 'user'
          ? new HumanMessage(entry.text)
          : new AIMessage(entry.text)
      );
    const human = new HumanMessage(state.userMessage);
    const response = await model.invoke([system, ...history, human]);
    const raw =
      typeof response.content === 'string'
        ? response.content
        : String(response.content);

    return {
      assistantMessage: finalizePsychologistCopilotReply(raw, language),
    };
  };

export const createPsychologistCopilotGraph = (env: Env) => {
  const graph = new StateGraph(PsychologistCopilotAnnotation)
    .addNode('retrieve', retrieveNode)
    .addNode('respond', createRespondNode(env))
    .addEdge(START, 'retrieve')
    .addEdge('retrieve', 'respond')
    .addEdge('respond', END);

  return graph.compile();
};

export const runPsychologistCopilotGraph = async (
  env: Env,
  input: {
    psychologistId: string;
    patientId: string;
    userMessage: string;
    clinicalContext?: string;
    sessionConsiderations?: string;
    language?: AppLanguage;
    chatHistory?: ClinicalChatMessage[];
  }
): Promise<string> => {
  const app = createPsychologistCopilotGraph(env);
  const result = await app.invoke({
    psychologistId: input.psychologistId,
    patientId: input.patientId,
    userMessage: input.userMessage,
    clinicalContext: input.clinicalContext ?? '',
    sessionConsiderations: input.sessionConsiderations ?? '',
    responseLanguage: input.language ?? 'pt',
    retrievalContext: '',
    chatHistory: input.chatHistory ?? [],
    assistantMessage: '',
  });

  return result.assistantMessage;
};
