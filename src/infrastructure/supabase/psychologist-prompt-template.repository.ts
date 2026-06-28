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

import { getAiPromptTemplateDefaultTranslations } from './ai-prompt-template-default.repository.js';
import {
  resolvePromptTemplateLanguageContent,
  sanitizePromptTemplateTranslations,
  validateAllowedPromptTokens,
} from './ai-prompt-template.shared.js';

type PsychologistPromptTemplateRow = {
  psychologist_id: string;
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
  override: PsychologistPromptTemplateRow | undefined
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

export const loadPsychologistPromptTemplateOverrides = async (
  admin: SupabaseClient,
  psychologistId: string
): Promise<Map<string, AiPromptTemplateTranslations>> => {
  const { data, error } = await admin
    .from('psychologist_ai_prompt_templates')
    .select('key, translations')
    .eq('psychologist_id', psychologistId);

  if (error) {
    throw new Error(
      `Failed to load psychologist prompt templates: ${error.message}`
    );
  }

  return new Map(
    (data as Pick<PsychologistPromptTemplateRow, 'key' | 'translations'>[] | null)?.map(
      (row) => [row.key, row.translations ?? {}]
    ) ?? []
  );
};

export const listPsychologistPromptTemplates = async (
  admin: SupabaseClient,
  psychologistId: string
): Promise<AiPromptTemplateListItem[]> => {
  const [defaults, overridesResult] = await Promise.all([
    Promise.all(
      listAiPromptTemplateDefinitions().map(async (definition) => [
        definition.key,
        await getAiPromptTemplateDefaultTranslations(admin, definition.key),
      ] as const)
    ),
    admin
      .from('psychologist_ai_prompt_templates')
      .select('psychologist_id, key, translations, updated_at, updated_by')
      .eq('psychologist_id', psychologistId),
  ]);

  if (overridesResult.error) {
    throw new Error(
      `Failed to list psychologist prompt templates: ${overridesResult.error.message}`
    );
  }

  const defaultMap = new Map(defaults);
  const overrides = new Map(
    (overridesResult.data as PsychologistPromptTemplateRow[] | null)?.map(
      (row) => [row.key, row]
    ) ?? []
  );

  return listAiPromptTemplateDefinitions().map((definition) =>
    mapListItem(
      definition,
      defaultMap.get(definition.key) ?? {},
      overrides.get(definition.key)
    )
  );
};

export const savePsychologistPromptTemplateOverride = async (
  admin: SupabaseClient,
  psychologistId: string,
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
    .from('psychologist_ai_prompt_templates')
    .upsert(
      {
        psychologist_id: psychologistId,
        key,
        translations,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'psychologist_id,key' }
    )
    .select('psychologist_id, key, translations, updated_at, updated_by')
    .single();

  if (error) {
    throw new Error(
      `Failed to save psychologist prompt template: ${error.message}`
    );
  }

  const defaultTranslations = await getAiPromptTemplateDefaultTranslations(
    admin,
    key
  );

  return mapListItem(
    definition,
    defaultTranslations,
    data as PsychologistPromptTemplateRow
  );
};

export const restorePsychologistPromptTemplateDefault = async (
  admin: SupabaseClient,
  psychologistId: string,
  key: string
): Promise<AiPromptTemplateListItem> => {
  const definition = getAiPromptTemplateDefinition(key);
  if (!definition) {
    throw new NotFoundError('Prompt template not found');
  }

  const { error } = await admin
    .from('psychologist_ai_prompt_templates')
    .delete()
    .eq('psychologist_id', psychologistId)
    .eq('key', key);

  if (error) {
    throw new Error(
      `Failed to restore psychologist prompt template: ${error.message}`
    );
  }

  const defaultTranslations = await getAiPromptTemplateDefaultTranslations(
    admin,
    key
  );

  return mapListItem(definition, defaultTranslations, undefined);
};

export const resolvePsychologistPromptTemplateContent = async (
  admin: SupabaseClient,
  psychologistId: string,
  key: string,
  language: AppLanguage
): Promise<string> => {
  const { data, error } = await admin
    .from('psychologist_ai_prompt_templates')
    .select('translations')
    .eq('psychologist_id', psychologistId)
    .eq('key', key)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load psychologist prompt template: ${error.message}`
    );
  }

  const customized = resolvePromptTemplateLanguageContent(
    (data?.translations as AiPromptTemplateTranslations | undefined) ?? undefined,
    language
  );

  if (customized) {
    return customized;
  }

  const defaultTranslations = await getAiPromptTemplateDefaultTranslations(
    admin,
    key
  );
  const fallback = resolvePromptTemplateLanguageContent(
    defaultTranslations,
    language
  );

  if (!fallback) {
    throw new Error(`Prompt template default missing for key: ${key}`);
  }

  return fallback;
};
