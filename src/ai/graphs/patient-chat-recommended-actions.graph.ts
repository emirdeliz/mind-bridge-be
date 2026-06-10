import { END, START, StateGraph } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';

import type { Env } from '@config/env.js';
import { createPatientChatPatternsModel } from '@ai/llm.js';
import {
  buildPatientChatRecommendedActionsHumanPrompt,
  buildPatientChatRecommendedActionsSystemPrompt,
} from '@ai/prompts/patient-chat-recommended-actions-system.js';
import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

const PatientChatRecommendedActionsAnnotation = Annotation.Root({
  patientChatHistory: Annotation<ClinicalChatMessage[]>,
  sessionContext: Annotation<string>,
  sessionConsiderations: Annotation<string>,
  responseLanguage: Annotation<string>,
  actionsText: Annotation<string>,
});

type PatientChatRecommendedActionsState =
  typeof PatientChatRecommendedActionsAnnotation.State;

const createGenerateNode =
  (env: Env) =>
  async (
    state: PatientChatRecommendedActionsState
  ): Promise<Partial<PatientChatRecommendedActionsState>> => {
    const model = createPatientChatPatternsModel(env);
    const language = (state.responseLanguage as AppLanguage) ?? 'pt';
    const system = new SystemMessage(
      buildPatientChatRecommendedActionsSystemPrompt(
        language,
        state.patientChatHistory,
        state.sessionContext,
        state.sessionConsiderations
      )
    );
    const human = new HumanMessage(
      buildPatientChatRecommendedActionsHumanPrompt(language)
    );
    const response = await model.invoke([system, human]);
    const content =
      typeof response.content === 'string'
        ? response.content
        : String(response.content);

    return { actionsText: content.trim() };
  };

export const runPatientChatRecommendedActionsGraph = async (
  env: Env,
  input: {
    patientChatHistory: ClinicalChatMessage[];
    sessionContext?: string;
    sessionConsiderations?: string;
    language?: AppLanguage;
  }
): Promise<string> => {
  const app = new StateGraph(PatientChatRecommendedActionsAnnotation)
    .addNode('generate', createGenerateNode(env))
    .addEdge(START, 'generate')
    .addEdge('generate', END)
    .compile();

  const result = await app.invoke({
    patientChatHistory: input.patientChatHistory,
    sessionContext: input.sessionContext ?? '',
    sessionConsiderations: input.sessionConsiderations ?? '',
    responseLanguage: input.language ?? 'pt',
    actionsText: '',
  });

  return result.actionsText;
};
