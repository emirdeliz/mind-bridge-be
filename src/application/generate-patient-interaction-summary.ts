import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import { splitChatIntoInteractions } from './patient-chat-interaction-groups.js';

const MAX_SNIPPET_CHARS = 140;
const MAX_INTERACTIONS_IN_SUMMARY = 8;
const MAX_TOTAL_SUMMARY_CHARS = 900;

const truncate = (text: string, maxChars = MAX_SNIPPET_CHARS): string => {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxChars - 1).trimEnd()}…`;
};

const summarizeInteractionGroup = (
  messages: ClinicalChatMessage[],
  index: number,
  language: AppLanguage
): string => {
  const userMessages = messages
    .filter((entry) => entry.sender === 'user')
    .map((entry) => entry.text.trim())
    .filter(Boolean);

  if (!userMessages.length) {
    return '';
  }

  const reports = truncate(userMessages.join(' '), 160);
  const labels: Record<AppLanguage, string> = {
    pt: `Conversa ${index}`,
    es: `Conversación ${index}`,
    en: `Conversation ${index}`,
  };

  const reportLabel: Record<AppLanguage, string> = {
    pt: userMessages.length === 1 ? 'relato' : 'relatos',
    es: userMessages.length === 1 ? 'relato' : 'relatos',
    en: userMessages.length === 1 ? 'report' : 'reports',
  };

  return `${labels[language]} (${userMessages.length} ${reportLabel[language]}): ${reports}`;
};

export const buildPatientInteractionSummary = (
  chatHistory: ClinicalChatMessage[],
  language: AppLanguage = 'pt'
): string | null => {
  const userMessages = chatHistory.filter((entry) => entry.sender === 'user');
  const agentMessages = chatHistory.filter((entry) => entry.sender === 'agent');

  if (!userMessages.length) {
    return null;
  }

  const interactionGroups = splitChatIntoInteractions(chatHistory).slice(
    -MAX_INTERACTIONS_IN_SUMMARY
  );

  const interactionSummaries = interactionGroups
    .map((group, index) => summarizeInteractionGroup(group, index + 1, language))
    .filter(Boolean);

  const templates: Record<
    AppLanguage,
    (data: {
      conversationCount: number;
      userCount: number;
      agentCount: number;
      interactionSummaries: string[];
    }) => string
  > = {
    pt: ({ conversationCount, userCount, agentCount, interactionSummaries }) => {
      const parts = [
        `Resumo de ${conversationCount} conversa(s) com o agente (${userCount} mensagem(ns) suas e ${agentCount} resposta(s) do agente).`,
        ...interactionSummaries,
      ];
      return parts.join('\n');
    },
    es: ({ conversationCount, userCount, agentCount, interactionSummaries }) => {
      const parts = [
        `Resumen de ${conversationCount} conversación(es) con el agente (${userCount} mensaje(s) suyos y ${agentCount} respuesta(s) del agente).`,
        ...interactionSummaries,
      ];
      return parts.join('\n');
    },
    en: ({ conversationCount, userCount, agentCount, interactionSummaries }) => {
      const parts = [
        `Summary of ${conversationCount} conversation(s) with the agent (${userCount} patient message(s) and ${agentCount} agent reply(ies)).`,
        ...interactionSummaries,
      ];
      return parts.join('\n');
    },
  };

  const template = templates[language] ?? templates.pt;
  const summary = template({
    conversationCount: interactionGroups.length,
    userCount: userMessages.length,
    agentCount: agentMessages.length,
    interactionSummaries,
  });

  return truncate(summary, MAX_TOTAL_SUMMARY_CHARS);
};
