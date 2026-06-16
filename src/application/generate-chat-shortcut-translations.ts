import { HumanMessage, SystemMessage } from '@langchain/core/messages';

import { createChatModel } from '@ai/llm.js';
import type { Env } from '@config/env.js';
import type { ChatShortcutTranslations } from '@domain/psychologist-chat-shortcut.types.js';
import type { AppLanguage } from '@domain/types.js';

const APP_LANGUAGES: AppLanguage[] = ['pt', 'en', 'es'];

const parseTranslations = (raw: string): ChatShortcutTranslations | null => {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf('{');
  const jsonEnd = trimmed.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as Record<
      string,
      { label?: string; message?: string }
    >;

    const result = {} as ChatShortcutTranslations;
    for (const language of APP_LANGUAGES) {
      const entry = parsed[language];
      const label = entry?.label?.trim() ?? '';
      const message = entry?.message?.trim() ?? '';
      if (!label || !message) {
        return null;
      }
      result[language] = { label, message };
    }

    return result;
  } catch {
    return null;
  }
};

export const generateChatShortcutTranslations = async (
  env: Env,
  input: {
    label: string;
    message: string;
    sourceLanguage: AppLanguage;
  }
): Promise<ChatShortcutTranslations> => {
  const label = input.label.trim();
  const message = input.message.trim();

  const model = createChatModel(env);
  const response = await model.invoke([
    new SystemMessage(
      [
        'You translate psychologist AI chat shortcut buttons.',
        'Return ONLY valid JSON with keys pt, en, and es.',
        'Each language must have "label" (short button text) and "message" (full prompt sent to the AI).',
        'Preserve clinical meaning. Keep labels concise.',
        'Schema: {"pt":{"label":"...","message":"..."},"en":{"label":"...","message":"..."},"es":{"label":"...","message":"..."}}',
      ].join('\n')
    ),
    new HumanMessage(
      [
        `Source language: ${input.sourceLanguage}`,
        `Source label: ${label}`,
        `Source message: ${message}`,
        'Translate label and message into Portuguese (pt), English (en), and Spanish (es).',
      ].join('\n')
    ),
  ]);

  const content =
    typeof response.content === 'string'
      ? response.content
      : Array.isArray(response.content)
        ? response.content
            .map((part) =>
              typeof part === 'string'
                ? part
                : ((part as { text?: string }).text ?? '')
            )
            .join('')
        : '';

  const parsed = parseTranslations(content);
  if (parsed) {
    parsed[input.sourceLanguage] = { label, message };
    return parsed;
  }

  const fallback = {} as ChatShortcutTranslations;
  for (const language of APP_LANGUAGES) {
    fallback[language] = { label, message };
  }
  return fallback;
};
