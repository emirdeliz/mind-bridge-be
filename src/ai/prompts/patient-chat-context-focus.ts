import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import {
  buildAntiRepetitionGuidance,
  buildPatientChatRetryGuidance,
  buildQuestionAngleGuidance,
  extractRecentAgentQuestions,
} from './patient-chat-interaction.js';

const MIN_FOCUS_LENGTH = 8;
const MAX_FOCUS_POINTS = 5;

export const extractContextFocusPoints = (context: string): string[] => {
  const normalized = context.trim();
  if (!normalized) {
    return [];
  }

  const parts = normalized
    .split(/[.;!\n•]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= MIN_FOCUS_LENGTH);

  if (parts.length > 0) {
    return parts.slice(0, MAX_FOCUS_POINTS);
  }

  return [normalized.slice(0, 220)];
};

export const buildContextFocusBlock = (
  language: AppLanguage,
  context: string
): string => {
  const focusPoints = extractContextFocusPoints(context);

  if (!focusPoints.length) {
    const empty: Record<AppLanguage, string> = {
      pt: 'Sem contexto do psicólogo. Siga o relato do paciente com curiosidade.',
      es: 'Sin contexto del psicólogo. Siga el relato del paciente con curiosidad.',
      en: 'No psychologist context. Follow the patient report with curiosity.',
    };
    return empty[language];
  }

  const listedThemes = focusPoints.map((point) => `- ${point}`).join('\n');

  const blocks: Record<AppLanguage, string> = {
    pt: [
      'Temas do contexto do psicólogo (referência interna):',
      listedThemes,
      'Use os temas só internamente; na resposta, traduza para linguagem simples e siga o que o paciente acabou de dizer.',
    ].join('\n'),
    es: [
      'Temas del contexto del psicólogo (referencia interna):',
      listedThemes,
      'Use los temas solo internamente; en la respuesta, traduzca a lenguaje simple y siga lo que el paciente acaba de decir.',
    ].join('\n'),
    en: [
      'Themes from psychologist context (internal reference):',
      listedThemes,
      'Use themes internally only; in the reply, translate to simple language and follow what the patient just said.',
    ].join('\n'),
  };

  return blocks[language] ?? blocks.pt;
};

export const buildPatientChatTurnGuidance = (
  language: AppLanguage,
  userMessage: string,
  _context: string,
  questionCount: number,
  chatHistory: ClinicalChatMessage[] = [],
  retryAttempt = 0,
  rejectedReply?: string
): string => {
  const priorAgentReplies = extractRecentAgentQuestions(chatHistory);
  const antiRepetitionBlock = buildAntiRepetitionGuidance(
    language,
    priorAgentReplies
  );
  const angleGuidance = buildQuestionAngleGuidance(
    language,
    userMessage,
    priorAgentReplies
  );
  const retryBlock =
    retryAttempt > 0 && rejectedReply
      ? buildPatientChatRetryGuidance(
          language,
          rejectedReply,
          priorAgentReplies,
          retryAttempt
        )
      : '';

  const stepHints: Record<AppLanguage, string> = {
    pt:
      questionCount === 0
        ? 'Responda à mensagem atual — acolha e, se couber, convide a elaborar.'
        : 'Responda ao que o paciente acabou de dizer; pergunta ou reflexão breve, conforme fizer sentido.',
    es:
      questionCount === 0
        ? 'Responda al mensaje actual — acoja e, si encaja, invite a elaborar.'
        : 'Responda a lo que el paciente acaba de decir; pregunta o reflexión breve, según tenga sentido.',
    en:
      questionCount === 0
        ? 'Reply to the current message — acknowledge and, if it fits, invite elaboration.'
        : 'Reply to what the patient just said; question or brief reflection, as appropriate.',
  };

  const blocks: Record<AppLanguage, string[]> = {
    pt: [
      retryBlock,
      angleGuidance,
      antiRepetitionBlock,
      `Perguntas feitas nesta interação: ${questionCount}`,
      stepHints.pt,
      `Mensagem atual do paciente: "${userMessage}"`,
    ],
    es: [
      retryBlock,
      angleGuidance,
      antiRepetitionBlock,
      `Preguntas hechas en esta interacción: ${questionCount}`,
      stepHints.es,
      `Mensaje actual del paciente: "${userMessage}"`,
    ],
    en: [
      retryBlock,
      angleGuidance,
      antiRepetitionBlock,
      `Questions asked in this interaction: ${questionCount}`,
      stepHints.en,
      `Patient's current message: "${userMessage}"`,
    ],
  };

  return (blocks[language] ?? blocks.pt).filter(Boolean).join('\n');
};

/** @deprecated Use buildPatientChatTurnGuidance with multi-turn history instead. */
export const buildPatientChatHumanPrompt = (
  language: AppLanguage,
  userMessage: string,
  context: string,
  questionCount: number,
  chatHistory: ClinicalChatMessage[] = []
): string => buildPatientChatTurnGuidance(
  language,
  userMessage,
  context,
  questionCount,
  chatHistory
);
