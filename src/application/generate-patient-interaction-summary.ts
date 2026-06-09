import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

const MAX_SNIPPET_CHARS = 140;

const truncate = (text: string, maxChars = MAX_SNIPPET_CHARS): string => {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxChars - 1).trimEnd()}…`;
};

const collectUserThemes = (messages: ClinicalChatMessage[]): string => {
  const combined = messages
    .map((entry) => entry.text.trim())
    .filter(Boolean)
    .join(' ');

  return truncate(combined, 220);
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

  const lastUserMessage = userMessages.at(-1)?.text ?? '';
  const lastAgentMessage = agentMessages.at(-1)?.text ?? '';
  const themes = collectUserThemes(userMessages);

  const templates: Record<
    AppLanguage,
    (data: {
      userCount: number;
      agentCount: number;
      themes: string;
      lastUser: string;
      lastAgent: string;
    }) => string
  > = {
    pt: ({ userCount, agentCount, themes, lastUser, lastAgent }) => {
      const parts = [
        `Interações: ${userCount} mensagem(ns) sua(s) e ${agentCount} resposta(s) do agente.`,
        `Temas abordados: ${themes}.`,
        `Último relato: ${truncate(lastUser)}.`,
      ];
      if (lastAgent) {
        parts.push(`Última orientação do agente: ${truncate(lastAgent)}.`);
      }
      return parts.join(' ');
    },
    es: ({ userCount, agentCount, themes, lastUser, lastAgent }) => {
      const parts = [
        `Interacciones: ${userCount} mensaje(s) suyo(s) y ${agentCount} respuesta(s) del agente.`,
        `Temas abordados: ${themes}.`,
        `Último relato: ${truncate(lastUser)}.`,
      ];
      if (lastAgent) {
        parts.push(`Última orientación del agente: ${truncate(lastAgent)}.`);
      }
      return parts.join(' ');
    },
    en: ({ userCount, agentCount, themes, lastUser, lastAgent }) => {
      const parts = [
        `Interactions: ${userCount} patient message(s) and ${agentCount} agent reply(ies).`,
        `Topics covered: ${themes}.`,
        `Latest report: ${truncate(lastUser)}.`,
      ];
      if (lastAgent) {
        parts.push(`Latest agent guidance: ${truncate(lastAgent)}.`);
      }
      return parts.join(' ');
    },
  };

  const template = templates[language] ?? templates.pt;

  return template({
    userCount: userMessages.length,
    agentCount: agentMessages.length,
    themes,
    lastUser: lastUserMessage,
    lastAgent: lastAgentMessage,
  });
};
