import { HumanMessage, SystemMessage } from '@langchain/core/messages';

import { createChatModel } from '@ai/llm.js';
import { extractPromptTokens } from '@ai/prompts/apply-prompt-tokens.js';
import type { Env } from '@config/env.js';
import type { AiPromptTemplateTranslations } from '@domain/ai-prompt-template.types.js';
import type { AppLanguage } from '@domain/types.js';

const APP_LANGUAGES: AppLanguage[] = ['pt', 'en', 'es'];

const parsePromptTranslations = (
  raw: string
): AiPromptTemplateTranslations | null => {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf('{');
  const jsonEnd = trimmed.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as Record<
      string,
      unknown
    >;

    const result = {} as AiPromptTemplateTranslations;
    for (const language of APP_LANGUAGES) {
      const value = parsed[language];
      if (typeof value !== 'string' || !value.trim()) {
        return null;
      }
      result[language] = value.trim();
    }

    return result;
  } catch {
    return null;
  }
};

const preserveSourceTokens = (
  translated: string,
  source: string
): string => {
  const sourceTokens = extractPromptTokens(source);
  if (!sourceTokens.length) {
    return translated;
  }

  let output = translated;
  for (const token of sourceTokens) {
    const pattern = new RegExp(`#${token}\\b`, 'gi');
    if (!pattern.test(output)) {
      output = `${output}\n#${token}`;
    }
  }

  return output;
};

export const generateAiPromptTemplateTranslations = async (
  env: Env,
  input: {
    content: string;
    sourceLanguage: AppLanguage;
    allowedTokens: string[];
  }
): Promise<AiPromptTemplateTranslations> => {
  const content = input.content.trim();
  const reservedWords = input.allowedTokens.length
    ? input.allowedTokens.map((token) => `#${token}`).join(', ')
    : 'none';

  const model = createChatModel(env);
  const response = await model.invoke([
    new SystemMessage(
      [
        'You translate AI system prompt templates for a mental-health platform.',
        'Return ONLY valid JSON with keys pt, en, and es.',
        'Each value is the full prompt template string for that language.',
        'CRITICAL: every reserved word starting with # must remain EXACTLY unchanged.',
        'Do not translate, rename, or remove tokens like #psychologist_context or #user_message.',
        'Only translate the human-readable text around those tokens.',
        `Allowed reserved words for this template: ${reservedWords}`,
        'Schema: {"pt":"...","en":"...","es":"..."}',
      ].join('\n')
    ),
    new HumanMessage(
      [
        `Source language: ${input.sourceLanguage}`,
        `Source template:\n${content}`,
        'Translate the template into Portuguese (pt), English (en), and Spanish (es).',
      ].join('\n\n')
    ),
  ]);

  const responseContent =
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

  const parsed = parsePromptTranslations(responseContent);
  if (parsed) {
    parsed[input.sourceLanguage] = content;
    for (const language of APP_LANGUAGES) {
      const value = parsed[language];
      if (typeof value === 'string') {
        parsed[language] = preserveSourceTokens(value, content);
      }
    }
    return parsed;
  }

  const fallback = {} as AiPromptTemplateTranslations;
  for (const language of APP_LANGUAGES) {
    fallback[language] = content;
  }
  return fallback;
};
