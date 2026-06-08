import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import {
  buildAntiRepetitionGuidance,
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
    '3. PROIBIDO perguntas genéricas: "Como você está?", "O que aconteceu?", "Poderia me contar mais?", "O que contribuiu para isso?", "Como foi seu dia?".',
    '4. Exemplo RUIM (genérico): "Poderia me contar o que ocorreu hoje?"',
    '5. Exemplo BOM (específico e simples): "Na conversa com colegas hoje, em que momento você se sentiu mais triste?"',
    '6. Exemplo RUIM (técnico): "Essa sensação configura um sintoma de ansiedade social na abordagem TCC?"',
    '7. Exemplo BOM (sintético): "Na reunião de hoje, o que mais te deixou nervoso e como isso afetou o resto do dia?"',
    '8. PROIBIDO perguntas muito similares às já feitas — mude pessoa, momento, sensação ou consequência.',
  ].join('\n'),
  es: [
    'REGLAS PARA PREGUNTA ESPECÍFICA (no genérica):',
    '1. La pregunta DEBE mencionar un elemento concreto: lugar, persona, momento, situación o detalle del mensaje.',
    '2. La pregunta DEBE conectar ese elemento con un tema del contexto del psicólogo.',
    '3. PROHIBIDO preguntas genéricas: "¿Cómo estás?", "¿Qué pasó?", "¿Podría contarme más?", "¿Cómo fue su día?".',
    '4. Ejemplo MALO (genérico): "¿Podría contarme qué ocurrió hoy?"',
    '5. Ejemplo BUENO (específico y simple): "En la conversación con colegas hoy, ¿en qué momento se sintió más triste?"',
    '6. Ejemplo MALO (técnico): "¿Esa sensación configura un síntoma de ansiedad social en el enfoque TCC?"',
    '7. Ejemplo BUENO (sintético): "En la reunión de hoy, ¿qué le dejó más nervioso y cómo afectó el resto del día?"',
    '8. PROHIBIDO preguntas muy similares a las ya hechas — cambie persona, momento, sensación o consecuencia.',
  ].join('\n'),
  en: [
    'SPECIFIC QUESTION RULES (not generic):',
    '1. The question MUST mention a concrete element: place, person, moment, situation, or detail from the patient message.',
    '2. The question MUST connect that element to a theme from the psychologist context.',
    '3. FORBIDDEN generic questions: "How are you?", "What happened?", "Could you tell me more?", "How was your day?".',
    '4. BAD example (generic): "Could you tell me what happened today?"',
    '5. GOOD example (specific and simple): "During today conversation with colleagues, when did you feel saddest?"',
    '6. BAD example (technical): "Does that feeling indicate a social anxiety symptom in the CBT approach?"',
    '7. GOOD example (synthesized): "In today meeting, what made you most nervous and how did that affect the rest of your day?"',
    '8. FORBIDDEN: questions very similar to ones already asked — change person, moment, sensation, or consequence.',
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
      specificQuestionRules.en,
      focusHint ? `Psychologist theme to connect: ${focusHint}` : '',
      stepHints.en,
      'Build ONE synthesized question with simple words. Do not use clinical terms from the context.',
    ],
  };

  return (blocks[language] ?? blocks.pt).filter(Boolean).join('\n');
};
