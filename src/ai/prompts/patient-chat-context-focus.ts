import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import {
  buildAntiRepetitionGuidance,
  buildPatientChatBrevityGuidance,
  buildPatientChatRetryGuidance,
  buildPatientChatSimplicityGuidance,
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

export const resolveQuestionFocusHint = (
  context: string,
  questionCount: number
): string => {
  const focusPoints = extractContextFocusPoints(context);

  if (!focusPoints.length) {
    return '';
  }

  return focusPoints[questionCount % focusPoints.length] ?? '';
};

const specificQuestionRules: Record<AppLanguage, string> = {
  pt: [
    'PERGUNTA (curta e específica):',
    '- Mencione um detalhe concreto da mensagem (pessoa, lugar, situação).',
    '- PROIBIDO: "Como você está?", perguntas sobre ontem/hoje, termos clínicos.',
    '- Exemplo BOM: "O que você sente agora ao falar dos colegas?"',
  ].join('\n'),
  es: [
    'PREGUNTA (corta y específica):',
    '- Mencione un detalle concreto del mensaje (persona, lugar, situación).',
    '- PROHIBIDO: "¿Cómo estás?", preguntas sobre ayer/hoy, términos clínicos.',
    '- Ejemplo BUENO: "¿Qué siente ahora al hablar de los colegas?"',
  ].join('\n'),
  en: [
    'QUESTION (short and specific):',
    '- Mention one concrete detail from the message (person, place, situation).',
    '- FORBIDDEN: "How are you?", yesterday/today questions, clinical terms.',
    '- GOOD example: "What do you feel right now when talking about colleagues?"',
  ].join('\n'),
};

export const buildContextFocusBlock = (
  language: AppLanguage,
  context: string,
  questionCount: number
): string => {
  const focusPoints = extractContextFocusPoints(context);
  const focusHint = resolveQuestionFocusHint(context, questionCount);

  if (!focusPoints.length) {
    const empty: Record<AppLanguage, string> = {
      pt: 'Sem contexto do psicólogo. Extraia da mensagem do paciente um detalhe concreto (lugar, pessoa, momento) e pergunte sobre ele.',
      es: 'Sin contexto del psicólogo. Extrae del mensaje del paciente un detalle concreto y pregunta sobre él.',
      en: 'No psychologist context. Extract one concrete detail from the patient message and ask about it.',
    };
    return empty[language];
  }

  const listedThemes = focusPoints.map((point) => `- ${point}`).join('\n');

  const blocks: Record<AppLanguage, string> = {
    pt: [
      'Temas do contexto do psicólogo:',
      listedThemes,
      `Tema sugerido nesta pergunta: ${focusHint}`,
      'Use o tema só internamente. Na pergunta ao paciente, sintetize em linguagem simples sobre situações do dia a dia.',
    ].join('\n'),
    es: [
      'Temas del contexto del psicólogo:',
      listedThemes,
      `Tema sugerido en esta pregunta: ${focusHint}`,
      'Usa el tema solo internamente. En la pregunta al paciente, sintetiza con palabras simples sobre situaciones del día a día.',
    ].join('\n'),
    en: [
      'Themes from psychologist context:',
      listedThemes,
      `Suggested theme for this question: ${focusHint}`,
      'Use the theme internally only. In the question to the patient, synthesize with simple words about everyday situations.',
    ].join('\n'),
  };

  return blocks[language] ?? blocks.pt;
};

export const buildPatientChatTurnGuidance = (
  language: AppLanguage,
  userMessage: string,
  context: string,
  questionCount: number,
  chatHistory: ClinicalChatMessage[] = [],
  retryAttempt = 0,
  rejectedReply?: string
): string => {
  const focusHint = resolveQuestionFocusHint(context, questionCount);
  const priorAgentQuestions = extractRecentAgentQuestions(chatHistory);
  const antiRepetitionBlock = buildAntiRepetitionGuidance(
    language,
    priorAgentQuestions
  );
  const angleGuidance = buildQuestionAngleGuidance(language, questionCount);
  const retryBlock =
    retryAttempt > 0 && rejectedReply
      ? buildPatientChatRetryGuidance(
          language,
          rejectedReply,
          priorAgentQuestions,
          retryAttempt
        )
      : '';

  const stepHints: Record<AppLanguage, string> = {
    pt:
      questionCount === 0
        ? 'Primeira pergunta: valide o relato e pergunte sobre UM detalhe concreto (pessoa, lugar ou situação) da mensagem atual.'
        : 'Faça UMA pergunta com ângulo NOVO — diferente das anteriores nesta interação.',
    es:
      questionCount === 0
        ? 'Primera pregunta: valide el relato y pregunte por UN detalle concreto (persona, lugar o situación) del mensaje actual.'
        : 'Haga UNA pregunta con ángulo NUEVO — diferente de las anteriores en esta interacción.',
    en:
      questionCount === 0
        ? 'First question: validate the report and ask about ONE concrete detail (person, place, or situation) from the current message.'
        : 'Ask ONE question from a NEW angle — different from prior ones in this interaction.',
  };

  const blocks: Record<AppLanguage, string[]> = {
    pt: [
      retryBlock,
      angleGuidance,
      `Perguntas do agente nesta interação: ${questionCount}`,
      antiRepetitionBlock,
      specificQuestionRules.pt,
      focusHint ? `Tema do psicólogo (uso interno): ${focusHint}` : '',
      stepHints.pt,
      buildPatientChatBrevityGuidance('pt'),
      buildPatientChatSimplicityGuidance('pt'),
      `Responda à mensagem atual do paciente: "${userMessage}"`,
    ],
    es: [
      retryBlock,
      angleGuidance,
      `Preguntas del agente en esta interacción: ${questionCount}`,
      antiRepetitionBlock,
      specificQuestionRules.es,
      focusHint ? `Tema del psicólogo (uso interno): ${focusHint}` : '',
      stepHints.es,
      buildPatientChatBrevityGuidance('es'),
      buildPatientChatSimplicityGuidance('es'),
      `Responda al mensaje actual del paciente: "${userMessage}"`,
    ],
    en: [
      retryBlock,
      angleGuidance,
      `Agent questions in this interaction: ${questionCount}`,
      antiRepetitionBlock,
      specificQuestionRules.en,
      focusHint ? `Psychologist theme (internal): ${focusHint}` : '',
      stepHints.en,
      buildPatientChatBrevityGuidance('en'),
      buildPatientChatSimplicityGuidance('en'),
      `Reply to the patient's current message: "${userMessage}"`,
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
