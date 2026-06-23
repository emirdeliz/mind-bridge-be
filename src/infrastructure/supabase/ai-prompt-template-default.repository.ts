import type { SupabaseClient } from '@supabase/supabase-js';

import { AI_PROMPT_DEFAULT_SEED } from '@ai/prompts/ai-prompt-default-seed.js';
import {
  getAiPromptTemplateDefinition,
  listAiPromptTemplateDefinitions,
} from '@ai/prompts/ai-prompt-registry.js';
import { NotFoundError } from '@application/authorization.js';
import type {
  AiPromptTemplateDefaultListItem,
  AiPromptTemplateTranslations,
  UpsertAiPromptTemplateBody,
} from '@domain/ai-prompt-template.types.js';
import type { AppLanguage } from '@domain/types.js';

import {
  extractPromptTokens,
  sanitizePromptTemplateTranslations,
  validateAllowedPromptTokens,
} from './ai-prompt-template.shared.js';

type PromptTemplateDefaultRow = {
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

const mapDefaultListItem = (
  definition: NonNullable<ReturnType<typeof getAiPromptTemplateDefinition>>,
  row: PromptTemplateDefaultRow | undefined
): AiPromptTemplateDefaultListItem => {
  const translations = row?.translations ?? {};
  const defaultContent = toDefaultContent(translations);

  return {
    key: definition.key,
    category: definition.category,
    label: definition.label,
    description: definition.description,
    allowedTokens: definition.allowedTokens,
    defaultContent,
    updatedAt: row?.updated_at ?? null,
  };
};

export const ensureAiPromptTemplateDefaultsSeeded = async (
  admin: SupabaseClient
): Promise<void> => {
  const { data, error } = await admin
    .from('ai_prompt_template_defaults')
    .select('key');

  if (error) {
    throw new Error(`Failed to check prompt defaults: ${error.message}`);
  }

  const existingKeys = new Set((data ?? []).map((row) => row.key as string));
  const missing = listAiPromptTemplateDefinitions().filter(
    (definition) => !existingKeys.has(definition.key)
  );

  if (!missing.length) {
    return;
  }

  const now = new Date().toISOString();
  const rows = missing.map((definition) => ({
    key: definition.key,
    translations: AI_PROMPT_DEFAULT_SEED[definition.key],
    updated_at: now,
    updated_by: null,
  }));

  const { error: insertError } = await admin
    .from('ai_prompt_template_defaults')
    .insert(rows);

  if (insertError) {
    throw new Error(`Failed to seed prompt defaults: ${insertError.message}`);
  }
};

export const listAiPromptTemplateDefaults = async (
  admin: SupabaseClient
): Promise<AiPromptTemplateDefaultListItem[]> => {
  await ensureAiPromptTemplateDefaultsSeeded(admin);

  const { data, error } = await admin
    .from('ai_prompt_template_defaults')
    .select('key, translations, updated_at, updated_by');

  if (error) {
    throw new Error(`Failed to list prompt defaults: ${error.message}`);
  }

  const defaults = new Map(
    (data as PromptTemplateDefaultRow[] | null)?.map((row) => [row.key, row]) ??
      []
  );

  return listAiPromptTemplateDefinitions().map((definition) =>
    mapDefaultListItem(definition, defaults.get(definition.key))
  );
};

export const getAiPromptTemplateDefaultTranslations = async (
  admin: SupabaseClient,
  key: string
): Promise<AiPromptTemplateTranslations> => {
  const definition = getAiPromptTemplateDefinition(key);
  if (!definition) {
    throw new NotFoundError('Prompt template not found');
  }

  await ensureAiPromptTemplateDefaultsSeeded(admin);

  const { data, error } = await admin
    .from('ai_prompt_template_defaults')
    .select('translations')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load prompt default: ${error.message}`);
  }

  return (data?.translations as AiPromptTemplateTranslations | undefined) ??
    AI_PROMPT_DEFAULT_SEED[key] ??
    {};
};

export const saveAiPromptTemplateDefault = async (
  admin: SupabaseClient,
  key: string,
  body: UpsertAiPromptTemplateBody,
  updatedBy: string
): Promise<AiPromptTemplateDefaultListItem> => {
  const definition = getAiPromptTemplateDefinition(key);
  if (!definition) {
    throw new NotFoundError('Prompt template not found');
  }

  await ensureAiPromptTemplateDefaultsSeeded(admin);

  const translations = sanitizePromptTemplateTranslations(body.translations);
  validateAllowedPromptTokens(definition.allowedTokens, translations);

  const { data, error } = await admin
    .from('ai_prompt_template_defaults')
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
    throw new Error(`Failed to save prompt default: ${error.message}`);
  }

  return mapDefaultListItem(definition, data as PromptTemplateDefaultRow);
};

export const loadAllAiPromptTemplateDefaultTranslations = async (
  admin: SupabaseClient
): Promise<Map<string, AiPromptTemplateTranslations>> => {
  await ensureAiPromptTemplateDefaultsSeeded(admin);

  const { data, error } = await admin
    .from('ai_prompt_template_defaults')
    .select('key, translations');

  if (error) {
    throw new Error(`Failed to load prompt defaults: ${error.message}`);
  }

  return new Map(
    (data ?? []).map((row) => [
      row.key as string,
      (row.translations ?? {}) as AiPromptTemplateTranslations,
    ])
  );
};

export { extractPromptTokens };
