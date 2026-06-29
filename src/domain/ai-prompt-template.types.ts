import type { AppLanguage } from './types.js';

export type AiPromptTemplateTranslations = Partial<
  Record<AppLanguage, string>
>;

export type AiPromptTemplateOverride = {
  key: string;
  translations: AiPromptTemplateTranslations;
  updatedAt: string;
  updatedBy: string | null;
  isCustomized: boolean;
};

export type AiPromptTemplateDefinition = {
  key: string;
  category: string;
  label: Record<AppLanguage, string>;
  description: Record<AppLanguage, string>;
  allowedTokens: string[];
};

export type AiPromptTemplateDefaultListItem = {
  key: string;
  category: string;
  label: Record<AppLanguage, string>;
  description: Record<AppLanguage, string>;
  allowedTokens: string[];
  defaultContent: Record<AppLanguage, string>;
  updatedAt: string | null;
};

export type AiPromptTokenDefinition = {
  key: string;
  label: Record<AppLanguage, string>;
  description: Record<AppLanguage, string>;
  example: Record<AppLanguage, string>;
};

export type EnrichedAiPromptTokenDefinition = AiPromptTokenDefinition & {
  source: Record<AppLanguage, string>;
  preview: Record<AppLanguage, string>;
};

export type AiPromptTemplateListItem = {
  key: string;
  category: string;
  label: Record<AppLanguage, string>;
  description: Record<AppLanguage, string>;
  allowedTokens: string[];
  defaultContent: Record<AppLanguage, string>;
  override: AiPromptTemplateTranslations | null;
  isCustomized: boolean;
  updatedAt: string | null;
};

export type SaveAiPromptTemplateBody = {
  content: string;
  sourceLanguage: AppLanguage;
};

export type UpsertAiPromptTemplateBody = {
  translations: AiPromptTemplateTranslations;
};
