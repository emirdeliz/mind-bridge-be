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
    return '';
  }

  const listedThemes = focusPoints.map((point) => `- ${point}`).join('\n');

  const blocks: Record<AppLanguage, string> = {
    pt: [
      'Temas prioritários do psicólogo (use para direcionar perguntas sobre relatos do dia a dia):',
      listedThemes,
      'Traduza estes temas para linguagem simples e use-os para orientar o paciente no relato — sem mencionar que veio do psicólogo.',
    ].join('\n'),
    es: [
      'Temas prioritarios del psicólogo (use para orientar preguntas sobre relatos del día a día):',
      listedThemes,
      'Traduzca estos temas a lenguaje simple y úselos para orientar al paciente en el relato — sin mencionar que viene del psicólogo.',
    ].join('\n'),
    en: [
      'Priority themes from the psychologist (use to guide questions about day-to-day reports):',
      listedThemes,
      'Translate these themes into simple language and use them to guide the patient in their report — without mentioning they came from the psychologist.',
    ].join('\n'),
  };

  return blocks[language] ?? blocks.pt;
};

export const buildPatientChatTurnGuidance = (
  language: AppLanguage,
  userMessage: string,
  psychologistContext: string,
  questionCount: number,
  chatHistory: ClinicalChatMessage[] = [],
  retryAttempt = 0,
  rejectedReply?: string,
  retrievalContext = ''
): string => {
  const hasTextContext = Boolean(psychologistContext.trim());
  const hasKnowledgeContext = Boolean(retrievalContext.trim());
  const priorAgentReplies = extractRecentAgentQuestions(chatHistory);
  const antiRepetitionBlock = buildAntiRepetitionGuidance(
    language,
    priorAgentReplies
  );
  const angleGuidance = buildQuestionAngleGuidance(
    language,
    userMessage,
    priorAgentReplies,
    { hasTextContext, hasKnowledgeContext }
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
        ? 'Ajude o paciente a iniciar ou continuar um relato do dia a dia — acolha e faça uma pergunta que o direcione a contar mais (use o contexto do psicólogo se disponível).'
        : 'Direcione o paciente no meio do relato com uma pergunta alinhada ao contexto do psicólogo ou, se couber, apenas acolha/reflita brevemente.',
    es:
      questionCount === 0
        ? 'Ayude al paciente a iniciar o continuar un relato del día a día — acoja y haga una pregunta que lo oriente a contar más (use el contexto del psicólogo si está disponible).'
        : 'Oriente al paciente en medio del relato con una pregunta alineada al contexto del psicólogo o, si corresponde, solo acoja/reflexione brevemente.',
    en:
      questionCount === 0
        ? 'Help the patient start or continue a day-to-day report — acknowledge and ask a question that guides them to say more (use psychologist context if available).'
        : 'Guide the patient through their report with a question aligned to the psychologist context or, if appropriate, only acknowledge/reflect briefly.',
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
