import { AsyncLocalStorage } from 'node:async_hooks';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getAiPromptTemplateContent } from '@application/ai-prompt-template-cache.js';
import type { AiPromptTemplateTranslations } from '@domain/ai-prompt-template.types.js';
import type { AppLanguage } from '@domain/types.js';
import { loadPsychologistPromptTemplateOverrides } from '@infrastructure/supabase/psychologist-prompt-template.repository.js';
import { resolvePromptTemplateLanguageContent } from '@infrastructure/supabase/ai-prompt-template.shared.js';

export type PromptTemplateDraftOverride = {
  key: string;
  content: string;
  language: AppLanguage;
};

type PromptTemplateResolverStore = {
  overrides: Map<string, AiPromptTemplateTranslations>;
  draftOverride?: PromptTemplateDraftOverride;
};

const promptTemplateStorage =
  new AsyncLocalStorage<PromptTemplateResolverStore>();

const mergeDraftOverride = (
  overrides: Map<string, AiPromptTemplateTranslations>,
  draftOverride?: PromptTemplateDraftOverride
): Map<string, AiPromptTemplateTranslations> => {
  if (!draftOverride) {
    return overrides;
  }

  const merged = new Map(overrides);
  const current = merged.get(draftOverride.key) ?? {};
  merged.set(draftOverride.key, {
    ...current,
    [draftOverride.language]: draftOverride.content,
  });
  return merged;
};

export const runWithPsychologistPromptTemplateResolver = async <T>(
  admin: SupabaseClient,
  psychologistId: string | undefined,
  fn: () => Promise<T>,
  draftOverride?: PromptTemplateDraftOverride
): Promise<T> => {
  const overrides = psychologistId
    ? await loadPsychologistPromptTemplateOverrides(admin, psychologistId)
    : new Map<string, AiPromptTemplateTranslations>();

  return promptTemplateStorage.run(
    {
      overrides: mergeDraftOverride(overrides, draftOverride),
      draftOverride,
    },
    fn
  );
};

export const getActiveAiPromptTemplateContent = (
  key: string,
  language: AppLanguage
): string => {
  const store = promptTemplateStorage.getStore();

  if (
    store?.draftOverride?.key === key &&
    store.draftOverride.language === language &&
    store.draftOverride.content.trim()
  ) {
    return store.draftOverride.content;
  }

  const customized = resolvePromptTemplateLanguageContent(
    store?.overrides.get(key),
    language
  );

  if (customized) {
    return customized;
  }

  return getAiPromptTemplateContent(key, language);
};
