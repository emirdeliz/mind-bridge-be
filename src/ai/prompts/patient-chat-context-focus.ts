import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import {
  buildAntiRepetitionGuidance,
  buildPatientChatSimplicityGuidance,
  buildPatientChatRetryGuidance,
  buildPsychologistStanceGuidance,
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
    'PERGUNTA (aberta e contextualizada):',
    '- Ancore na mensagem do paciente (pessoa, situação, sentimento que ele trouxe).',
    '- PROIBIDO: "Como você está?", perguntas sobre ontem/hoje, termos clínicos, fórmulas ("o que sente agora").',
    '- Exemplo BOM: "Quando pensa na conversa com seus colegas, o que mais pesa para você nessa situação?"',
  ].join('\n'),
  es: [
    'PREGUNTA (abierta y contextualizada):',
    '- Ancle en el mensaje del paciente (persona, situación, sentimiento que trajo).',
    '- PROHIBIDO: "¿Cómo estás?", preguntas sobre ayer/hoy, términos clínicos, fórmulas ("qué siente ahora").',
    '- Ejemplo BUENO: "Cuando piensa en la conversación con sus colegas, ¿qué pesa más para usted en esa situación?"',
  ].join('\n'),
  en: [
    'QUESTION (open and contextual):',
    '- Anchor on the patient message (person, situation, feeling they brought up).',
    '- FORBIDDEN: "How are you?", yesterday/today questions, clinical terms, formulas ("what you feel now").',
    '- GOOD example: "When you think about the conversation with your colleagues, what weighs on you most in that situation?"',
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
      pt: 'Sem contexto do psicólogo. Explore o relato do paciente com curiosidade — convide-o a elaborar um aspecto que mencionou.',
      es: 'Sin contexto del psicólogo. Explore el relato del paciente con curiosidad — invítelo a elaborar un aspecto que mencionó.',
      en: 'No psychologist context. Explore the patient report with curiosity — invite them to elaborate on an aspect they mentioned.',
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
        ? 'Primeira pergunta: acolha brevemente e convide o paciente a elaborar UM aspecto do relato atual.'
        : 'Faça UMA pergunta aberta com ângulo NOVO — diferente das anteriores nesta interação.',
    es:
      questionCount === 0
        ? 'Primera pregunta: acoja brevemente e invite al paciente a elaborar UN aspecto del relato actual.'
        : 'Haga UNA pregunta abierta con ángulo NUEVO — diferente de las anteriores en esta interacción.',
    en:
      questionCount === 0
        ? 'First question: briefly acknowledge and invite the patient to elaborate on ONE aspect of the current report.'
        : 'Ask ONE open question from a NEW angle — different from prior ones in this interaction.',
  };

  const psychologistStance = buildPsychologistStanceGuidance(language);

  const blocks: Record<AppLanguage, string[]> = {
    pt: [
      retryBlock,
      psychologistStance,
      angleGuidance,
      `Perguntas do agente nesta interação: ${questionCount}`,
      antiRepetitionBlock,
      specificQuestionRules.pt,
      focusHint ? `Tema do psicólogo (uso interno): ${focusHint}` : '',
      stepHints.pt,
      buildPatientChatSimplicityGuidance('pt'),
      `Responda à mensagem atual do paciente: "${userMessage}"`,
    ],
    es: [
      retryBlock,
      psychologistStance,
      angleGuidance,
      `Preguntas del agente en esta interacción: ${questionCount}`,
      antiRepetitionBlock,
      specificQuestionRules.es,
      focusHint ? `Tema del psicólogo (uso interno): ${focusHint}` : '',
      stepHints.es,
      buildPatientChatSimplicityGuidance('es'),
      `Responda al mensaje actual del paciente: "${userMessage}"`,
    ],
    en: [
      retryBlock,
      psychologistStance,
      angleGuidance,
      `Agent questions in this interaction: ${questionCount}`,
      antiRepetitionBlock,
      specificQuestionRules.en,
      focusHint ? `Psychologist theme (internal): ${focusHint}` : '',
      stepHints.en,
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
