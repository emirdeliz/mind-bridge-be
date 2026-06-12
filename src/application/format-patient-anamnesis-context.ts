import type { PatientAnamnesis } from '@domain/clinical-content.types.js';
import type { AppLanguage } from '@domain/types.js';

import { truncateContextText } from './truncate-context-text.js';

const MAX_ANAMNESIS_FIELD_CHARS = 600;

type AnamnesisFieldKey = keyof PatientAnamnesis;

const ANAMNESIS_FIELD_ORDER: AnamnesisFieldKey[] = [
  'chiefComplaint',
  'currentHistory',
  'personalHistory',
  'familyHistory',
  'socialHistory',
  'medicalPsychiatricHistory',
  'lifeHabits',
  'emotionalBehavioral',
  'therapeuticGoals',
  'psychologistNotes',
];

const FIELD_LABELS: Record<AppLanguage, Record<AnamnesisFieldKey, string>> = {
  pt: {
    chiefComplaint: 'Queixa principal',
    currentHistory: 'História do problema atual',
    personalHistory: 'História pessoal',
    familyHistory: 'História familiar',
    socialHistory: 'História social',
    medicalPsychiatricHistory: 'Histórico médico e psiquiátrico',
    lifeHabits: 'Hábitos de vida',
    emotionalBehavioral: 'Aspectos emocionais e comportamentais',
    therapeuticGoals: 'Objetivos terapêuticos',
    psychologistNotes: 'Observações do psicólogo',
  },
  es: {
    chiefComplaint: 'Motivo de consulta',
    currentHistory: 'Historia del problema actual',
    personalHistory: 'Historia personal',
    familyHistory: 'Historia familiar',
    socialHistory: 'Historia social',
    medicalPsychiatricHistory: 'Historial médico y psiquiátrico',
    lifeHabits: 'Hábitos de vida',
    emotionalBehavioral: 'Aspectos emocionales y conductuales',
    therapeuticGoals: 'Objetivos terapéuticos',
    psychologistNotes: 'Observaciones del psicólogo',
  },
  en: {
    chiefComplaint: 'Chief complaint',
    currentHistory: 'History of present problem',
    personalHistory: 'Personal history',
    familyHistory: 'Family history',
    socialHistory: 'Social history',
    medicalPsychiatricHistory: 'Medical and psychiatric history',
    lifeHabits: 'Lifestyle habits',
    emotionalBehavioral: 'Emotional and behavioral aspects',
    therapeuticGoals: 'Therapeutic goals',
    psychologistNotes: 'Psychologist notes',
  },
};

const SECTION_TITLES: Record<AppLanguage, string> = {
  pt: 'Ficha de anamnese (registro clínico do paciente):',
  es: 'Ficha de anamnesis (registro clínico del paciente):',
  en: 'Anamnesis form (patient clinical record):',
};

export const formatPatientAnamnesisForContext = (
  languageInput: AppLanguage | unknown,
  anamnesis: PatientAnamnesis | null | undefined
): string | null => {
  const language =
    languageInput === 'en' || languageInput === 'es' || languageInput === 'pt'
      ? languageInput
      : 'pt';

  if (!anamnesis) {
    return null;
  }

  const lines = ANAMNESIS_FIELD_ORDER.flatMap((field) => {
    const value = anamnesis[field]?.trim();
    if (!value) {
      return [];
    }

    return [
      `- ${FIELD_LABELS[language][field]}: ${truncateContextText(value, MAX_ANAMNESIS_FIELD_CHARS)}`,
    ];
  });

  if (!lines.length) {
    return null;
  }

  return [SECTION_TITLES[language], ...lines].join('\n');
};
