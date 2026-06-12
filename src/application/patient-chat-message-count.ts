import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { PatientClinicalContent } from '@domain/clinical-content.types.js';

export const countPatientUserMessages = (
  messages: ClinicalChatMessage[]
): number => messages.filter((entry) => entry.sender === 'user').length;

export const countPatientUserMessagesInContent = (
  content: PatientClinicalContent
): number => countPatientUserMessages(content.patientChatSeed);
