import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import type { PatientChatInteractionPhase } from './patient-chat-interaction.js';

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
  phase: Exclude<PatientChatInteractionPhase, 'closing'>
): string => {
  const focusPoints = extractContextFocusPoints(context);

  if (!focusPoints.length) {
    return '';
  }

  const index =
    phase === 'question-1' ? 0 : phase === 'question-2' ? 1 : 2;

  return focusPoints[index] ?? focusPoints[focusPoints.length - 1] ?? '';
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
  ].join('\n'),
  es: [
    'REGLAS PARA PREGUNTA ESPECÍFICA (no genérica):',
    '1. La pregunta DEBE mencionar un elemento concreto: lugar, persona, momento, situación o detalle del mensaje.',
    '2. La pregunta DEBE conectar ese elemento con un tema del contexto del psicólogo.',
    '3. PROHIBIDO preguntas genéricas: "¿Cómo estás?", "¿Qué pasó?", "¿Podría contarme más?", "¿Cómo fue su día?".',
    '4. Ejemplo MALO (genérico): "¿Podría contarme qué ocurrió hoy?"',
    '5. Ejemplo BUENO (específico y simple): "En la conversación con colegas hoy, ¿en qué momento se sintió más triste?"',
    '6. Ejemplo MALO (técnico): "¿Esa sensación configura un síntoma de ansiedad social en el enfoque TCC?"',
  ].join('\n'),
  en: [
    'SPECIFIC QUESTION RULES (not generic):',
    '1. The question MUST mention a concrete element: place, person, moment, situation, or detail from the patient message.',
    '2. The question MUST connect that element to a theme from the psychologist context.',
    '3. FORBIDDEN generic questions: "How are you?", "What happened?", "Could you tell me more?", "How was your day?".',
    '4. BAD example (generic): "Could you tell me what happened today?"',
    '5. GOOD example (specific and simple): "During today conversation with colleagues, when did you feel saddest?"',
    '6. BAD example (technical): "Does that feeling indicate a social anxiety symptom in the CBT approach?"',
  ].join('\n'),
};

export const buildContextFocusBlock = (
  language: AppLanguage,
  context: string,
  phase: Exclude<PatientChatInteractionPhase, 'closing'>
): string => {
  const focusPoints = extractContextFocusPoints(context);
  const focusHint = resolveQuestionFocusHint(context, phase);

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
      `Tema prioritário nesta pergunta: ${focusHint}`,
      'Use o tema acima só internamente. Na pergunta ao paciente, fale com palavras simples sobre situações do dia a dia.',
    ].join('\n'),
    es: [
      'Temas del contexto del psicólogo:',
      listedThemes,
      `Tema prioritario en esta pregunta: ${focusHint}`,
      'Usa el tema solo internamente. En la pregunta al paciente, habla con palabras simples sobre situaciones del día a día.',
    ].join('\n'),
    en: [
      'Themes from psychologist context:',
      listedThemes,
      `Priority theme for this question: ${focusHint}`,
      'Use the theme internally only. In the question to the patient, use simple words about everyday situations.',
    ].join('\n'),
  };

  return blocks[language] ?? blocks.pt;
};

export const buildPatientChatHumanPrompt = (
  language: AppLanguage,
  userMessage: string,
  context: string,
  phase: Exclude<PatientChatInteractionPhase, 'closing'>,
  chatHistory: ClinicalChatMessage[] = []
): string => {
  const focusHint = resolveQuestionFocusHint(context, phase);
  const priorPatientMessages = formatRecentPatientMessages(chatHistory);

  const phaseSteps: Record<AppLanguage, Record<string, string>> = {
    pt: {
      'question-1':
        'Pergunte sobre UM momento ou situação específica ligada ao que o paciente acabou de dizer e ao tema do contexto.',
      'question-2':
        'Aprofunde UM detalhe novo da última resposta (quem, onde, quando, o que sentiu no corpo ou na mente).',
      'question-3':
        'Explore outro aspecto prático ainda não perguntado (rotina, pessoas, sono, trabalho) ligado ao contexto.',
    },
    es: {
      'question-1':
        'Pregunta por UN momento o situación específica ligada a lo que el paciente acaba de decir y al tema del contexto.',
      'question-2':
        'Profundiza UN detalle nuevo de la última respuesta (quién, dónde, cuándo, qué sintió).',
      'question-3':
        'Explora otro aspecto práctico aún no preguntado, ligado al contexto.',
    },
    en: {
      'question-1':
        'Ask about ONE specific moment or situation tied to what the patient just said and the context theme.',
      'question-2':
        'Deepen ONE new detail from the latest reply (who, where, when, what they felt).',
      'question-3':
        'Explore another practical aspect not yet asked, tied to the context.',
    },
  };

  const blocks: Record<AppLanguage, string[]> = {
    pt: [
      `Mensagem atual do paciente: "${userMessage}"`,
      priorPatientMessages
        ? `Relatos anteriores do paciente nesta interação: ${priorPatientMessages}`
        : '',
      specificQuestionRules.pt,
      focusHint ? `Tema do psicólogo para conectar: ${focusHint}` : '',
      phaseSteps.pt[phase],
      'Monte a pergunta citando situação concreta, com palavras simples. Não use termos do contexto clínico na pergunta.',
    ],
    es: [
      `Mensaje actual del paciente: "${userMessage}"`,
      priorPatientMessages
        ? `Relatos anteriores del paciente: ${priorPatientMessages}`
        : '',
      specificQuestionRules.es,
      focusHint ? `Tema del psicólogo para conectar: ${focusHint}` : '',
      phaseSteps.es[phase],
      'Formula la pregunta citando situación concreta, con palabras simples. No uses términos clínicos del contexto.',
    ],
    en: [
      `Current patient message: "${userMessage}"`,
      priorPatientMessages
        ? `Prior patient reports in this interaction: ${priorPatientMessages}`
        : '',
      specificQuestionRules.en,
      focusHint ? `Psychologist theme to connect: ${focusHint}` : '',
      phaseSteps.en[phase],
      'Build the question citing a concrete situation, with simple words. Do not use clinical terms from the context.',
    ],
  };

  return (blocks[language] ?? blocks.pt).filter(Boolean).join('\n');
};
