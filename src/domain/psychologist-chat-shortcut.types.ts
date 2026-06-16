import type { AppLanguage } from '@domain/types.js';

export type ChatShortcutTranslation = {
  label: string;
  message: string;
};

export type ChatShortcutTranslations = Record<
  AppLanguage,
  ChatShortcutTranslation
>;

export type PsychologistChatShortcut = {
  id: string;
  psychologistId: string;
  sortOrder: number;
  translations: ChatShortcutTranslations;
  createdAt: string;
  updatedAt: string;
};

export type PsychologistChatShortcutSaveBody = {
  label: string;
  message: string;
  sourceLanguage: AppLanguage;
};
