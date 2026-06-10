import { END, START, StateGraph } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';

import type { Env } from '@config/env.js';
import { createPatientChatPatternsModel } from '@ai/llm.js';
import {
  buildPatientChatInteractionSummaryHumanPrompt,
  buildPatientChatInteractionSummarySystemPrompt,
} from '@ai/prompts/patient-chat-interaction-summary-system.js';
import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

const PatientChatInteractionSummaryAnnotation = Annotation.Root({
  interactionGroups: Annotation<ClinicalChatMessage[][]>,
  sessionContext: Annotation<string>,
  responseLanguage: Annotation<string>,
  summaryText: Annotation<string>,
});

type PatientChatInteractionSummaryState =
  typeof PatientChatInteractionSummaryAnnotation.State;

const createGenerateNode =
  (env: Env) =>
  async (
    state: PatientChatInteractionSummaryState
  ): Promise<Partial<PatientChatInteractionSummaryState>> => {
    const model = createPatientChatPatternsModel(env);
    const language = (state.responseLanguage as AppLanguage) ?? 'pt';
    const conversationCount = state.interactionGroups.length;
    const system = new SystemMessage(
      buildPatientChatInteractionSummarySystemPrompt(
        language,
        state.interactionGroups,
        state.sessionContext
      )
    );
    const human = new HumanMessage(
      buildPatientChatInteractionSummaryHumanPrompt(language, conversationCount)
    );
    const response = await model.invoke([system, human]);
    const content =
      typeof response.content === 'string'
        ? response.content
        : String(response.content);

    return { summaryText: content.trim() };
  };

export const runPatientChatInteractionSummaryGraph = async (
  env: Env,
  input: {
    interactionGroups: ClinicalChatMessage[][];
    sessionContext?: string;
    language?: AppLanguage;
  }
): Promise<string> => {
  const app = new StateGraph(PatientChatInteractionSummaryAnnotation)
    .addNode('generate', createGenerateNode(env))
    .addEdge(START, 'generate')
    .addEdge('generate', END)
    .compile();

  const result = await app.invoke({
    interactionGroups: input.interactionGroups,
    sessionContext: input.sessionContext ?? '',
    responseLanguage: input.language ?? 'pt',
    summaryText: '',
  });

  return result.summaryText;
};
