import type { SupabaseClient } from '@supabase/supabase-js';

import { getAiPromptTemplateDefinition } from '@ai/prompts/ai-prompt-registry.js';
import type { AiPromptTemplateTranslations } from '@domain/ai-prompt-template.types.js';
import type { AppLanguage } from '@domain/types.js';

type OverrideCache = Map<string, AiPromptTemplateTranslations>;

let overrideCache: OverrideCache = new Map();
let cacheReady = false;

export const invalidateAiPromptTemplateCache = (): void => {
  overrideCache = new Map();
  cacheReady = false;
};

export const warmAiPromptTemplateCache = async (
  admin: SupabaseClient
): Promise<void> => {
  const { data, error } = await admin
    .from('ai_prompt_templates')
    .select('key, translations');

  if (error) {
    throw error;
  }

  overrideCache = new Map(
    (data ?? []).map((row) => [
      row.key as string,
      (row.translations ?? {}) as AiPromptTemplateTranslations,
    ])
  );
  cacheReady = true;
};

export const ensureAiPromptTemplateCache = async (
  admin: SupabaseClient
): Promise<void> => {
  if (!cacheReady) {
    await warmAiPromptTemplateCache(admin);
  }
};

export const getAiPromptTemplateContent = (
  key: string,
  language: AppLanguage
): string => {
  const definition = getAiPromptTemplateDefinition(key);
  if (!definition) {
    throw new Error(`Unknown prompt template key: ${key}`);
  }

  const override = overrideCache.get(key);
  const customized =
    override?.[language]?.trim() || override?.pt?.trim() || '';

  if (customized) {
    return customized;
  }

  return definition.defaultContent[language] ?? definition.defaultContent.pt;
};

export const isAiPromptTemplateCacheReady = (): boolean => cacheReady;
