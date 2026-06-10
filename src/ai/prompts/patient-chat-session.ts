import { randomUUID } from 'node:crypto';

import type { Env } from '@config/env.js';
import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import {
  countAgentQuestionsInChat,
  isPatientChatClosingMessage,
} from './patient-chat-interaction.js';
import {
  classifyPatientTopicShift,
  detectExplicitPatientTopicChange,
} from './patient-chat-topic.js';

export const PATIENT_CHAT_MAX_QUESTIONS_PER_INTERACTION = 5;

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
    Object.values(INTERACTION_CLOSING_REPLIES).some((reply) => reply === normalized)
  ) {
    return true;
  }

  if (endsWithQuestion(normalized)) {
    return false;
  }

  return FAREWELL_PATTERNS.some((pattern) => pattern.test(normalized));
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
  userMessage?: string
): ResolvedPatientChatInteraction => {
  if (!history.length) {
    return { interactionId: randomUUID(), isNewInteraction: true };
  }

  const lastInteractionId = getLastInteractionId(history);

  if (lastInteractionId) {
    const scope = getMessagesInInteraction(history, lastInteractionId);
    if (!isInteractionComplete(scope)) {
      if (
        userMessage &&
        detectExplicitPatientTopicChange(userMessage, scope)
      ) {
        return { interactionId: randomUUID(), isNewInteraction: true };
      }
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
    userMessage &&
    detectExplicitPatientTopicChange(userMessage, history)
  ) {
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

export const resolvePatientChatInteractionWithTopicCheck = async (
  env: Env,
  history: ClinicalChatMessage[],
  userMessage: string
): Promise<ResolvedPatientChatInteraction> => {
  const initial = resolvePatientChatInteraction(history, userMessage);
  if (initial.isNewInteraction) {
    return initial;
  }

  const scope = getInteractionScopedHistory(
    history,
    initial.interactionId,
    false
  );

  if (detectExplicitPatientTopicChange(userMessage, scope)) {
    return { interactionId: randomUUID(), isNewInteraction: true };
  }

  const isNewTopic = await classifyPatientTopicShift(env, userMessage, scope);
  if (isNewTopic) {
    return { interactionId: randomUUID(), isNewInteraction: true };
  }

  return initial;
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
        !message.interactionId || message.interactionId === LEGACY_INTERACTION_ID
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
