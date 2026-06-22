import type { AppLanguage } from '@domain/types.js';

import { getAiPromptTemplateContent } from '@application/ai-prompt-template-cache.js';

const LANGUAGE_INSTRUCTIONS: Record<AppLanguage, string> = {
  pt: 'Responda sempre em português do Brasil, de forma clara e empática.',
  es: 'Responde siempre en español, de forma clara y empática.',
  en: 'Always respond in English, clearly and empathetically.',
};

export const resolveLanguageInstruction = (
  language: AppLanguage | undefined
): string => {
  const resolved = language ?? 'pt';
  try {
    return getAiPromptTemplateContent('response_language.instruction', resolved);
  } catch {
    return LANGUAGE_INSTRUCTIONS[resolved];
  }
};

const PSYCHOLOGIST_BREVITY_INSTRUCTIONS: Record<AppLanguage, string> = {
  pt: 'Responda em UMA única frase curta (máximo 20 palavras). Vá direto ao ponto. Proibido: listas, tópicos, markdown, saudações e explicações longas.',
  es: 'Responde en UNA sola frase corta (máximo 20 palabras). Ve al grano. Prohibido: listas, viñetas, markdown, saludos y explicaciones largas.',
  en: 'Reply in ONE short sentence only (max 20 words). Be direct. No lists, bullets, markdown, greetings, or long explanations.',
};

/** Keeps psychologist copilot replies brief during live sessions. */
export const resolvePsychologistBrevityInstruction = (
  language: AppLanguage | undefined
): string => {
  const resolved = language ?? 'pt';
  try {
    return getAiPromptTemplateContent(
      'response_language.psychologist_brevity',
      resolved
    );
  } catch {
    return PSYCHOLOGIST_BREVITY_INSTRUCTIONS[resolved];
  }
};
