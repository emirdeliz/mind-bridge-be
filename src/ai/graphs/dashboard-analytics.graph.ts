import { END, START, StateGraph } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';

import type { Env } from '@config/env.js';
import { createDashboardAnalyticsModel } from '@ai/llm.js';
import { buildDashboardAnalyticsSystemPrompt } from '@ai/prompts/dashboard-analytics-system.js';
import type { ClinicalChatMessage, DashboardSnapshot } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

const DashboardAnalyticsAnnotation = Annotation.Root({
  currentSnapshot: Annotation<DashboardSnapshot>,
  sessionConsiderations: Annotation<string>,
  sessionContext: Annotation<string>,
  chatHistory: Annotation<ClinicalChatMessage[]>,
  responseLanguage: Annotation<string>,
  rawResponse: Annotation<string>,
});

type DashboardAnalyticsState = typeof DashboardAnalyticsAnnotation.State;

const createAnalyzeNode =
  (env: Env) =>
  async (
    state: DashboardAnalyticsState
  ): Promise<Partial<DashboardAnalyticsState>> => {
    const model = createDashboardAnalyticsModel(env);
    const system = new SystemMessage(
      buildDashboardAnalyticsSystemPrompt(state.responseLanguage, {
        currentSnapshot: state.currentSnapshot,
        sessionConsiderations: state.sessionConsiderations,
        sessionContext: state.sessionContext,
        chatHistory: state.chatHistory,
      })
    );
    const human = new HumanMessage(
      'Atualize os indicadores do painel com base na sessão encerrada. Retorne somente JSON.'
    );
    const response = await model.invoke([system, human]);
    const raw =
      typeof response.content === 'string'
        ? response.content
        : String(response.content);

    return { rawResponse: raw };
  };

export const createDashboardAnalyticsGraph = (env: Env) => {
  const graph = new StateGraph(DashboardAnalyticsAnnotation)
    .addNode('analyze', createAnalyzeNode(env))
    .addEdge(START, 'analyze')
    .addEdge('analyze', END);

  return graph.compile();
};

export const runDashboardAnalyticsGraph = async (
  env: Env,
  input: {
    currentSnapshot: DashboardSnapshot;
    sessionConsiderations: string;
    sessionContext: string;
    chatHistory: ClinicalChatMessage[];
    language?: AppLanguage;
  }
): Promise<string> => {
  const app = createDashboardAnalyticsGraph(env);
  const result = await app.invoke({
    currentSnapshot: input.currentSnapshot,
    sessionConsiderations: input.sessionConsiderations,
    sessionContext: input.sessionContext,
    chatHistory: input.chatHistory,
    responseLanguage: input.language ?? 'pt',
    rawResponse: '',
  });

  return result.rawResponse;
};
