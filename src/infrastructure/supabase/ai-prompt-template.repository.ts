import type { SupabaseClient } from '@supabase/supabase-js';

import {
  getAiPromptTemplateDefinition,
  listAiPromptTemplateDefinitions,
} from '@ai/prompts/ai-prompt-registry.js';
import type {
  AiPromptTemplateListItem,
  AiPromptTemplateTranslations,
  UpsertAiPromptTemplateBody,
} from '@domain/ai-prompt-template.types.js';
import type { AppLanguage } from '@domain/types.js';
import { NotFoundError } from '@application/authorization.js';
import { BadRequestError } from '@http/errors.js';

type PromptTemplateRow = {
  key: string;
  translations: AiPromptTemplateTranslations;
  updated_at: string;
  updated_by: string | null;
};

const mapListItem = (
  definition: ReturnType<typeof getAiPromptTemplateDefinition>,
  override: PromptTemplateRow | undefined
): AiPromptTemplateListItem => {
  if (!definition) {
    throw new Error('Prompt template definition missing');
  }

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
    defaultContent: definition.defaultContent,
    override: isCustomized ? overrideTranslations : null,
    isCustomized,
    updatedAt: override?.updated_at ?? null,
  };
};

export const listAiPromptTemplates = async (
  admin: SupabaseClient
): Promise<AiPromptTemplateListItem[]> => {
  const { data, error } = await admin
    .from('ai_prompt_templates')
    .select('key, translations, updated_at, updated_by');

  if (error) {
    throw new Error(`Failed to list prompt templates: ${error.message}`);
  }

  const overrides = new Map(
    (data as PromptTemplateRow[] | null)?.map((row) => [row.key, row]) ?? []
  );

  return listAiPromptTemplateDefinitions().map((definition) =>
    mapListItem(definition, overrides.get(definition.key))
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

  const translations = sanitizeTranslations(body.translations);
  validateAllowedTokens(definition.allowedTokens, translations);

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
    throw new Error(`Failed to load prompt template: ${error.message}`);
  }

  return mapListItem(definition, data as PromptTemplateRow);
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
    throw new Error(`Failed to load prompt template: ${error.message}`);
  }

  return mapListItem(definition, undefined);
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

  const override = await getAiPromptTemplateOverride(admin, key);
  const customized =
    override?.translations?.[language]?.trim() ||
    override?.translations?.pt?.trim();

  if (customized) {
    return customized;
  }

  return definition.defaultContent[language] ?? definition.defaultContent.pt;
};

const sanitizeTranslations = (
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

const TOKEN_PATTERN = /#([a-z_]+)/gi;

const validateAllowedTokens = (
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
