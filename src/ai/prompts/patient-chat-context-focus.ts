import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import {
  buildAntiRepetitionGuidance,
  buildPresentMomentGuidance,
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
    'REGRAS PARA PERGUNTA ESPECÍFICA (não genérica):',
    '1. A pergunta DEVE mencionar um elemento concreto: lugar, pessoa, momento, situação ou detalhe da mensagem do paciente.',
    '2. A pergunta DEVE conectar esse elemento a um tema do contexto do psicólogo.',
    '3. PROIBIDO perguntas genéricas ou temporais: "Como você está?", "O que aconteceu?", "Como foi seu dia?", "hoje à noite", "ontem".',
    '4. Exemplo RUIM (temporal): "Como a tristeza afetou seu sono hoje à noite?"',
    '5. Exemplo BOM (agora): "Neste momento, além da tristeza, o que mais você sente no corpo?"',
    '6. Exemplo RUIM (técnico): "Essa sensação configura um sintoma de ansiedade social na abordagem TCC?"',
    '7. Exemplo BOM (sintético e agora): "Ao falar dos colegas, o que você sente agora de nervosismo ou preocupação?"',
    '8. PROIBIDO perguntas muito similares às já feitas — mude sensação, pessoa ou pensamento presente.',
  ].join('\n'),
  es: [
    'REGLAS PARA PREGUNTA ESPECÍFICA (no genérica):',
    '1. La pregunta DEBE mencionar un elemento concreto: lugar, persona, momento, situación o detalle del mensaje.',
    '2. La pregunta DEBE conectar ese elemento con un tema del contexto del psicólogo.',
    '3. PROHIBIDO preguntas genéricas o temporales: "¿Cómo estás?", "¿Qué pasó?", "¿Cómo fue su día?", "esta noche", "ayer".',
    '4. Ejemplo MALO (temporal): "¿Cómo afectó la tristeza su sueño esta noche?"',
    '5. Ejemplo BUENO (ahora): "En este momento, además de la tristeza, ¿qué más siente en el cuerpo?"',
    '6. Ejemplo MALO (técnico): "¿Esa sensación configura un síntoma de ansiedad social en el enfoque TCC?"',
    '7. Ejemplo BUENO (sintético y ahora): "Al hablar de los colegas, ¿qué siente ahora de nervios o preocupación?"',
    '8. PROHIBIDO preguntas muy similares a las ya hechas — cambie sensación, persona o pensamiento presente.',
  ].join('\n'),
  en: [
    'SPECIFIC QUESTION RULES (not generic):',
    '1. The question MUST mention a concrete element: place, person, moment, situation, or detail from the patient message.',
    '2. The question MUST connect that element to a theme from the psychologist context.',
    '3. FORBIDDEN generic or temporal questions: "How are you?", "What happened?", "How was your day?", "tonight", "yesterday".',
    '4. BAD example (temporal): "How did the sadness affect your sleep tonight?"',
    '5. GOOD example (now): "Right now, besides sadness, what else do you feel in your body?"',
    '6. BAD example (technical): "Does that feeling indicate a social anxiety symptom in the CBT approach?"',
    '7. GOOD example (synthesized, now): "When talking about colleagues, what nervousness or worry do you feel right now?"',
    '8. FORBIDDEN: questions very similar to ones already asked — change sensation, person, or present thought.',
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
      buildPresentMomentGuidance('pt'),
      specificQuestionRules.pt,
      focusHint ? `Tema do psicólogo para conectar: ${focusHint}` : '',
      stepHints.pt,
      'Monte UMA pergunta sintética, com palavras simples. Não use termos clínicos do contexto.',
    ],
    es: [
      `Mensaje actual del paciente: "${userMessage}"`,
      priorPatientMessages
        ? `Relatos anteriores del paciente: ${priorPatientMessages}`
        : '',
      `Preguntas del agente hasta ahora en esta conversación: ${questionCount}`,
      antiRepetitionBlock,
      buildPresentMomentGuidance('es'),
      specificQuestionRules.es,
      focusHint ? `Tema del psicólogo para conectar: ${focusHint}` : '',
      stepHints.es,
      'Formula UNA pregunta sintética, con palabras simples. No uses términos clínicos del contexto.',
    ],
    en: [
      `Current patient message: "${userMessage}"`,
      priorPatientMessages
        ? `Prior patient reports: ${priorPatientMessages}`
        : '',
      `Agent questions so far in this conversation: ${questionCount}`,
      antiRepetitionBlock,
      buildPresentMomentGuidance('en'),
      specificQuestionRules.en,
      focusHint ? `Psychologist theme to connect: ${focusHint}` : '',
      stepHints.en,
      'Build ONE synthesized question with simple words. Do not use clinical terms from the context.',
    ],
  };

  return (blocks[language] ?? blocks.pt).filter(Boolean).join('\n');
};
