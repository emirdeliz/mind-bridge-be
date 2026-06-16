import { randomUUID } from 'node:crypto';

import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import {
  countAgentQuestionsInChat,
  isPatientChatClosingMessage,
} from './patient-chat-interaction.js';

export const PATIENT_CHAT_MAX_QUESTIONS_PER_INTERACTION = 5;

/** Gap between patient messages that starts a new interaction. */
export const PATIENT_CHAT_NEW_INTERACTION_GAP_MS = 5 * 60 * 1000;

const LEGACY_INTERACTION_ID = 'legacy';

const endsWithQuestion = (text: string): boolean => text.trim().endsWith('?');

const INTERACTION_CLOSING_REPLIES: Record<AppLanguage, string> = {
  pt: 'Obrigado por conversar. Quando quiser retomar, é só escrever.',
  es: 'Gracias por conversar. Cuando quiera retomar, solo escriba.',
  en: 'Thank you for talking. Whenever you want to continue, just write again.',
};

const FAREWELL_PATTERNS: RegExp[] = [
  /\bobrigad[oa] por conversar\b/i,
  /\bquando quiser retomar\b/i,
  /\bé só escrever\b/i,
  /\bpermaneço à disposição\b/i,
  /\bagradeço por compartilhar\b/i,
  /\bgracias por conversar\b/i,
  /\bcuando quiera retomar\b/i,
  /\bsolo escriba\b/i,
  /\bthank you for talking\b/i,
  /\bwhenever you want to continue\b/i,
  /\bjust write again\b/i,
  /\bi remain available\b/i,
  /\bthank you for sharing\b/i,
];

export const isPatientChatFarewellReply = (text: string): boolean => {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }

  if (isPatientChatClosingMessage(normalized)) {
    return true;
  }

  if (
    Object.values(INTERACTION_CLOSING_REPLIES).some(
      (reply) => reply === normalized
    )
  ) {
    return true;
  }

  if (endsWithQuestion(normalized)) {
    return false;
  }

  return FAREWELL_PATTERNS.some((pattern) => pattern.test(normalized));
};

export const getLastPatientMessage = (
  messages: ClinicalChatMessage[]
): ClinicalChatMessage | undefined => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.sender === 'user') {
      return message;
    }
  }
  return undefined;
};

/** True when the patient waited longer than the gap since their last message. */
export const hasPatientResponseGapExceeded = (
  history: ClinicalChatMessage[],
  nowMs: number = Date.now(),
  gapMs: number = PATIENT_CHAT_NEW_INTERACTION_GAP_MS
): boolean => {
  const lastPatientMessage = getLastPatientMessage(history);
  if (!lastPatientMessage?.createdAt) {
    return false;
  }

  const lastPatientAt = Date.parse(lastPatientMessage.createdAt);
  if (Number.isNaN(lastPatientAt)) {
    return false;
  }

  return nowMs - lastPatientAt > gapMs;
};

export const getLastInteractionId = (
  messages: ClinicalChatMessage[]
): string | undefined => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const interactionId = messages[index]?.interactionId;
    if (interactionId) {
      return interactionId;
    }
  }
  return undefined;
};

export const getMessagesInInteraction = (
  messages: ClinicalChatMessage[],
  interactionId: string
): ClinicalChatMessage[] =>
  messages.filter((message) => message.interactionId === interactionId);

const isInteractionComplete = (scope: ClinicalChatMessage[]): boolean => {
  if (!scope.length) {
    return false;
  }

  const last = scope.at(-1);
  if (!last) {
    return false;
  }

  if (last.sender === 'agent' && isPatientChatFarewellReply(last.text)) {
    return true;
  }

  const questionCount = countAgentQuestionsInChat(scope);
  if (
    questionCount >= PATIENT_CHAT_MAX_QUESTIONS_PER_INTERACTION &&
    last.sender === 'agent' &&
    !endsWithQuestion(last.text)
  ) {
    return true;
  }

  return false;
};

export type ResolvedPatientChatInteraction = {
  interactionId: string;
  isNewInteraction: boolean;
};

export const resolvePatientChatInteraction = (
  history: ClinicalChatMessage[],
  nowMs: number = Date.now()
): ResolvedPatientChatInteraction => {
  if (!history.length) {
    return { interactionId: randomUUID(), isNewInteraction: true };
  }

  if (hasPatientResponseGapExceeded(history, nowMs)) {
    return { interactionId: randomUUID(), isNewInteraction: true };
  }

  const lastInteractionId = getLastInteractionId(history);

  if (lastInteractionId) {
    const scope = getMessagesInInteraction(history, lastInteractionId);
    if (!isInteractionComplete(scope)) {
      return { interactionId: lastInteractionId, isNewInteraction: false };
    }
    return { interactionId: randomUUID(), isNewInteraction: true };
  }

  const questionCount = countAgentQuestionsInChat(history);
  const last = history.at(-1);
  if (!last) {
    return { interactionId: randomUUID(), isNewInteraction: true };
  }

  if (
    questionCount >= PATIENT_CHAT_MAX_QUESTIONS_PER_INTERACTION &&
    last.sender === 'user'
  ) {
    return { interactionId: LEGACY_INTERACTION_ID, isNewInteraction: false };
  }

  if (isInteractionComplete(history)) {
    return { interactionId: randomUUID(), isNewInteraction: true };
  }

  return { interactionId: LEGACY_INTERACTION_ID, isNewInteraction: false };
};

export const getInteractionScopedHistory = (
  history: ClinicalChatMessage[],
  interactionId: string,
  isNewInteraction: boolean
): ClinicalChatMessage[] => {
  if (isNewInteraction) {
    return [];
  }

  if (interactionId === LEGACY_INTERACTION_ID) {
    return history.filter(
      (message) =>
        !message.interactionId ||
        message.interactionId === LEGACY_INTERACTION_ID
    );
  }

  return getMessagesInInteraction(history, interactionId);
};

export const shouldClosePatientChatInteraction = (
  questionCount: number
): boolean => questionCount >= PATIENT_CHAT_MAX_QUESTIONS_PER_INTERACTION;

export const getPatientChatInteractionClosingReply = (
  language: AppLanguage
): string =>
  INTERACTION_CLOSING_REPLIES[language] ?? INTERACTION_CLOSING_REPLIES.pt;

export const isAgentInteractionEndReply = (
  reply: string,
  forcedClosing: boolean
): boolean => forcedClosing || isPatientChatFarewellReply(reply);
