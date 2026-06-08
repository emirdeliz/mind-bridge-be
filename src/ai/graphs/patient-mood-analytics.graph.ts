import { END, START, StateGraph } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';

import type { Env } from '@config/env.js';
import { createDashboardAnalyticsModel } from '@ai/llm.js';
import { buildPatientMoodAnalyticsPrompts } from '@ai/prompts/patient-mood-analytics-system.js';
import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

const PatientMoodAnalyticsAnnotation = Annotation.Root({
  userMessage: Annotation<string>,
  chatHistory: Annotation<ClinicalChatMessage[]>,
  currentMoodValue: Annotation<number | null>,
  responseLanguage: Annotation<string>,
  rawResponse: Annotation<string>,
});

type PatientMoodAnalyticsState = typeof PatientMoodAnalyticsAnnotation.State;

const createAnalyzeNode =
  (env: Env) =>
  async (
    state: PatientMoodAnalyticsState
  ): Promise<Partial<PatientMoodAnalyticsState>> => {
    const model = createDashboardAnalyticsModel(env);
    const language = (state.responseLanguage as AppLanguage) ?? 'pt';
    const prompts = buildPatientMoodAnalyticsPrompts(language, {
      userMessage: state.userMessage,
      chatHistory: state.chatHistory,
      currentMoodValue: state.currentMoodValue,
    });

    const response = await model.invoke([
      new SystemMessage(prompts.system),
      new HumanMessage(prompts.human),
    ]);
    const raw =
      typeof response.content === 'string'
        ? response.content
        : String(response.content);

    return { rawResponse: raw };
  };

export const createPatientMoodAnalyticsGraph = (env: Env) => {
  const graph = new StateGraph(PatientMoodAnalyticsAnnotation)
    .addNode('analyze', createAnalyzeNode(env))
    .addEdge(START, 'analyze')
    .addEdge('analyze', END);

  return graph.compile();
};

export const runPatientMoodAnalyticsGraph = async (
  env: Env,
  input: {
    userMessage: string;
    chatHistory: ClinicalChatMessage[];
    currentMoodValue: number | null;
    language?: AppLanguage;
  }
): Promise<string> => {
  const app = createPatientMoodAnalyticsGraph(env);
  const result = await app.invoke({
    userMessage: input.userMessage,
    chatHistory: input.chatHistory,
    currentMoodValue: input.currentMoodValue,
    responseLanguage: input.language ?? 'pt',
    rawResponse: '',
  });

  return result.rawResponse;
};
