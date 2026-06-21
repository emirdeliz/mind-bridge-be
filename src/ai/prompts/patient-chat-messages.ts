import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';

import type { OpenRouterChatMessage } from '@ai/openrouter/openrouter-chat.js';
import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import { buildPatientChatTurnGuidance } from './patient-chat-context-focus.js';
import { countAgentQuestionsInChat } from './patient-chat-interaction.js';
import { buildPatientChatSystemPrompt } from './patient-chat-system.js';
import { resolveLanguageInstruction } from './response-language.js';

export const PATIENT_CHAT_MAX_HISTORY_MESSAGES = 10;

export type PatientChatGenerationContext = {
  language: AppLanguage;
  userMessage: string;
  psychologistContext: string;
  chatHistory: ClinicalChatMessage[];
  retrievalContext: string;
  retryAttempt?: number;
  rejectedReply?: string;
};

export const buildPatientChatSystemContent = (
  context: PatientChatGenerationContext
): string => {
  const questionCount = countAgentQuestionsInChat(context.chatHistory);

  return [
    buildPatientChatSystemPrompt(context.language, {
      psychologistContext: context.psychologistContext,
      chatHistory: context.chatHistory,
      questionCount,
      retrievalContext: context.retrievalContext,
      includeChatHistory: false,
    }),
    buildPatientChatTurnGuidance(
      context.language,
      context.userMessage,
      context.psychologistContext,
      questionCount,
      context.chatHistory,
      context.retryAttempt ?? 0,
      context.rejectedReply,
      context.retrievalContext
    ),
    resolveLanguageInstruction(context.language),
  ]
    .filter(Boolean)
    .join('\n\n');
};

const mapHistoryToOpenRouter = (
  chatHistory: ClinicalChatMessage[]
): OpenRouterChatMessage[] =>
  chatHistory.slice(-PATIENT_CHAT_MAX_HISTORY_MESSAGES).map((message) => ({
    role: message.sender === 'user' ? 'user' : 'assistant',
    content: message.text,
  }));

export const buildPatientChatOpenRouterMessages = (
  context: PatientChatGenerationContext
): OpenRouterChatMessage[] => [
  { role: 'system', content: buildPatientChatSystemContent(context) },
  ...mapHistoryToOpenRouter(context.chatHistory),
  { role: 'user', content: context.userMessage },
];

export const buildPatientChatLangChainMessages = (
  context: PatientChatGenerationContext
): (SystemMessage | HumanMessage | AIMessage)[] => {
  const history = context.chatHistory
    .slice(-PATIENT_CHAT_MAX_HISTORY_MESSAGES)
    .map((message) =>
      message.sender === 'user'
        ? new HumanMessage(message.text)
        : new AIMessage(message.text)
    );

  return [
    new SystemMessage(buildPatientChatSystemContent(context)),
    ...history,
    new HumanMessage(context.userMessage),
  ];
};
