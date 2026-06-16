import { END, START, StateGraph } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';

import type { Env } from '@config/env.js';
import { createPatientChatPatternsModel } from '@ai/llm.js';
import {
  buildPatientChatPatternsHumanPrompt,
  buildPatientChatPatternsSystemPrompt,
} from '@ai/prompts/patient-chat-patterns-system.js';
import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

const PatientChatPatternsAnnotation = Annotation.Root({
  patientChatHistory: Annotation<ClinicalChatMessage[]>,
  sessionContext: Annotation<string>,
  responseLanguage: Annotation<string>,
  patternsText: Annotation<string>,
});

type PatientChatPatternsState = typeof PatientChatPatternsAnnotation.State;

const createGenerateNode =
  (env: Env) =>
  async (
    state: PatientChatPatternsState
  ): Promise<Partial<PatientChatPatternsState>> => {
    const model = createPatientChatPatternsModel(env);
    const language = (state.responseLanguage as AppLanguage) ?? 'pt';
    const system = new SystemMessage(
      buildPatientChatPatternsSystemPrompt(
        language,
        state.patientChatHistory,
        state.sessionContext
      )
    );
    const human = new HumanMessage(
      buildPatientChatPatternsHumanPrompt(language)
    );
    const response = await model.invoke([system, human]);
    const content =
      typeof response.content === 'string'
        ? response.content
        : String(response.content);

    return { patternsText: content.trim() };
  };

export const runPatientChatPatternsGraph = async (
  env: Env,
  input: {
    patientChatHistory: ClinicalChatMessage[];
    sessionContext?: string;
    language?: AppLanguage;
  }
): Promise<string> => {
  const app = new StateGraph(PatientChatPatternsAnnotation)
    .addNode('generate', createGenerateNode(env))
    .addEdge(START, 'generate')
    .addEdge('generate', END)
    .compile();

  const result = await app.invoke({
    patientChatHistory: input.patientChatHistory,
    sessionContext: input.sessionContext ?? '',
    responseLanguage: input.language ?? 'pt',
    patternsText: '',
  });

  return result.patternsText;
};
