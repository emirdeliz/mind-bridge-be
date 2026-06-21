import { runPatientChatInteractionSummaryGraph } from '@ai/graphs/patient-chat-interaction-summary.graph.js';
import type { Env } from '@config/env.js';
import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import { splitChatIntoInteractions } from './patient-chat-interaction-groups.js';

const MAX_INTERACTIONS_IN_SUMMARY = 8;

const LIST_PREFIX_PATTERN = /^(?:[-•*]\s*|\d+[.)]\s*)/;

const countUserMessages = (messages: ClinicalChatMessage[]): number =>
  messages.filter((entry) => entry.sender === 'user').length;

const formatInteractionLabel = (
  index: number,
  userCount: number,
  language: AppLanguage
): string => {
  const labels: Record<AppLanguage, string> = {
    pt: `Conversa ${index}`,
    es: `Conversación ${index}`,
    en: `Conversation ${index}`,
  };

  const reportLabel: Record<AppLanguage, string> = {
    pt: userCount === 1 ? 'relato' : 'relatos',
    es: userCount === 1 ? 'relato' : 'relatos',
    en: userCount === 1 ? 'report' : 'reports',
  };

  return `${labels[language]} (${userCount} ${reportLabel[language]})`;
};

const formatInteractionItem = (
  index: number,
  group: ClinicalChatMessage[],
  summary: string,
  language: AppLanguage
): string => {
  const userCount = countUserMessages(group);
  if (!userCount || !summary.trim()) {
    return '';
  }

  return `${formatInteractionLabel(index, userCount, language)}: ${summary.trim()}`;
};

const briefFallbackSummary = (messages: ClinicalChatMessage[]): string => {
  return messages
    .filter((entry) => entry.sender === 'user')
    .map((entry) => entry.text.trim())
    .filter(Boolean)
    .join(' ');
};

const parseAgenticSummaryLines = (
  raw: string,
  expectedCount: number
): string[] => {
  const lines = raw
    .trim()
    .split(/\r?\n+/)
    .map((line) => line.trim().replace(LIST_PREFIX_PATTERN, '').trim())
    .filter(Boolean);

  if (!lines.length) {
    return [];
  }

  if (lines.length === expectedCount) {
    return lines;
  }

  if (lines.length > expectedCount) {
    return lines.slice(0, expectedCount);
  }

  return lines;
};

const assembleInteractionSummary = (
  interactionGroups: ClinicalChatMessage[][],
  interactionSummaries: string[],
  chatHistory: ClinicalChatMessage[],
  language: AppLanguage
): string => {
  const userMessages = chatHistory.filter((entry) => entry.sender === 'user');
  const agentMessages = chatHistory.filter((entry) => entry.sender === 'agent');

  const templates: Record<
    AppLanguage,
    (data: {
      conversationCount: number;
      userCount: number;
      agentCount: number;
      interactionSummaries: string[];
    }) => string
  > = {
    pt: ({
      conversationCount,
      userCount,
      agentCount,
      interactionSummaries,
    }) => {
      const parts = [
        `Resumo de ${conversationCount} conversa(s) com o agente (${userCount} mensagem(ns) suas e ${agentCount} resposta(s) do agente).`,
        ...interactionSummaries,
      ];
      return parts.join('\n');
    },
    es: ({
      conversationCount,
      userCount,
      agentCount,
      interactionSummaries,
    }) => {
      const parts = [
        `Resumen de ${conversationCount} conversación(es) con el agente (${userCount} mensaje(s) suyos y ${agentCount} respuesta(s) del agente).`,
        ...interactionSummaries,
      ];
      return parts.join('\n');
    },
    en: ({
      conversationCount,
      userCount,
      agentCount,
      interactionSummaries,
    }) => {
      const parts = [
        `Summary of ${conversationCount} conversation(s) with the agent (${userCount} patient message(s) and ${agentCount} agent reply(ies)).`,
        ...interactionSummaries,
      ];
      return parts.join('\n');
    },
  };

  const template = templates[language] ?? templates.pt;
  return template({
    conversationCount: interactionGroups.length,
    userCount: userMessages.length,
    agentCount: agentMessages.length,
    interactionSummaries,
  });
};

export const buildHeuristicPatientInteractionSummary = (
  chatHistory: ClinicalChatMessage[],
  language: AppLanguage = 'pt'
): string | null => {
  const userMessages = chatHistory.filter((entry) => entry.sender === 'user');
  if (!userMessages.length) {
    return null;
  }

  const interactionGroups = splitChatIntoInteractions(chatHistory).slice(
    -MAX_INTERACTIONS_IN_SUMMARY
  );

  const interactionSummaries = interactionGroups
    .map((group, index) =>
      formatInteractionItem(
        index + 1,
        group,
        briefFallbackSummary(group),
        language
      )
    )
    .filter(Boolean);

  return assembleInteractionSummary(
    interactionGroups,
    interactionSummaries,
    chatHistory,
    language
  );
};

export const generatePatientInteractionSummary = async (
  env: Env,
  chatHistory: ClinicalChatMessage[],
  language: AppLanguage = 'pt',
  sessionContext = ''
): Promise<string | null> => {
  const userMessages = chatHistory.filter((entry) => entry.sender === 'user');
  if (!userMessages.length) {
    return null;
  }

  const interactionGroups = splitChatIntoInteractions(chatHistory).slice(
    -MAX_INTERACTIONS_IN_SUMMARY
  );

  if (!interactionGroups.length) {
    return null;
  }

  try {
    const raw = await runPatientChatInteractionSummaryGraph(env, {
      interactionGroups,
      sessionContext,
      language,
    });
    const summaryLines = parseAgenticSummaryLines(
      raw,
      interactionGroups.length
    );

    const interactionSummaries = interactionGroups
      .map((group, index) => {
        const agenticSummary =
          summaryLines[index] ?? briefFallbackSummary(group);
        return formatInteractionItem(
          index + 1,
          group,
          agenticSummary,
          language
        );
      })
      .filter(Boolean);

    if (!interactionSummaries.length) {
      return buildHeuristicPatientInteractionSummary(chatHistory, language);
    }

    return assembleInteractionSummary(
      interactionGroups,
      interactionSummaries,
      chatHistory,
      language
    );
  } catch {
    return buildHeuristicPatientInteractionSummary(chatHistory, language);
  }
};

/** @deprecated Use generatePatientInteractionSummary */
export const buildPatientInteractionSummary =
  buildHeuristicPatientInteractionSummary;
