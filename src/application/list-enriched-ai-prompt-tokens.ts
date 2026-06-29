import { AI_PROMPT_TOKEN_DEFINITIONS } from '@ai/prompts/ai-prompt-tokens.js';
import { buildAiPromptTokenPreviews } from '@ai/prompts/ai-prompt-token-previews.js';
import { getAiPromptTokenSource } from '@ai/prompts/ai-prompt-token-sources.js';
import type { EnrichedAiPromptTokenDefinition } from '@domain/ai-prompt-template.types.js';

export const listEnrichedAiPromptTokens = (): EnrichedAiPromptTokenDefinition[] =>
  AI_PROMPT_TOKEN_DEFINITIONS.map((token) => ({
    ...token,
    source: getAiPromptTokenSource(token.key),
    preview: buildAiPromptTokenPreviews(token.key),
  }));
