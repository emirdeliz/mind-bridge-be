import { END, START, StateGraph } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';

import type { Env } from '@config/env.js';
import { createDashboardAnalyticsModel } from '@ai/llm.js';
import {
  buildPsychologistSessionInsightsHumanPrompt,
  buildPsychologistSessionInsightsSystemPrompt,
} from '@ai/prompts/psychologist-session-insights-system.js';
import type { ClinicalChatMessage, DashboardSnapshot } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

const PsychologistSessionInsightsAnnotation = Annotation.Root({
  dashboardSnapshot: Annotation<DashboardSnapshot>,
  sessionConsiderations: Annotation<string>,
  sessionContext: Annotation<string>,
  chatHistory: Annotation<ClinicalChatMessage[]>,
  patientChatHistory: Annotation<ClinicalChatMessage[]>,
  responseLanguage: Annotation<string>,
  rawResponse: Annotation<string>,
});

type PsychologistSessionInsightsState =
  typeof PsychologistSessionInsightsAnnotation.State;

const createGenerateNode =
  (env: Env) =>
  async (
    state: PsychologistSessionInsightsState
  ): Promise<Partial<PsychologistSessionInsightsState>> => {
    const model = createDashboardAnalyticsModel(env);
    const system = new SystemMessage(
      buildPsychologistSessionInsightsSystemPrompt(state.responseLanguage, {
        dashboardSnapshot: state.dashboardSnapshot,
        sessionConsiderations: state.sessionConsiderations,
        sessionContext: state.sessionContext,
        chatHistory: state.chatHistory,
        patientChatHistory: state.patientChatHistory,
      })
    );
    const human = new HumanMessage(
      buildPsychologistSessionInsightsHumanPrompt(state.responseLanguage)
    );
    const response = await model.invoke([system, human]);
    const raw =
      typeof response.content === 'string'
        ? response.content
        : String(response.content);

    return { rawResponse: raw };
  };

export const createPsychologistSessionInsightsGraph = (env: Env) => {
  const graph = new StateGraph(PsychologistSessionInsightsAnnotation)
    .addNode('generate', createGenerateNode(env))
    .addEdge(START, 'generate')
    .addEdge('generate', END);

  return graph.compile();
};

export const runPsychologistSessionInsightsGraph = async (
  env: Env,
  input: {
    dashboardSnapshot: DashboardSnapshot;
    sessionConsiderations: string;
    sessionContext: string;
    chatHistory: ClinicalChatMessage[];
    patientChatHistory: ClinicalChatMessage[];
    language?: AppLanguage;
  }
): Promise<string> => {
  const app = createPsychologistSessionInsightsGraph(env);
  const result = await app.invoke({
    dashboardSnapshot: input.dashboardSnapshot,
    sessionConsiderations: input.sessionConsiderations,
    sessionContext: input.sessionContext,
    chatHistory: input.chatHistory,
    patientChatHistory: input.patientChatHistory,
    responseLanguage: input.language ?? 'pt',
    rawResponse: '',
  });

  return result.rawResponse;
};
