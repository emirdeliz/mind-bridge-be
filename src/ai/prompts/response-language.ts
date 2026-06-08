import type { AppLanguage } from '@domain/types.js';

const LANGUAGE_INSTRUCTIONS: Record<AppLanguage, string> = {
  pt: 'Responda sempre em português do Brasil, de forma clara e empática.',
  es: 'Responde siempre en español, de forma clara y empática.',
  en: 'Always respond in English, clearly and empathetically.',
};

export const resolveLanguageInstruction = (
  language: AppLanguage | undefined
): string => LANGUAGE_INSTRUCTIONS[language ?? 'pt'];
