import { AsyncLocalStorage } from 'node:async_hooks';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getAiPromptTemplateContent } from '@application/ai-prompt-template-cache.js';
import type { AiPromptTemplateTranslations } from '@domain/ai-prompt-template.types.js';
import type { AppLanguage } from '@domain/types.js';
import { loadPsychologistPromptTemplateOverrides } from '@infrastructure/supabase/psychologist-prompt-template.repository.js';
import { resolvePromptTemplateLanguageContent } from '@infrastructure/supabase/ai-prompt-template.shared.js';

type PromptTemplateResolverStore = {
  overrides: Map<string, AiPromptTemplateTranslations>;
};

const promptTemplateStorage =
  new AsyncLocalStorage<PromptTemplateResolverStore>();

export const runWithPsychologistPromptTemplateResolver = async <T>(
  admin: SupabaseClient,
  psychologistId: string | undefined,
  fn: () => Promise<T>
): Promise<T> => {
  if (!psychologistId) {
    return fn();
  }

  const overrides = await loadPsychologistPromptTemplateOverrides(
    admin,
    psychologistId
  );

  return promptTemplateStorage.run({ overrides }, fn);
};

export const getActiveAiPromptTemplateContent = (
  key: string,
  language: AppLanguage
): string => {
  const store = promptTemplateStorage.getStore();
  const customized = resolvePromptTemplateLanguageContent(
    store?.overrides.get(key),
    language
  );

  if (customized) {
    return customized;
  }

  return getAiPromptTemplateContent(key, language);
};
