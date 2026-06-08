import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

export const PATIENT_CHAT_MAX_QUESTIONS = 3;

export type PatientChatInteractionPhase =
  | 'question-1'
  | 'question-2'
  | 'question-3'
  | 'closing';

const CLOSING_MESSAGES: Record<AppLanguage, string> = {
  pt: 'Obrigado por compartilhar essas informações. Estou à disposição quando você precisar.',
  es: 'Gracias por compartir esta información. Estoy a tu disposición cuando lo necesites.',
  en: 'Thank you for sharing this information. I am here whenever you need me.',
};

const CLOSING_MESSAGE_SET = new Set(Object.values(CLOSING_MESSAGES));

export const getPatientChatClosingMessage = (language: AppLanguage): string =>
  CLOSING_MESSAGES[language] ?? CLOSING_MESSAGES.pt;

export const isPatientChatClosingMessage = (text: string): boolean =>
  CLOSING_MESSAGE_SET.has(text.trim());

/** Perguntas do agente na interação atual (desde o último encerramento). */
export const countAgentQuestionsInCurrentInteraction = (
  chatHistory: ClinicalChatMessage[]
): number => {
  let count = 0;

  for (let index = chatHistory.length - 1; index >= 0; index -= 1) {
    const message = chatHistory[index];
    if (message.sender !== 'agent') {
      continue;
    }

    if (isPatientChatClosingMessage(message.text)) {
      break;
    }

    count += 1;
  }

  return count;
};

export const resolvePatientChatInteractionPhase = (
  chatHistory: ClinicalChatMessage[]
): PatientChatInteractionPhase => {
  const questionCount = countAgentQuestionsInCurrentInteraction(chatHistory);

  if (questionCount >= PATIENT_CHAT_MAX_QUESTIONS) {
    return 'closing';
  }

  switch (questionCount) {
    case 0:
      return 'question-1';
    case 1:
      return 'question-2';
    default:
      return 'question-3';
  }
};

export const isPatientChatClosingPhase = (
  phase: PatientChatInteractionPhase
): boolean => phase === 'closing';
