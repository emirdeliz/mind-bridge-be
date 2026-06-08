import { Annotation } from '@langchain/langgraph';

import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';

export const PatientChatAnnotation = Annotation.Root({
  patientId: Annotation<string>,
  userMessage: Annotation<string>,
  careContext: Annotation<string>,
  chatHistory: Annotation<ClinicalChatMessage[]>,
  responseLanguage: Annotation<string>,
  retrievalContext: Annotation<string>,
  assistantMessage: Annotation<string>,
});

export type PatientChatState = typeof PatientChatAnnotation.State;
