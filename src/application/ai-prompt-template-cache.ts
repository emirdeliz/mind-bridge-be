import type { SupabaseClient } from '@supabase/supabase-js';

import { getAiPromptTemplateDefinition } from '@ai/prompts/ai-prompt-registry.js';
import type { AiPromptTemplateTranslations } from '@domain/ai-prompt-template.types.js';
import type { AppLanguage } from '@domain/types.js';

import {
  ensureAiPromptTemplateDefaultsSeeded,
  loadAllAiPromptTemplateDefaultTranslations,
} from '@infrastructure/supabase/ai-prompt-template-default.repository.js';
import { resolvePromptTemplateLanguageContent } from '@infrastructure/supabase/ai-prompt-template.shared.js';

type OverrideCache = Map<string, AiPromptTemplateTranslations>;
type DefaultCache = Map<string, AiPromptTemplateTranslations>;

let overrideCache: OverrideCache = new Map();
let defaultCache: DefaultCache = new Map();
let cacheReady = false;

export const invalidateAiPromptTemplateCache = (): void => {
  overrideCache = new Map();
  defaultCache = new Map();
  cacheReady = false;
};

export const warmAiPromptTemplateCache = async (
  admin: SupabaseClient
): Promise<void> => {
  await ensureAiPromptTemplateDefaultsSeeded(admin);

  const [defaults, overridesResult] = await Promise.all([
    loadAllAiPromptTemplateDefaultTranslations(admin),
    admin.from('ai_prompt_templates').select('key, translations'),
  ]);

  if (overridesResult.error) {
    throw overridesResult.error;
  }

  defaultCache = defaults;
  overrideCache = new Map(
    (overridesResult.data ?? []).map((row) => [
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

  const customized = resolvePromptTemplateLanguageContent(
    overrideCache.get(key),
    language
  );

  if (customized) {
    return customized;
  }

  const fallback = resolvePromptTemplateLanguageContent(
    defaultCache.get(key),
    language
  );

  if (!fallback) {
    throw new Error(`Prompt template default missing for key: ${key}`);
  }

  return fallback;
};

export const isAiPromptTemplateCacheReady = (): boolean => cacheReady;
