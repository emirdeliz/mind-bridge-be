import {
  LIKERT_DIMENSION_IDS,
  type LikertCheckIn,
  type LikertDimensionId,
} from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

const DIMENSION_LABELS: Record<
  AppLanguage,
  Record<LikertDimensionId, string>
> = {
  pt: {
    mood: 'Humor',
    anxiety: 'Ansiedade',
    sleep: 'Qualidade do sono',
    wellbeing: 'Bem-estar geral',
  },
  es: {
    mood: 'Ánimo',
    anxiety: 'Ansiedad',
    sleep: 'Calidad del sueño',
    wellbeing: 'Bienestar general',
  },
  en: {
    mood: 'Mood',
    anxiety: 'Anxiety',
    sleep: 'Sleep quality',
    wellbeing: 'Overall wellbeing',
  },
};

const SECTION_TITLES: Record<AppLanguage, string> = {
  pt: 'Autoavaliação Likert do paciente (escala 1–5, registro mais recente):',
  es: 'Autoevaluación Likert del paciente (escala 1–5, registro más reciente):',
  en: 'Patient Likert self-assessment (1–5 scale, latest entry):',
};

export const formatLikertCheckInForContext = (
  languageInput: AppLanguage | unknown,
  checkIn: LikertCheckIn | null | undefined
): string | null => {
  const language =
    languageInput === 'en' || languageInput === 'es' || languageInput === 'pt'
      ? languageInput
      : 'pt';

  const scores = checkIn?.scores;
  if (!scores) {
    return null;
  }

  const lines = LIKERT_DIMENSION_IDS.filter(
    (dimension) => typeof scores[dimension] === 'number'
  ).map(
    (dimension) =>
      `- ${DIMENSION_LABELS[language][dimension]}: ${scores[dimension]}/5`
  );

  if (!lines.length) {
    return null;
  }

  return [SECTION_TITLES[language], ...lines].join('\n');
};
