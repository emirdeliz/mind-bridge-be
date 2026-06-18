import type { AppLanguage } from '@domain/types.js';

/** AssemblyAI `language_code` values for Universal-2 (pt / en / es). */
export const toAssemblyAiLanguageCode = (
  language: AppLanguage | undefined
): AppLanguage => language ?? 'pt';
