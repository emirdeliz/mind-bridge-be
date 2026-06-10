import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import {
  buildAntiRepetitionGuidance,
  buildPatientChatBrevityGuidance,
  buildPatientChatSimplicityGuidance,
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

const formatRecentPatientMessages = (
  chatHistory: ClinicalChatMessage[]
): string => {
  const patientMessages = chatHistory
    .filter((message) => message.sender === 'user')
    .slice(-3)
    .map((message) => message.text);

  return patientMessages.length ? patientMessages.join(' | ') : '';
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

export const buildPatientChatHumanPrompt = (
  language: AppLanguage,
  userMessage: string,
  context: string,
  questionCount: number,
  chatHistory: ClinicalChatMessage[] = []
): string => {
  const focusHint = resolveQuestionFocusHint(context, questionCount);
  const priorPatientMessages = formatRecentPatientMessages(chatHistory);
  const priorAgentQuestions = extractRecentAgentQuestions(chatHistory);
  const antiRepetitionBlock = buildAntiRepetitionGuidance(
    language,
    priorAgentQuestions
  );

  const stepHints: Record<AppLanguage, string> = {
    pt:
      questionCount === 0
        ? 'Valide o relato e pergunte sobre UM momento ou situação específica ligada ao que o paciente disse.'
        : 'Com base no que já foi dito, faça UMA pergunta com ângulo NOVO — aspecto, pessoa ou consequência ainda não explorados.',
    es:
      questionCount === 0
        ? 'Valide el relato y pregunte por UN momento o situación específica ligada a lo que el paciente dijo.'
        : 'Con base en lo ya dicho, haz UNA pregunta con ángulo NUEVO — aspecto, persona o consecuencia aún no explorados.',
    en:
      questionCount === 0
        ? 'Validate the report and ask about ONE specific moment or situation tied to what the patient said.'
        : 'Based on what was already said, ask ONE question from a NEW angle — unexplored aspect, person, or consequence.',
  };

  const blocks: Record<AppLanguage, string[]> = {
    pt: [
      `Mensagem atual do paciente: "${userMessage}"`,
      priorPatientMessages
        ? `Relatos anteriores do paciente: ${priorPatientMessages}`
        : '',
      `Perguntas do agente até agora nesta conversa: ${questionCount}`,
      antiRepetitionBlock,
      specificQuestionRules.pt,
      focusHint ? `Tema do psicólogo (uso interno): ${focusHint}` : '',
      stepHints.pt,
      buildPatientChatBrevityGuidance('pt'),
      buildPatientChatSimplicityGuidance('pt'),
      'Responda em 1–2 frases curtas. Exemplo: "Entendo. O que você sente agora ao pensar nisso?"',
    ],
    es: [
      `Mensaje actual del paciente: "${userMessage}"`,
      priorPatientMessages
        ? `Relatos anteriores del paciente: ${priorPatientMessages}`
        : '',
      `Preguntas del agente hasta ahora en esta conversación: ${questionCount}`,
      antiRepetitionBlock,
      specificQuestionRules.es,
      focusHint ? `Tema del psicólogo (uso interno): ${focusHint}` : '',
      stepHints.es,
      buildPatientChatBrevityGuidance('es'),
      buildPatientChatSimplicityGuidance('es'),
      'Responde en 1–2 frases cortas. Ejemplo: "Entiendo. ¿Qué siente ahora al pensar en eso?"',
    ],
    en: [
      `Current patient message: "${userMessage}"`,
      priorPatientMessages
        ? `Prior patient reports: ${priorPatientMessages}`
        : '',
      `Agent questions so far in this conversation: ${questionCount}`,
      antiRepetitionBlock,
      specificQuestionRules.en,
      focusHint ? `Psychologist theme (internal): ${focusHint}` : '',
      stepHints.en,
      buildPatientChatBrevityGuidance('en'),
      buildPatientChatSimplicityGuidance('en'),
      'Reply in 1–2 short sentences. Example: "I understand. What do you feel right now when you think about that?"',
    ],
  };

  return (blocks[language] ?? blocks.pt).filter(Boolean).join('\n');
};
