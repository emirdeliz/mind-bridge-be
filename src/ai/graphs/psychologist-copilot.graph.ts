import { END, START, StateGraph } from '@langchain/langgraph';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';

import type { Env } from '@config/env.js';
import { createPsychologistCopilotModel } from '@ai/llm.js';
import { finalizePsychologistCopilotReply } from '@ai/prompts/psychologist-copilot-response.js';
import {
  buildPsychologistCopilotSystemPrompt,
  normalizeAppLanguage,
} from '@ai/prompts/psychologist-copilot-system.js';
import { extractStreamChunkContent } from '@ai/stream-chunk-content.js';
import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

const MAX_CHAT_HISTORY_MESSAGES = 10;

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

const createRespondNode =
  (env: Env) =>
  async (
    state: PsychologistCopilotState
  ): Promise<Partial<PsychologistCopilotState>> => {
    const model = createPsychologistCopilotModel(env);
    const { language, system, history, human } =
      buildPsychologistCopilotMessages(state);
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
    .addNode('respond', createRespondNode(env))
    .addEdge(START, 'respond')
    .addEdge('respond', END);

  return graph.compile();
};

const buildPsychologistCopilotMessages = (
  state: PsychologistCopilotState
): {
  language: AppLanguage;
  system: SystemMessage;
  history: (HumanMessage | AIMessage)[];
  human: HumanMessage;
} => {
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

  return { language, system, history, human };
};

export const streamPsychologistCopilotGraph = async (
  env: Env,
  input: {
    psychologistId: string;
    patientId: string;
    userMessage: string;
    clinicalContext?: string;
    sessionConsiderations?: string;
    language?: AppLanguage;
    chatHistory?: ClinicalChatMessage[];
    retrievalContext?: string;
  },
  onDelta: (delta: string) => void
): Promise<string> => {
  const model = createPsychologistCopilotModel(env);
  const { language, system, history, human } = buildPsychologistCopilotMessages({
    psychologistId: input.psychologistId,
    patientId: input.patientId,
    userMessage: input.userMessage,
    clinicalContext: input.clinicalContext ?? '',
    sessionConsiderations: input.sessionConsiderations ?? '',
    responseLanguage: input.language ?? 'pt',
    retrievalContext: input.retrievalContext ?? '',
    chatHistory: input.chatHistory ?? [],
    assistantMessage: '',
  });

  let raw = '';
  const stream = await model.stream([system, ...history, human]);
  for await (const chunk of stream) {
    const piece = extractStreamChunkContent(chunk.content);
    if (!piece) {
      continue;
    }

    raw += piece;
    onDelta(piece);
  }

  return finalizePsychologistCopilotReply(raw, language);
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
    retrievalContext?: string;
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
    retrievalContext: input.retrievalContext ?? '',
    chatHistory: input.chatHistory ?? [],
    assistantMessage: '',
  });

  return result.assistantMessage;
};
