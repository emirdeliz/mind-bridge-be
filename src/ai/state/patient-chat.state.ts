import { Annotation } from '@langchain/langgraph';

import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { PatientChatInteractionPhase } from '@ai/prompts/patient-chat-interaction.js';

export const PatientChatAnnotation = Annotation.Root({
  patientId: Annotation<string>,
  userMessage: Annotation<string>,
  careContext: Annotation<string>,
  chatHistory: Annotation<ClinicalChatMessage[]>,
  interactionPhase: Annotation<PatientChatInteractionPhase>,
  responseLanguage: Annotation<string>,
  retrievalContext: Annotation<string>,
  assistantMessage: Annotation<string>,
});

export type PatientChatState = typeof PatientChatAnnotation.State;
