import { BadRequestError } from '@http/errors.js';
import type { AiPromptTemplateTranslations } from '@domain/ai-prompt-template.types.js';
import type { AppLanguage } from '@domain/types.js';

const TOKEN_PATTERN = /#([a-z_]+)/gi;

export const sanitizePromptTemplateTranslations = (
  translations: AiPromptTemplateTranslations
): AiPromptTemplateTranslations => {
  const entries = (['pt', 'en', 'es'] as AppLanguage[])
    .map((language) => {
      const value = translations[language];
      if (typeof value !== 'string') {
        return null;
      }
      const trimmed = value.trim();
      return trimmed ? ([language, trimmed] as const) : null;
    })
    .filter(Boolean) as [AppLanguage, string][];

  if (!entries.length) {
    throw new BadRequestError('At least one language translation is required');
  }

  return Object.fromEntries(entries) as AiPromptTemplateTranslations;
};

export const validateAllowedPromptTokens = (
  allowedTokens: string[],
  translations: AiPromptTemplateTranslations
): void => {
  if (!allowedTokens.length) {
    return;
  }

  const allowed = new Set(allowedTokens);

  for (const content of Object.values(translations)) {
    if (typeof content !== 'string') {
      continue;
    }

    const usedTokens = [...content.matchAll(TOKEN_PATTERN)].map((match) =>
      match[1].toLowerCase()
    );
    const invalid = usedTokens.filter((token) => !allowed.has(token));

    if (invalid.length) {
      throw new BadRequestError(
        `Invalid reserved words for this prompt: ${invalid.join(', ')}`
      );
    }
  }
};

export const extractPromptTokens = (content: string): string[] => {
  const matches = content.matchAll(TOKEN_PATTERN);
  return [...new Set([...matches].map((match) => match[1].toLowerCase()))];
};

export const resolvePromptTemplateLanguageContent = (
  translations: AiPromptTemplateTranslations | undefined,
  language: AppLanguage
): string =>
  translations?.[language]?.trim() ||
  translations?.pt?.trim() ||
  '';
