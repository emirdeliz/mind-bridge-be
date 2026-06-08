import { Annotation } from '@langchain/langgraph';

export const PatientChatAnnotation = Annotation.Root({
  patientId: Annotation<string>,
  userMessage: Annotation<string>,
  careContext: Annotation<string>,
  responseLanguage: Annotation<string>,
  retrievalContext: Annotation<string>,
  assistantMessage: Annotation<string>,
});

export type PatientChatState = typeof PatientChatAnnotation.State;
