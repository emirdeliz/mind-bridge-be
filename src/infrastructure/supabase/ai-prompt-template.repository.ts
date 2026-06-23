import type { SupabaseClient } from '@supabase/supabase-js';

import {
  getAiPromptTemplateDefinition,
  listAiPromptTemplateDefinitions,
} from '@ai/prompts/ai-prompt-registry.js';
import { NotFoundError } from '@application/authorization.js';
import type {
  AiPromptTemplateListItem,
  AiPromptTemplateTranslations,
  UpsertAiPromptTemplateBody,
} from '@domain/ai-prompt-template.types.js';
import type { AppLanguage } from '@domain/types.js';

import {
  getAiPromptTemplateDefaultTranslations,
  loadAllAiPromptTemplateDefaultTranslations,
} from './ai-prompt-template-default.repository.js';
import {
  extractPromptTokens,
  resolvePromptTemplateLanguageContent,
  sanitizePromptTemplateTranslations,
  validateAllowedPromptTokens,
} from './ai-prompt-template.shared.js';

type PromptTemplateRow = {
  key: string;
  translations: AiPromptTemplateTranslations;
  updated_at: string;
  updated_by: string | null;
};

const toDefaultContent = (
  translations: AiPromptTemplateTranslations
): Record<AppLanguage, string> => ({
  pt: translations.pt ?? '',
  en: translations.en ?? translations.pt ?? '',
  es: translations.es ?? translations.pt ?? '',
});

const mapListItem = (
  definition: NonNullable<ReturnType<typeof getAiPromptTemplateDefinition>>,
  defaultTranslations: AiPromptTemplateTranslations,
  override: PromptTemplateRow | undefined
): AiPromptTemplateListItem => {
  const overrideTranslations = override?.translations ?? null;
  const isCustomized = Boolean(
    overrideTranslations &&
      Object.values(overrideTranslations).some(
        (value) => typeof value === 'string' && value.trim().length > 0
      )
  );

  return {
    key: definition.key,
    category: definition.category,
    label: definition.label,
    description: definition.description,
    allowedTokens: definition.allowedTokens,
    defaultContent: toDefaultContent(defaultTranslations),
    override: isCustomized ? overrideTranslations : null,
    isCustomized,
    updatedAt: override?.updated_at ?? null,
  };
};

export const listAiPromptTemplates = async (
  admin: SupabaseClient
): Promise<AiPromptTemplateListItem[]> => {
  const [defaults, overridesResult] = await Promise.all([
    loadAllAiPromptTemplateDefaultTranslations(admin),
    admin
      .from('ai_prompt_templates')
      .select('key, translations, updated_at, updated_by'),
  ]);

  if (overridesResult.error) {
    throw new Error(
      `Failed to list prompt templates: ${overridesResult.error.message}`
    );
  }

  const overrides = new Map(
    (overridesResult.data as PromptTemplateRow[] | null)?.map((row) => [
      row.key,
      row,
    ]) ?? []
  );

  return listAiPromptTemplateDefinitions().map((definition) =>
    mapListItem(
      definition,
      defaults.get(definition.key) ?? {},
      overrides.get(definition.key)
    )
  );
};

export const getAiPromptTemplateOverride = async (
  admin: SupabaseClient,
  key: string
): Promise<PromptTemplateRow | null> => {
  const definition = getAiPromptTemplateDefinition(key);
  if (!definition) {
    throw new NotFoundError('Prompt template not found');
  }

  const { data, error } = await admin
    .from('ai_prompt_templates')
    .select('key, translations, updated_at, updated_by')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load prompt template: ${error.message}`);
  }

  return (data as PromptTemplateRow | null) ?? null;
};

export const saveAiPromptTemplateOverride = async (
  admin: SupabaseClient,
  key: string,
  body: UpsertAiPromptTemplateBody,
  updatedBy: string
): Promise<AiPromptTemplateListItem> => {
  const definition = getAiPromptTemplateDefinition(key);
  if (!definition) {
    throw new NotFoundError('Prompt template not found');
  }

  const translations = sanitizePromptTemplateTranslations(body.translations);
  validateAllowedPromptTokens(definition.allowedTokens, translations);

  const { data, error } = await admin
    .from('ai_prompt_templates')
    .upsert(
      {
        key,
        translations,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )
    .select('key, translations, updated_at, updated_by')
    .single();

  if (error) {
    throw new Error(`Failed to save prompt template: ${error.message}`);
  }

  const defaultTranslations = await getAiPromptTemplateDefaultTranslations(
    admin,
    key
  );

  return mapListItem(definition, defaultTranslations, data as PromptTemplateRow);
};

export const restoreAiPromptTemplateDefault = async (
  admin: SupabaseClient,
  key: string
): Promise<AiPromptTemplateListItem> => {
  const definition = getAiPromptTemplateDefinition(key);
  if (!definition) {
    throw new NotFoundError('Prompt template not found');
  }

  const { error } = await admin.from('ai_prompt_templates').delete().eq('key', key);

  if (error) {
    throw new Error(`Failed to restore prompt template: ${error.message}`);
  }

  const defaultTranslations = await getAiPromptTemplateDefaultTranslations(
    admin,
    key
  );

  return mapListItem(definition, defaultTranslations, undefined);
};

export const resolveStoredPromptTemplate = async (
  admin: SupabaseClient,
  key: string,
  language: AppLanguage
): Promise<string> => {
  const definition = getAiPromptTemplateDefinition(key);
  if (!definition) {
    throw new Error(`Unknown prompt template key: ${key}`);
  }

  const [defaultTranslations, override] = await Promise.all([
    getAiPromptTemplateDefaultTranslations(admin, key),
    getAiPromptTemplateOverride(admin, key),
  ]);

  const customized = resolvePromptTemplateLanguageContent(
    override?.translations,
    language
  );

  if (customized) {
    return customized;
  }

  const fallback = resolvePromptTemplateLanguageContent(
    defaultTranslations,
    language
  );

  if (!fallback) {
    throw new Error(`Prompt template default missing for key: ${key}`);
  }

  return fallback;
};

export { extractPromptTokens };
