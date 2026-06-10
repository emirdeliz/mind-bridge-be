import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import { getInteractionGroupsFromLastWeek } from '../../application/patient-chat-interaction-groups.js';

const formatInteractionDate = (
  message: ClinicalChatMessage | undefined,
  language: AppLanguage
): string => {
  if (!message?.createdAt) {
    return '';
  }
  const parsed = Date.parse(message.createdAt);
  if (Number.isNaN(parsed)) {
    return '';
  }

  const locale =
    language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-US';

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(parsed));
};

const buildWeeklyDigest = (
  groups: ClinicalChatMessage[][],
  language: AppLanguage
): string => {
  if (!groups.length) {
    return '';
  }

  const labels: Record<AppLanguage, string> = {
    pt: 'conversa(s) na última semana',
    es: 'conversación(es) en la última semana',
    en: 'conversation(s) in the last week',
  };

  const lines = groups.map((messages, index) => {
    const firstUser = messages.find((message) => message.sender === 'user');
    const preview = (firstUser?.text ?? '').trim().slice(0, 100);
    const date = formatInteractionDate(firstUser, language);
    const dateSuffix = date ? `, ${date}` : '';
    return `${index + 1}. ${preview}${dateSuffix}`;
  });

  return `${groups.length} ${labels[language]}:\n${lines.join('\n')}`;
};

export const formatWeeklyPatientChatContext = (
  history: ClinicalChatMessage[],
  language: AppLanguage
): { digest: string; blocks: string; conversationCount: number } => {
  const groups = getInteractionGroupsFromLastWeek(history);

  const blocks = groups
    .map((messages, index) => {
      const firstUser = messages.find((message) => message.sender === 'user');
      const date = formatInteractionDate(firstUser, language);
      const header = date
        ? `--- Conversa ${index + 1} (${date}) ---`
        : `--- Conversa ${index + 1} ---`;

      const lines = messages
        .map((message) => {
          const role = message.sender === 'user' ? 'Paciente' : 'Agente';
          return `  ${role}: ${message.text}`;
        })
        .join('\n');

      return `${header}\n${lines}`;
    })
    .join('\n\n');

  return {
    digest: buildWeeklyDigest(groups, language),
    blocks,
    conversationCount: groups.length,
  };
};
