import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

export const PATIENT_CHAT_MAX_QUESTIONS = 3;
export const PATIENT_CHAT_MAX_RESPONSE_CHARS = 160;

export const truncatePatientChatResponse = (
  text: string,
  maxChars = PATIENT_CHAT_MAX_RESPONSE_CHARS
): string => {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  let cut = trimmed.slice(0, maxChars).trimEnd();
  const lastQuestion = cut.lastIndexOf('?');
  const lastSentenceEnd = Math.max(
    cut.lastIndexOf('.'),
    cut.lastIndexOf('!'),
    lastQuestion
  );

  if (lastSentenceEnd >= Math.floor(maxChars * 0.55)) {
    cut = cut.slice(0, lastSentenceEnd + 1).trimEnd();
    if (cut.length <= maxChars) {
      return cut;
    }
  }

  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace >= Math.floor(maxChars * 0.65)) {
    cut = cut.slice(0, lastSpace).trimEnd();
  }

  if (!cut.endsWith('?') && !cut.endsWith('.') && !cut.endsWith('!')) {
    if (cut.length + 1 <= maxChars) {
      return `${cut}?`;
    }
    return `${cut.slice(0, maxChars - 1).trimEnd()}?`;
  }

  return cut.slice(0, maxChars).trimEnd();
};

export type PatientChatInteractionPhase =
  | 'question-1'
  | 'question-2'
  | 'question-3'
  | 'closing';

const CLOSING_MESSAGES: Record<AppLanguage, string> = {
  pt: 'Agradeço por compartilhar estas informações. Permaneço à disposição para apoiá-lo(a) quando necessário.',
  es: 'Agradezco que haya compartido esta información. Permanezco a su disposición para apoyarle cuando lo necesite.',
  en: 'Thank you for sharing this information. I remain available to support you whenever needed.',
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
