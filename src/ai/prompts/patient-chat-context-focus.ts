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

export const buildContextFocusBlock = (
  language: AppLanguage,
  context: string,
  phase: Exclude<PatientChatInteractionPhase, 'closing'>
): string => {
  const focusPoints = extractContextFocusPoints(context);
  const focusHint = resolveQuestionFocusHint(context, phase);

  if (!focusPoints.length) {
    const empty: Record<AppLanguage, string> = {
      pt: 'Sem contexto do psicólogo. Pergunte sobre uma situação concreta recente na vida do paciente.',
      es: 'Sin contexto del psicólogo. Pregunta por una situación concreta reciente en la vida del paciente.',
      en: 'No psychologist context. Ask about one recent concrete situation in the patient life.',
    };
    return empty[language];
  }

  const listedThemes = focusPoints.map((point) => `- ${point}`).join('\n');

  const blocks: Record<AppLanguage, string> = {
    pt: [
      'Contexto do psicólogo (leia literalmente e interprete o que deve ser explorado):',
      listedThemes,
      `Nesta resposta, explore em linguagem simples o seguinte trecho: ${focusHint}`,
      'Pergunte sobre situações vividas pelo paciente, não sobre o plano de tratamento em si.',
    ].join('\n'),
    es: [
      'Contexto del psicólogo (léelo literalmente e interpreta qué debe explorarse):',
      listedThemes,
      `En esta respuesta, explora en lenguaje simple este fragmento: ${focusHint}`,
      'Pregunta por situaciones vividas por el paciente, no sobre el plan de tratamiento en sí.',
    ].join('\n'),
    en: [
      'Psychologist context (read literally and interpret what should be explored):',
      listedThemes,
      `In this reply, explore in simple language this excerpt: ${focusHint}`,
      'Ask about situations the patient has lived, not about the treatment plan itself.',
    ].join('\n'),
  };

  return blocks[language] ?? blocks.pt;
};

export const buildPatientChatHumanPrompt = (
  language: AppLanguage,
  userMessage: string,
  context: string,
  phase: Exclude<PatientChatInteractionPhase, 'closing'>
): string => {
  const focusHint = resolveQuestionFocusHint(context, phase);

  const blocks: Record<AppLanguage, string[]> = {
    pt: [
      `Mensagem do paciente: ${userMessage}`,
      'Leia literalmente o que o paciente disse. Não pergunte de novo o que ele já respondeu.',
      focusHint
        ? `Com base no contexto do psicólogo, pergunte algo novo e concreto relacionado a: ${focusHint}.`
        : 'Pergunte algo novo e concreto sobre a vida recente do paciente.',
      'Responda em linguagem simples, como se falasse com alguém sem formação em saúde.',
    ],
    es: [
      `Mensaje del paciente: ${userMessage}`,
      'Lee literalmente lo que dijo el paciente. No preguntes de nuevo lo que ya respondió.',
      focusHint
        ? `Según el contexto del psicólogo, pregunta algo nuevo y concreto relacionado con: ${focusHint}.`
        : 'Pregunta algo nuevo y concreto sobre la vida reciente del paciente.',
      'Responde en lenguaje simple, como si hablaras con alguien sin formación en salud.',
    ],
    en: [
      `Patient message: ${userMessage}`,
      'Read literally what the patient said. Do not ask again what they already answered.',
      focusHint
        ? `Based on the psychologist context, ask something new and concrete related to: ${focusHint}.`
        : 'Ask something new and concrete about the patient recent life.',
      'Reply in simple language, as if speaking to someone without healthcare training.',
    ],
  };

  return (blocks[language] ?? blocks.pt).join('\n');
};
